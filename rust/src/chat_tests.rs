use super::*;
use crate::auth::{AuthConfig, AuthState};
use axum::{Router, response::IntoResponse, routing::post};
use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering as AtomicOrdering},
};

fn state(db: sqlx::PgPool) -> AppState {
    let http = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap();
    let auth = AuthState {
        db: db.clone(),
        http: http.clone(),
        config: Arc::new(AuthConfig {
            app_origin: "http://localhost:3000".into(),
            supabase_url: String::new(),
            supabase_anon_key: String::new(),
            secure_cookies: false,
        }),
    };
    AppState { db, http, auth }
}

async fn mock_agent(mode: &'static str) -> (Answer, usize) {
    let count = Arc::new(AtomicUsize::new(0));
    let requests = count.clone();
    let app = Router::new().route("/messages",post(move |Json(request):Json<Value>| {
        let attempt = requests.fetch_add(1,AtomicOrdering::SeqCst);
        async move {
            assert_eq!(request["max_tokens"],3000);
            if mode=="retry" && attempt==0 { return StatusCode::TOO_MANY_REQUESTS.into_response(); }
            if mode=="bounded" || (mode=="pause" && attempt==0) {
                return Json(json!({"stop_reason":"pause_turn","content":[{"type":"text","text":"Looking up sources."}]})).into_response();
            }
            if mode=="tool" && attempt==0 {
                return Json(json!({"stop_reason":"tool_use","content":[{"type":"tool_use","id":"tool_1","name":"unavailable_tool","input":{}}]})).into_response();
            }
            if mode=="tool" {
                let messages = request["messages"].as_array().unwrap();
                assert_eq!(messages.len(),3);
                let result = &messages[2]["content"][0];
                assert_eq!(result["tool_use_id"],"tool_1");
                assert!(result["content"].as_str().unwrap().contains("Unknown tool"));
            }
            if mode=="pause" { assert_eq!(request["messages"].as_array().unwrap().len(),2); }
            Json(json!({"stop_reason":"end_turn","content":[{"type":"text","text":"Verified answer.","citations":[{"url":"https://example.org/rules","title":"Rules"},{"url":"https://example.org/rules","title":"Duplicate"},{"url":"javascript:alert(1)","title":"Invalid"}]}]})).into_response()
        }
    }));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let endpoint = format!("http://{}/messages", listener.local_addr().unwrap());
    let server = tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    // No database is used by these mocked responses; a lazy local pool cannot contact production.
    let db = sqlx::PgPool::connect_lazy("postgres://localhost/unused").unwrap();
    let state = state(db);
    let answer = run_agent_at(
        &state,
        "synthetic-key",
        "Test system".into(),
        vec![json!({"role":"user","content":"Question"})],
        Agent::Rules(1),
        &endpoint,
    )
    .await
    .unwrap();
    server.abort();
    (answer, count.load(AtomicOrdering::SeqCst))
}

#[tokio::test]
async fn first_final_answer_makes_one_request_and_keeps_valid_citations() {
    let (answer, count) = mock_agent("final").await;
    assert_eq!(count, 1);
    assert_eq!(answer.text, "Verified answer.");
    assert_eq!(answer.citations.len(), 1);
    assert_eq!(answer.citations[0]["url"], "https://example.org/rules");
}

#[tokio::test]
async fn pause_tool_result_and_retry_continue_without_duplicate_final_request() {
    for mode in ["pause", "tool", "retry"] {
        let (answer, count) = mock_agent(mode).await;
        assert_eq!(count, 2, "{mode}");
        assert_eq!(answer.text, "Verified answer.");
        assert_eq!(answer.audit.len(), usize::from(mode == "tool"));
    }
}

#[tokio::test]
async fn paused_rules_agent_stops_at_six_rounds() {
    let (answer, count) = mock_agent("bounded").await;
    assert_eq!(count, 6);
    assert_eq!(answer.text, LOOKUP_LIMIT);
}

