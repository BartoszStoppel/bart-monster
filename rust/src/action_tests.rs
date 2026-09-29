//! HTTP integration tests use only synthetic data in disposable local PostgreSQL schemas.

use crate::{
    AppState,
    auth::{AuthConfig, AuthState},
    ranking_store,
};
use axum::{
    Router,
    body::{Body, to_bytes},
    http::{Request, StatusCode},
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use chrono::{NaiveDate, Utc};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::{PgPool, postgres::PgPoolOptions};
use std::{sync::Arc, time::Duration};
use tower::ServiceExt;
use uuid::Uuid;

const ORIGIN: &str = "http://localhost:3000";

#[test]
fn database_options_rejects_supabase_transaction_pool_endpoints() {
    for endpoint in [
        "aws-0-test.pooler.supabase.com:6543/test",
        "db.test.supabase.co:6543/test",
        "AWS-0-TEST.POOLER.SUPABASE.COM.:6543/test",
        "DB.TEST.SUPABASE.CO.:6543/test",
        "aws-0-test.pooler.supabase.com:5432/test?port=6543",
        "127.0.0.1:5432/test?host=aws-0-test.pooler.supabase.com&port=6543",
        "127.0.0.1:5432/test?port=6543&host=DB.TEST.SUPABASE.CO.",
    ] {
        let url = format!("postgresql://test:synthetic-secret@{endpoint}");
        let error = crate::database_options(&url).unwrap_err().to_string();
        assert_eq!(
            error, "SQLx requires the Supabase session pooler on port 5432.",
            "guard should reject the effective endpoint: {endpoint}"
        );
        assert!(!error.contains("synthetic-secret"));
    }
}

#[test]
fn database_options_accepts_session_and_local_connections_using_effective_ports() {
    for (endpoint, host, port) in [
        (
            "aws-0-test.pooler.supabase.com:5432/test",
            "aws-0-test.pooler.supabase.com",
            5432,
        ),
        ("db.test.supabase.co:5432/test", "db.test.supabase.co", 5432),
        ("127.0.0.1:5432/test", "127.0.0.1", 5432),
        ("127.0.0.1:6543/test", "127.0.0.1", 6543),
        (
            "aws-0-test.pooler.supabase.com:6543/test?port=5432",
            "aws-0-test.pooler.supabase.com",
            5432,
        ),
        (
            "aws-0-test.pooler.supabase.com:6543/test?host=127.0.0.1",
            "127.0.0.1",
            6543,
        ),
    ] {
        let options = crate::database_options(&format!("postgresql://test@{endpoint}")).unwrap();
        assert_eq!(options.get_host(), host);
        assert_eq!(options.get_port(), port);
    }
}

#[test]
fn database_options_preserves_tls_role_database_and_schema_options() {
    let options = crate::database_options(
        "postgresql://private_role.testref:synthetic-secret@aws-0-test.pooler.supabase.com:5432/postgres?sslmode=require&options=-c%20search_path%3Dprivate_schema",
    ).unwrap();
    assert_eq!(options.get_username(), "private_role.testref");
    assert_eq!(options.get_database(), Some("postgres"));
    assert!(matches!(
        options.get_ssl_mode(),
        sqlx::postgres::PgSslMode::Require
    ));
    assert!(
        options
            .get_options()
            .unwrap()
            .contains("search_path=private_schema")
    );
}

struct Actor {
    id: Uuid,
    cookie: String,
    csrf: String,
}
struct Fixture {
    db: PgPool,
    admin_db: PgPool,
    schema: String,
    app: Router,
    user: Actor,
    other: Actor,
    staff: Actor,
}

impl Fixture {
    async fn new() -> Self {
        let raw = std::env::var("ACTION_TEST_DATABASE_URL")
            .expect("Set ACTION_TEST_DATABASE_URL to the disposable bart_actions_test database");
        let url = url::Url::parse(&raw).unwrap();
        assert!(
            matches!(url.host_str(), Some("localhost" | "127.0.0.1")),
            "action tests only allow local databases"
        );
        assert_eq!(
            url.path(),
            "/bart_actions_test",
            "action tests require their dedicated disposable database"
        );
        let admin_db = PgPoolOptions::new()
            .max_connections(1)
            .connect(&raw)
            .await
            .unwrap();
        let schema = format!("action_test_{}", Uuid::new_v4().simple());
        sqlx::query(&format!("CREATE SCHEMA {schema}"))
            .execute(&admin_db)
            .await
            .unwrap();
        let connection_schema = schema.clone();
        let db = PgPoolOptions::new()
            .max_connections(4)
            .after_connect(move |connection, _| {
                let sql = format!("SET search_path TO {connection_schema},pg_catalog");
                Box::pin(async move {
                    sqlx::query(&sql).execute(connection).await?;
                    Ok(())
                })
            })
            .connect(&raw)
            .await
            .unwrap();
        sqlx::raw_sql(include_str!("../migrations/0001_application.sql"))
            .execute(&db)
            .await
            .unwrap();
        sqlx::raw_sql(include_str!("../migrations/0005_rust_sessions.sql"))
            .execute(&db)
            .await
            .unwrap();
        // Even an accidental upstream request can only reach a closed loopback proxy.
        let http = reqwest::Client::builder()
            .proxy(reqwest::Proxy::all("http://127.0.0.1:9").unwrap())
            .timeout(Duration::from_millis(250))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .unwrap();
        let auth = AuthState {
            db: db.clone(),
            http: http.clone(),
            config: Arc::new(AuthConfig {
                app_origin: ORIGIN.into(),
                supabase_url: "http://127.0.0.1:9".into(),
                supabase_anon_key: "synthetic-test-key".into(),
                secure_cookies: false,
            }),
        };
        let app = crate::router(AppState {
            db: db.clone(),
            http,
            auth,
        });
        let user = Self::actor(&db, "Owner", false).await;
        let other = Self::actor(&db, "Other", false).await;
        let staff = Self::actor(&db, "Admin", true).await;
        let fixture = Self {
            db,
            admin_db,
            schema,
            app,
            user,
            other,
            staff,
        };
        for id in 1..=3 {
            fixture.game(id).await;
        }
        fixture
    }

    async fn actor(db: &PgPool, name: &str, staff: bool) -> Actor {
        let id = Uuid::new_v4();
        sqlx::query("INSERT INTO hub_user (id,password,username,display_name,email,first_name,last_name,avatar_url,is_superuser,is_staff,is_active,date_joined,updated_at) VALUES($1,'!',$2,$3,$4,'','','',$5,$5,true,now(),now())")
            .bind(id).bind(id.to_string()).bind(name).bind(format!("{}@example.test",name.to_lowercase())).bind(staff).execute(db).await.unwrap();
        let token = URL_SAFE_NO_PAD.encode(Sha256::digest(id.as_bytes()));
        let csrf = URL_SAFE_NO_PAD.encode(Sha256::digest(format!("csrf:{id}")));
        let hash = URL_SAFE_NO_PAD.encode(Sha256::digest(token.as_bytes()));
        sqlx::query("INSERT INTO hub_rustsession(session_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,now()+interval '1 day')")
            .bind(hash).bind(id).bind(&csrf).execute(db).await.unwrap();
        Actor {
            id,
            cookie: format!("bart_session={token}"),
            csrf,
        }
    }

    async fn game(&self, id: i32) {
        sqlx::query("INSERT INTO hub_game(bgg_id,name,description,image_url,thumbnail_url,category,min_players,max_players,playing_time,categories,mechanics,designers,artists,publishers,alternate_names,expansions,suggested_players,language_dependence,created_at,fetched_at) VALUES($1,$2,'Original description','','','board',2,4,60,'[]','[]','[]','[]','[]','[]','[]','[]','','2001-01-01Z','2002-01-01Z')")
            .bind(id).bind(format!("Game {id}")).execute(&self.db).await.unwrap();
    }

    async fn request(
        &self,
        actor: Option<&Actor>,
        method: &str,
        path: &str,
        body: Option<Value>,
        csrf: Option<&str>,
        origin: Option<&str>,
    ) -> (StatusCode, Value) {
        let mut request = Request::builder().method(method).uri(path);
        if let Some(actor) = actor {
            request = request.header("Cookie", &actor.cookie);
        }
        if let Some(csrf) = csrf {
            request = request.header("x-csrf-token", csrf);
        }
        if let Some(origin) = origin {
            request = request.header("Origin", origin);
        }
        let request = if let Some(body) = body {
            request
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap()
        } else {
            request.body(Body::empty()).unwrap()
        };
        let response = self.app.clone().oneshot(request).await.unwrap();
        let status = response.status();
        let bytes = to_bytes(response.into_body(), 32 * 1024 * 1024)
            .await
            .unwrap();
        let json = serde_json::from_slice(&bytes).unwrap_or_else(|_| {
            panic!(
                "non-JSON response {status}: {}",
                String::from_utf8_lossy(&bytes)
            )
        });
        (status, json)
    }

    async fn get(&self, actor: &Actor, path: &str) -> (StatusCode, Value) {
        self.request(Some(actor), "GET", path, None, None, None)
            .await
    }
    async fn post(&self, actor: &Actor, path: &str, body: Value) -> (StatusCode, Value) {
        self.request(
            Some(actor),
            "POST",
            path,
            Some(body),
            Some(&actor.csrf),
            Some(ORIGIN),
        )
        .await
    }
    async fn action(&self, actor: &Actor, name: &str, args: Value) -> (StatusCode, Value) {
        self.post(actor, "/api/actions", json!({"action":name,"args":args}))
            .await
    }
    async fn ok_action(&self, actor: &Actor, name: &str, args: Value) {
        let (status, body) = self.action(actor, name, args).await;
        assert_eq!(status, StatusCode::OK, "{name}: {body}");
    }
    async fn rank(&self, actor: &Actor, metric: &str, category: &str, entries: Value) -> Value {
        let path = format!("/api/rankings/{metric}/{category}");
        let (status, state) = self.get(actor, &path).await;
        assert_eq!(status, StatusCode::OK, "{state}");
        let (status, saved) = self
            .post(
                actor,
                &path,
                json!({"entries":entries,"revision":state["revision"]}),
            )
            .await;
        assert_eq!(status, StatusCode::OK, "{saved}");
        saved
    }
    async fn association(&self, actor: &Actor, game: i32) -> Option<Value> {
        sqlx::query_scalar("SELECT to_jsonb(p) FROM hub_usergame p WHERE user_id=$1 AND game_id=$2")
            .bind(actor.id)
            .bind(game)
            .fetch_optional(&self.db)
            .await
            .unwrap()
    }
    async fn feedback(&self, actor: &Actor, title: &str) -> Uuid {
        self.ok_action(
            actor,
            "submitFeedback",
            json!({"title":title,"description":"Synthetic feedback","category":"bug"}),
        )
        .await;
        sqlx::query_scalar("SELECT id FROM hub_feedback WHERE user_id=$1 AND title=$2")
            .bind(actor.id)
            .bind(title)
            .fetch_one(&self.db)
            .await
            .unwrap()
    }
    async fn finish(self) {
        self.db.close().await;
        sqlx::query(&format!("DROP SCHEMA {} CASCADE", self.schema))
            .execute(&self.admin_db)
            .await
            .unwrap();
        self.admin_db.close().await;
    }
}

#[tokio::test]
#[ignore = "requires ACTION_TEST_DATABASE_URL for local bart_actions_test"]
async fn collection_edits_preserve_dates_rankings_notes_and_prune_only_empty_rows() {
    let f = Fixture::new().await;
    f.rank(
        &f.user,
        "enjoyment",
        "board",
        json!([{"id":1,"tier":"S"},{"id":2,"tier":"A"},{"id":3,"tier":"F"}]),
    )
    .await;
    f.rank(&f.user, "difficulty", "board", json!([{"id":1,"tier":"4"}]))
        .await;
    f.ok_action(&f.user,"updateCollection",json!({"bggId":1,"owned":true,"wishlist":true,"wishlist_priority":2,"wishlist_note":"Keep this note","user_id":f.other.id})).await;
    f.ok_action(
        &f.user,
        "updateRating",
        json!({"bggId":1,"rating":8,"comment":"Keep this review"}),
    )
    .await;
    sqlx::query("UPDATE hub_usergame SET collection_added_at='2001-02-03T04:05:06Z' WHERE user_id=$1 AND game_id=1").bind(f.user.id).execute(&f.db).await.unwrap();
    let original = f.association(&f.user, 1).await.unwrap();
    f.ok_action(&f.user, "removeFromWishlist", json!({"bggId":1}))
        .await;
    let changed = f.association(&f.user, 1).await.unwrap();
    for key in [
        "collection_added_at",
        "owned",
        "wishlist_priority",
        "wishlist_note",
        "tier",
        "position",
        "score",
        "difficulty_tier",
        "difficulty_position",
        "rating",
        "comment",
        "rating_created_at",
    ] {
        assert_eq!(changed[key], original[key], "preserve {key}");
    }
    assert_eq!(changed["wishlist"], false);
    assert!(
        f.association(&f.other, 1).await.is_none(),
        "browser-supplied identity cannot choose an owner"
    );
    // The original wishlist editor sends JSON null when its note is cleared.
    f.ok_action(
        &f.user,
        "updateCollection",
        json!({"bggId":1,"wishlist_note":null}),
    )
    .await;
    let cleared = f.association(&f.user, 1).await.unwrap();
    assert_eq!(cleared["wishlist_note"], "");
    for key in [
        "collection_added_at",
        "wishlist_priority",
        "rating",
        "comment",
        "tier",
        "difficulty_tier",
    ] {
        assert_eq!(
            cleared[key], original[key],
            "clearing a note preserves {key}"
        );
    }
    f.ok_action(
        &f.user,
        "updateCollection",
        json!({"bggId":1,"owned":false,"wishlist_priority":null,"wishlist_note":""}),
    )
    .await;
    f.ok_action(
        &f.user,
        "updateRating",
        json!({"bggId":1,"rating":null,"comment":""}),
    )
    .await;
    assert!(f.association(&f.user, 1).await.is_some());
    f.rank(
        &f.user,
        "enjoyment",
        "board",
        json!([{"id":2,"tier":"S"},{"id":3,"tier":"F"}]),
    )
    .await;
    assert_eq!(
        f.association(&f.user, 1).await.unwrap()["difficulty_tier"],
        4
    );
    f.rank(&f.user, "difficulty", "board", json!([])).await;
    assert!(f.association(&f.user, 1).await.is_none());
    assert_eq!(f.association(&f.user, 2).await.unwrap()["score"], 10.0);
    assert_eq!(f.association(&f.user, 3).await.unwrap()["score"], 1.0);
    f.finish().await;
}

#[tokio::test]
#[ignore = "requires ACTION_TEST_DATABASE_URL for local bart_actions_test"]
async fn feedback_owners_can_delete_only_their_new_items_and_staff_can_moderate() {
    let f = Fixture::new().await;
    let id = f.feedback(&f.user, "New feedback").await;
    assert_eq!(
        f.action(&f.other, "deleteFeedback", json!({"feedbackId":id}))
            .await
            .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        f.action(
            &f.user,
            "updateFeedbackStatus",
            json!({"feedbackId":id,"status":"done"})
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    f.ok_action(&f.user, "deleteFeedback", json!({"feedbackId":id}))
        .await;
    assert!(
        !sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM hub_feedback WHERE id=$1)")
            .bind(id)
            .fetch_one(&f.db)
            .await
            .unwrap()
    );
    let id = f.feedback(&f.user, "Planned feedback").await;
    f.ok_action(
        &f.staff,
        "updateFeedbackStatus",
        json!({"feedbackId":id,"status":"planned","adminNote":"Acknowledged"}),
    )
    .await;
    assert_eq!(
        f.action(&f.user, "deleteFeedback", json!({"feedbackId":id}))
            .await
            .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        sqlx::query_scalar::<_, String>("SELECT admin_note FROM hub_feedback WHERE id=$1")
            .bind(id)
            .fetch_one(&f.db)
            .await
            .unwrap(),
        "Acknowledged"
    );
    f.ok_action(&f.staff, "deleteFeedback", json!({"feedbackId":id}))
        .await;
    f.finish().await;
}

#[tokio::test]
#[ignore = "requires ACTION_TEST_DATABASE_URL for local bart_actions_test"]
async fn duplicate_game_additions_are_offline_noops_and_refresh_is_staff_only() {
    let f = Fixture::new().await;
    let original:Value=sqlx::query_scalar("SELECT to_jsonb(g)||jsonb_build_object('version',xmin::text) FROM hub_game g WHERE bgg_id=1").fetch_one(&f.db).await.unwrap();
    for actor in [&f.user, &f.other, &f.staff] {
        f.ok_action(
            actor,
            "addGame",
            json!({"game":{"bgg_id":1,"name":"Forged name","min_players":99},"category":"party"}),
        )
        .await;
    }
    assert_eq!(
        f.action(
            &f.user,
            "refreshGame",
            json!({"game":{"id":1},"category":"board"})
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    // The blocked proxy makes a refresh fail locally and proves external metadata is not fabricated.
    assert_eq!(
        f.action(
            &f.staff,
            "refreshGame",
            json!({"game":{"id":1},"category":"board"})
        )
        .await
        .0,
        StatusCode::BAD_GATEWAY
    );
    assert_eq!(original,sqlx::query_scalar::<_,Value>("SELECT to_jsonb(g)||jsonb_build_object('version',xmin::text) FROM hub_game g WHERE bgg_id=1").fetch_one(&f.db).await.unwrap());
    f.finish().await;
}

#[tokio::test]
#[ignore = "requires ACTION_TEST_DATABASE_URL for local bart_actions_test"]
async fn game_edits_allow_unknown_metadata_but_reject_invalid_present_values() {
    let f = Fixture::new().await;
    f.ok_action(
        &f.staff,
        "updateGame",
        json!({"bggId":1,"category":"board","minPlayers":null,"maxPlayers":null,"playingTime":null}),
    )
    .await;
    let cleared: Value = sqlx::query_scalar("SELECT to_jsonb(g) FROM hub_game g WHERE bgg_id=1")
        .fetch_one(&f.db)
        .await
        .unwrap();
    for key in ["min_players", "max_players", "playing_time"] {
        assert!(cleared[key].is_null(), "metadata can be unknown: {key}");
    }
    assert_eq!(cleared["name"], "Game 1");
    assert_eq!(cleared["description"], "Original description");
    // A single known endpoint is valid; ordering is checked only when both are known.
    f.ok_action(
        &f.staff,
        "updateGame",
        json!({"bggId":1,"category":"board","minPlayers":null,"maxPlayers":4,"playingTime":60}),
    )
    .await;
    let before: Value = sqlx::query_scalar("SELECT to_jsonb(g) FROM hub_game g WHERE bgg_id=1")
        .fetch_one(&f.db)
        .await
        .unwrap();
    for patch in [
        json!({"minPlayers":0}),
        json!({"maxPlayers":100}),
        json!({"playingTime":10000}),
        json!({"playingTime":"60"}),
        json!({"minPlayers":5,"maxPlayers":4}),
    ] {
        let mut args =
            json!({"bggId":1,"category":"party","minPlayers":2,"maxPlayers":4,"playingTime":60});
        args.as_object_mut()
            .unwrap()
            .extend(patch.as_object().unwrap().clone());
        let (status, body) = f.action(&f.staff, "updateGame", args).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "invalid metadata: {body}");
    }
    let (status, _) = f
        .action(
            &f.staff,
            "updateGame",
            json!({"bggId":1,"category":"party","minPlayers":null,"maxPlayers":null}),
        )
        .await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "missing fields must not silently clear metadata"
    );
    let after: Value = sqlx::query_scalar("SELECT to_jsonb(g) FROM hub_game g WHERE bgg_id=1")
        .fetch_one(&f.db)
        .await
        .unwrap();
    assert_eq!(
        before, after,
        "invalid updates are atomic, including category"
    );
    f.finish().await;
}

#[tokio::test]
#[ignore = "requires ACTION_TEST_DATABASE_URL for local bart_actions_test"]
async fn category_changes_and_catalog_deletes_recompute_scores_without_rewriting_yesterday() {
    let f = Fixture::new().await;
    f.rank(
        &f.user,
        "enjoyment",
        "board",
        json!([{"id":1,"tier":"S"},{"id":2,"tier":"A"},{"id":3,"tier":"F"}]),
    )
    .await;
    f.rank(
        &f.other,
        "enjoyment",
        "board",
        json!([{"id":3,"tier":"S"},{"id":2,"tier":"A"},{"id":1,"tier":"F"}]),
    )
    .await;
    f.rank(
        &f.user,
        "difficulty",
        "board",
        json!([{"id":1,"tier":"2"},{"id":2,"tier":"5"}]),
    )
    .await;
    f.rank(
        &f.other,
        "difficulty",
        "board",
        json!([{"id":1,"tier":"6"}]),
    )
    .await;
    let today = ranking_store::local_day(Utc::now());
    let yesterday = today.pred_opt().unwrap();
    sqlx::query("INSERT INTO hub_dailyscore(metric,user_id,game_id,day,score,imported) SELECT metric,user_id,game_id,$1,score,imported FROM hub_dailyscore WHERE day=$2").bind(yesterday).bind(today).execute(&f.db).await.unwrap();
    f.ok_action(
        &f.staff,
        "updateCategory",
        json!({"bggId":2,"category":"party"}),
    )
    .await;
    for actor in [&f.user, &f.other] {
        assert_eq!(f.association(actor, 2).await.unwrap()["score"], 10.0);
    }
    let points:Vec<(NaiveDate,f64)>=sqlx::query_as("SELECT day,score FROM hub_dailyscore WHERE user_id IS NULL AND metric='enjoyment' AND game_id=2 ORDER BY day").fetch_all(&f.db).await.unwrap();
    assert_eq!(points, vec![(yesterday, 5.5), (today, 10.0)]);

    f.ok_action(
        &f.staff,
        "addExpansionsToBank",
        json!({"gameBggId":1,"expansions":[{"name":"Synthetic expansion"}]}),
    )
    .await;
    let expansion: Uuid = sqlx::query_scalar("SELECT id FROM hub_expansion WHERE game_id=1")
        .fetch_one(&f.db)
        .await
        .unwrap();
    let (status, board) = f.get(&f.user, "/api/expansion-rankings/1").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        f.post(
            &f.user,
            "/api/expansion-rankings/1",
            json!({"revision":board["revision"],"entries":[{"id":expansion,"tier":"S"}]})
        )
        .await
        .0,
        StatusCode::OK
    );
    f.ok_action(&f.staff,"saveGameRules",json!({"bggId":1,"moduleName":"Base","moduleType":"base","contentMd":"Synthetic rules","source":"test"})).await;
    sqlx::query("INSERT INTO hub_rulesanswer(id,created_at,game_id,modules_hash,question_norm,answer_md,citations) VALUES($1,now(),1,$2,'question','answer','[]')").bind(Uuid::new_v4()).bind("a".repeat(64)).execute(&f.db).await.unwrap();
    sqlx::query("INSERT INTO hub_rulesrun(id,created_at,game_id,user_id,question,answer_md,citations,tool_calls,cache_hit) VALUES($1,now(),1,$2,'question','answer','[]','[]',false)").bind(Uuid::new_v4()).bind(f.user.id).execute(&f.db).await.unwrap();
    f.ok_action(&f.staff, "deleteGame", json!({"bggId":1}))
        .await;
    for table in [
        "hub_game",
        "hub_expansion",
        "hub_rulebook",
        "hub_rulesanswer",
        "hub_rulesrun",
        "hub_expansionplacement",
    ] {
        let column = if table == "hub_game" {
            "bgg_id"
        } else if table == "hub_expansionplacement" {
            "expansion_id"
        } else {
            "game_id"
        };
        let sql = format!("SELECT COUNT(*) FROM {table} WHERE {column}=$1");
        let query = sqlx::query_scalar::<_, i64>(&sql);
        let count = if table == "hub_expansionplacement" {
            query.bind(expansion).fetch_one(&f.db).await.unwrap()
        } else {
            query.bind(1i32).fetch_one(&f.db).await.unwrap()
        };
        assert_eq!(count, 0, "deleted game dependent table {table}");
    }
    assert_eq!(f.association(&f.user, 3).await.unwrap()["score"], 10.0);
    assert_eq!(f.association(&f.other, 3).await.unwrap()["score"], 10.0);
    assert_eq!(
        f.association(&f.user, 2).await.unwrap()["difficulty_tier"],
        5
    );
    let points:Vec<(NaiveDate,f64)>=sqlx::query_as("SELECT day,score FROM hub_dailyscore WHERE user_id=$1 AND metric='enjoyment' AND game_id=3 ORDER BY day").bind(f.user.id).fetch_all(&f.db).await.unwrap();
    assert_eq!(points, vec![(yesterday, 1.0), (today, 10.0)]);
    assert_eq!(sqlx::query_scalar::<_,f64>("SELECT score FROM hub_dailyscore WHERE user_id IS NULL AND metric='enjoyment' AND game_id=3 AND day=$1").bind(today).fetch_one(&f.db).await.unwrap(),10.0);
    f.finish().await;
}

#[tokio::test]
#[ignore = "requires ACTION_TEST_DATABASE_URL for local bart_actions_test"]
async fn malformed_unauthorized_and_cross_origin_mutations_are_rejected_atomically() {
    let f = Fixture::new().await;
    let body = json!({"action":"updateProfile","args":{"display_name":"Changed"}});
    assert_eq!(
        f.request(
            None,
            "POST",
            "/api/actions",
            Some(body.clone()),
            Some(&f.user.csrf),
            Some(ORIGIN)
        )
        .await
        .0,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        f.request(
            Some(&f.user),
            "POST",
            "/api/actions",
            Some(body.clone()),
            None,
            Some(ORIGIN)
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        f.request(
            Some(&f.user),
            "POST",
            "/api/actions",
            Some(body),
            Some(&f.user.csrf),
            Some("https://other.example")
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    for (name, args) in [
        ("updateCollection", json!({"bggId":1,"owned":"yes"})),
        ("updateCollection", json!({"bggId":1,"wishlist_priority":4})),
        ("updateRating", json!({"bggId":1,"rating":11})),
        ("updateCollection", json!({"bggId":-1,"owned":true})),
        (
            "updateCollection",
            json!({"bggId":2_147_483_648_i64,"owned":true}),
        ),
        ("updateProfile", json!({"display_name":"   "})),
        (
            "submitFeedback",
            json!({"title":"","description":"Test","category":"bug"}),
        ),
        ("unknownAction", json!({})),
    ] {
        assert_eq!(
            f.action(&f.user, name, args).await.0,
            StatusCode::BAD_REQUEST,
            "{name}"
        );
    }
    assert_eq!(
        f.post(
            &f.user,
            "/api/actions",
            json!({"action":"updateCollection","args":[]})
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    for (name, args) in [
        ("deleteGame", json!({"bggId":1})),
        ("updateCategory", json!({"bggId":1,"category":"party"})),
        (
            "setUserAdmin",
            json!({"targetUserId":f.user.id,"newValue":true}),
        ),
        (
            "addExpansionsToBank",
            json!({"gameBggId":1,"expansions":[{"name":"Test"}]}),
        ),
        (
            "saveGameRules",
            json!({"bggId":1,"moduleName":"Base","moduleType":"base","contentMd":"Test"}),
        ),
    ] {
        assert_eq!(
            f.action(&f.user, name, args).await.0,
            StatusCode::FORBIDDEN,
            "{name}"
        );
    }
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM hub_usergame")
            .fetch_one(&f.db)
            .await
            .unwrap(),
        0,
        "failed personal edits roll back the provisional association"
    );
    assert_eq!(
        sqlx::query_scalar::<_, String>("SELECT display_name FROM hub_user WHERE id=$1")
            .bind(f.user.id)
            .fetch_one(&f.db)
            .await
            .unwrap(),
        "Owner"
    );
    f.finish().await;
}

#[tokio::test]
#[ignore = "requires ACTION_TEST_DATABASE_URL for local bart_actions_test"]
async fn bootstrap_redacts_other_emails_and_rule_content_for_regular_players() {
    let f = Fixture::new().await;
    f.ok_action(&f.staff,"saveGameRules",json!({"bggId":1,"moduleName":"Base","moduleType":"base","contentMd":"Rule-content-sentinel","source":"test"})).await;
    let (status, body) = f.get(&f.user, "/api/bootstrap").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let profiles = body["tables"]["profiles"].as_array().unwrap();
    for profile in profiles {
        if profile["id"] == f.user.id.to_string() {
            assert_eq!(profile["email"], "owner@example.test");
        } else {
            assert!(profile["email"].is_null());
        }
        assert!(profile.get("password").is_none());
    }
    assert_eq!(body["tables"]["game_rules"], json!([]));
    assert!(!body.to_string().contains("Rule-content-sentinel"));
    assert!(!body.to_string().contains("other@example.test"));
    let (status, body) = f.get(&f.staff, "/api/bootstrap").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        body["tables"]["game_rules"][0]["content_md"],
        "Rule-content-sentinel"
    );
    assert!(body.to_string().contains("other@example.test"));
    f.finish().await;
}

#[tokio::test]
#[ignore = "requires ACTION_TEST_DATABASE_URL for local bart_actions_test"]
async fn history_keeps_every_daily_record_null_and_metric_scope_without_global_limit() {
    let f = Fixture::new().await;
    sqlx::query("INSERT INTO hub_dailyscore(metric,user_id,game_id,day,score,imported) SELECT 'enjoyment',$1,1,date '1800-01-01'+i,CASE WHEN i=25000 THEN NULL WHEN i%2=0 THEN 9 ELSE 2 END,true FROM generate_series(0,50000) i").bind(f.user.id).execute(&f.db).await.unwrap();
    sqlx::query("INSERT INTO hub_dailyscore(metric,user_id,game_id,day,score,imported) VALUES ('difficulty',$1,1,'2010-01-01',6,false),('difficulty',$1,1,'2010-01-02',2,false),('enjoyment',$2,1,'2010-01-01',4,false),('enjoyment',NULL,1,'2010-01-01',3,false),('enjoyment',$1,2,'2010-01-01',7,false)").bind(f.user.id).bind(f.other.id).execute(&f.db).await.unwrap();
    let (status, body) = f
        .get(
            &f.user,
            &format!(
                "/api/history?metric=enjoyment&bgg_id=1&user_id={}",
                f.user.id
            ),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    let rows = body.as_array().unwrap();
    assert_eq!(rows.len(), 50_001);
    assert_eq!(rows[0]["day"], "1800-01-01");
    assert_eq!(rows[0]["score"], 9.0);
    assert_eq!(rows[1]["score"], 2.0);
    assert!(rows[25_000]["score"].is_null());
    assert_eq!(
        rows[50_000]["day"],
        (NaiveDate::from_ymd_opt(1800, 1, 1).unwrap() + chrono::Duration::days(50_000)).to_string()
    );
    assert!(rows.iter().all(|row| row["metric"] == "enjoyment"
        && row["bgg_id"] == 1
        && row["user_id"] == f.user.id.to_string()));
    let (status, difficulty) = f
        .get(
            &f.user,
            &format!(
                "/api/history?metric=difficulty&bgg_id=1&user_id={}",
                f.user.id
            ),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        difficulty
            .as_array()
            .unwrap()
            .iter()
            .map(|row| row["score"].as_f64().unwrap())
            .collect::<Vec<_>>(),
        vec![6.0, 2.0]
    );
    let (status, community) = f
        .get(
            &f.user,
            "/api/history?metric=enjoyment&bgg_id=1&user_id=community",
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(community.as_array().unwrap().len(), 1);
    assert!(community[0]["user_id"].is_null());
    let (status, body) = f
        .get(&f.user, "/api/history?metric=enjoyment&bgg_id=2")
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body.as_array().unwrap().len(), 1);
    assert_eq!(
        f.get(&f.user, "/api/history?metric=unknown").await.0,
        StatusCode::BAD_REQUEST
    );
    f.finish().await;
}