#[tokio::test]
#[ignore = "requires CHAT_TEST_DATABASE_URL pointing to a migrated local PostgreSQL database"]
async fn postgres_collection_thresholds_and_cached_rulebook_audit() {
    let database_url = env::var("CHAT_TEST_DATABASE_URL")
        .expect("Set CHAT_TEST_DATABASE_URL to migrated local PostgreSQL");
    let database_host = Url::parse(&database_url).unwrap();
    assert!(
        matches!(
            database_host.host_str(),
            Some("localhost" | "127.0.0.1" | "[::1]")
        ),
        "Chat tests refuse remote databases"
    );
    let db = sqlx::PgPool::connect(&database_url).await.unwrap();
    let state = state(db.clone());
    let users = [Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4()];
    let game = (Uuid::new_v4().as_u128() % 900_000_000) as i32 + 1_000_000_000;
    let name = format!("Synthetic chat {game}");
    for user in users {
        sqlx::query("INSERT INTO hub_user (id,password,username,display_name,first_name,last_name,email,avatar_url,is_superuser,is_staff,is_active,date_joined,updated_at) VALUES ($1,'!',$2,$2,'','','','',false,false,true,now(),now())")
            .bind(user).bind(user.to_string()).execute(&db).await.unwrap();
    }
    sqlx::query("INSERT INTO hub_game (bgg_id,name,description,image_url,thumbnail_url,category,categories,mechanics,designers,artists,publishers,alternate_names,expansions,suggested_players,language_dependence,fetched_at,created_at,bgg_rating) VALUES ($1,$2,'Synthetic description','','','board','[]','[]','[]','[]','[]','[]','[]','[]','',now(),now(),7)")
        .bind(game).bind(&name).execute(&db).await.unwrap();
    let user = CurrentUser {
        id: users[0],
        display_name: users[0].to_string(),
        email: String::new(),
        avatar_url: String::new(),
        is_staff: false,
        is_superuser: false,
        partner_id: None,
    };
    for (index, user_id) in users.into_iter().enumerate() {
        sqlx::query("INSERT INTO hub_usergame (id,created_at,user_id,game_id,owned,wishlist,wishlist_note,comment,tier,position,score,updated_at,legacy_ids,difficulty_position,difficulty_tier,difficulty_updated_at,tier_created_at) VALUES ($1,now(),$2,$3,false,false,'','','S',0,$4,now(),'{}',0,$5,now(),now())")
            .bind(Uuid::new_v4()).bind(user_id).bind(game).bind(10.0-index as f64*2.0).bind(1+index as i16*2).execute(&db).await.unwrap();
        let result = data_tool(
            &state,
            "never-used-synthetic-key",
            &user,
            "get_game_details",
            &json!({"game_names":[name]}),
        )
        .await
        .unwrap();
        assert_eq!(result["games"].as_array().unwrap().len(), 1);
        let row = &result["games"][0];
        assert_eq!(row["difficulty_votes"], index + 1);
        assert_eq!(row["difficulty"].as_f64().unwrap(), 1.0 + index as f64);
        if index < 2 {
            assert!(row["community"].is_null());
        } else {
            assert_eq!(row["community"], 8.0);
        }
    }
    let comparison = data_tool(
        &state,
        "never-used-synthetic-key",
        &user,
        "compare_scores",
        &json!({"compare_against":"bgg","direction":"user_higher"}),
    )
    .await
    .unwrap();
    assert_eq!(comparison["games"][0]["difference"], 3.0);
    let unranked = data_tool(
        &state,
        "never-used-synthetic-key",
        &user,
        "get_unranked_games",
        &json!({}),
    )
    .await
    .unwrap();
    assert!(
        !unranked["games"]
            .as_array()
            .unwrap()
            .iter()
            .any(|row| row["bgg_id"] == game)
    );
    let module = Uuid::new_v4();
    sqlx::query("INSERT INTO hub_rulebook (id,created_at,game_id,module_name,module_type,content_md,source,updated_at) VALUES ($1,now(),$2,'Base','base','Rule one.','synthetic',now())")
        .bind(module).bind(game).execute(&db).await.unwrap();
    let hash = modules_hash(
        &["expansion".into()],
        &[(module, "Base".into(), "Rule one.".into())],
    );
    sqlx::query("INSERT INTO hub_rulesanswer (id,created_at,game_id,modules_hash,question_norm,answer_md,citations) VALUES ($1,now(),$2,$3,'may i?','Cached verified answer.',$4)")
        .bind(Uuid::new_v4()).bind(game).bind(hash).bind(json!([{"source_type":"web","url":"https://example.org/rules","label":"Rulebook"}])).execute(&db).await.unwrap();
    let result = rules_answer(
        &state,
        "never-used-synthetic-key",
        &user,
        game,
        "  May I?  ",
        &json!([" Expansion ", "EXPANSION"]),
    )
    .await
    .unwrap();
    assert_eq!(result["answer"], "Cached verified answer.");
    assert_eq!(result["cache_hit"], true);
    assert_eq!(result["citations"].as_array().unwrap().len(), 1);
    let run: (bool, Value, String) =
        sqlx::query_as("SELECT cache_hit,tool_calls,answer_md FROM hub_rulesrun WHERE game_id=$1")
            .bind(game)
            .fetch_one(&db)
            .await
            .unwrap();
    assert_eq!(run, (true, json!([]), "Cached verified answer.".into()));

    for table in [
        "hub_rulesrun",
        "hub_rulesanswer",
        "hub_rulebook",
        "hub_usergame",
    ] {
        sqlx::query(&format!("DELETE FROM {table} WHERE game_id=$1"))
            .bind(game)
            .execute(&db)
            .await
            .unwrap();
    }
    sqlx::query("DELETE FROM hub_game WHERE bgg_id=$1")
        .bind(game)
        .execute(&db)
        .await
        .unwrap();
    sqlx::query("DELETE FROM hub_user WHERE id=ANY($1)")
        .bind(users.to_vec())
        .execute(&db)
        .await
        .unwrap();
    db.close().await;
}
