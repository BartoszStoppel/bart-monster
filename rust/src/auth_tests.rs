//! Run explicitly against disposable local PostgreSQL: AUTH_TEST_DATABASE_URL=… cargo test --lib auth::integration_tests -- --ignored
use super::*;
use axum::{body::Body, http::Request};
use http_body_util::BodyExt;
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use std::str::FromStr;
use tower::ServiceExt;

async fn request(
    app: &Router,
    path: &str,
    method: &str,
    cookie: Option<&str>,
    csrf: Option<&str>,
    origin: &str,
) -> (StatusCode, HeaderMap, Value) {
    let mut builder = Request::builder().uri(path).method(method);
    if let Some(cookie) = cookie {
        builder = builder.header(header::COOKIE, cookie);
    }
    if let Some(csrf) = csrf {
        builder = builder.header("x-csrf-token", csrf);
    }
    if method == "POST" {
        builder = builder.header(header::ORIGIN, origin);
    }
    let response = app
        .clone()
        .oneshot(builder.body(Body::empty()).unwrap())
        .await
        .unwrap();
    let (parts, body) = response.into_parts();
    let bytes = body.collect().await.unwrap().to_bytes();
    (
        parts.status,
        parts.headers,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}

fn cookie(headers: &HeaderMap) -> String {
    headers[header::SET_COOKIE]
        .to_str()
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .to_string()
}

async fn begin_login(app: &Router, origin: &str) -> (String, String, String) {
    let (status, headers, session) = request(app, "/api/session", "GET", None, None, origin).await;
    assert_eq!(status, StatusCode::OK);
    let cookie = cookie(&headers);
    let csrf = session["csrf_token"].as_str().unwrap().to_string();
    let (status, _, response) = request(
        app,
        "/api/auth/google",
        "POST",
        Some(&cookie),
        Some(&csrf),
        origin,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let authorize = Url::parse(response["redirect_url"].as_str().unwrap()).unwrap();
    assert!(
        authorize
            .query_pairs()
            .any(|(k, v)| k == "provider" && v == "google")
    );
    assert!(
        authorize
            .query_pairs()
            .any(|(k, v)| k == "code_challenge_method" && v == "s256")
    );
    let redirect = authorize
        .query_pairs()
        .find(|(k, _)| k == "redirect_to")
        .unwrap()
        .1
        .to_string();
    let redirect = Url::parse(&redirect).unwrap();
    assert_eq!(redirect.origin().ascii_serialization(), origin);
    let state = redirect
        .query_pairs()
        .find(|(k, _)| k == "state")
        .unwrap()
        .1
        .to_string();
    (
        cookie,
        csrf,
        format!("/callback?code=synthetic-code&state={state}"),
    )
}

#[tokio::test]
#[ignore = "requires AUTH_TEST_DATABASE_URL pointing to disposable local PostgreSQL"]
async fn postgres_pkce_sessions_permissions_and_expiry() {
    let database_url = env::var("AUTH_TEST_DATABASE_URL")
        .expect("Set AUTH_TEST_DATABASE_URL to disposable local PostgreSQL");
    let database_host = Url::parse(&database_url).unwrap();
    assert!(
        matches!(
            database_host.host_str(),
            Some("localhost" | "127.0.0.1" | "[::1]")
        ),
        "Auth tests refuse remote databases"
    );
    let admin = PgPool::connect(&database_url).await.unwrap();
    let schema = format!("auth_test_{}", Uuid::new_v4().simple());
    sqlx::raw_sql(&format!("CREATE SCHEMA {schema}"))
        .execute(&admin)
        .await
        .unwrap();
    let options = PgConnectOptions::from_str(&database_url)
        .unwrap()
        .options([("search_path", schema.as_str())]);
    let db = PgPoolOptions::new()
        .max_connections(3)
        .connect_with(options)
        .await
        .unwrap();
    sqlx::raw_sql("CREATE TABLE hub_user (id uuid PRIMARY KEY, password text NOT NULL,last_login timestamptz,is_superuser boolean NOT NULL,username text UNIQUE NOT NULL,first_name text NOT NULL,last_name text NOT NULL,email text NOT NULL,is_staff boolean NOT NULL,is_active boolean NOT NULL,date_joined timestamptz NOT NULL,display_name text NOT NULL,avatar_url text NOT NULL,updated_at timestamptz NOT NULL,partner_id uuid)")
        .execute(&db).await.unwrap();
    sqlx::raw_sql(include_str!("../migrations/0005_rust_sessions.sql"))
        .execute(&db)
        .await
        .unwrap();
    let identity = Uuid::new_v4();
    let provider = Router::new().route("/auth/v1/token",post(move |Json(input):Json<Value>| async move {
        assert_eq!(input["auth_code"],"synthetic-code");
        assert_eq!(input["code_verifier"].as_str().unwrap().len(),43);
        Json(json!({"user":{"id":identity,"email":"synthetic@example.invalid","user_metadata":{"full_name":"Synthetic OAuth","is_staff":true,"is_superuser":true,"avatar_url":"javascript:alert(1)"}}}))
    }));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let provider_url = format!("http://{}", listener.local_addr().unwrap());
    let server = tokio::spawn(async move {
        axum::serve(listener, provider).await.unwrap();
    });
    let origin = "http://localhost:3000";
    let state = AuthState {
        db: db.clone(),
        http: Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .unwrap(),
        config: Arc::new(AuthConfig {
            app_origin: origin.into(),
            supabase_url: provider_url,
            supabase_anon_key: "synthetic".into(),
            secure_cookies: false,
        }),
    };
    let app = router()
        .route(
            "/private",
            get(|user: CurrentUser| async move { Json(user) }),
        )
        .with_state(state);

    let (old_cookie, csrf, callback) = begin_login(&app, origin).await;
    assert_eq!(
        request(&app, "/private", "GET", Some(&old_cookie), None, origin)
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        request(
            &app,
            "/api/auth/google",
            "POST",
            Some(&old_cookie),
            None,
            origin
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        request(
            &app,
            "/api/auth/google",
            "POST",
            Some(&old_cookie),
            Some(&csrf),
            "https://attacker.invalid"
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    let wrong_state = format!("/callback?code=synthetic-code&state={}", "x".repeat(43));
    assert_eq!(
        request(&app, &wrong_state, "GET", Some(&old_cookie), None, origin)
            .await
            .0,
        StatusCode::BAD_REQUEST
    );
    let (status, headers, _) =
        request(&app, &callback, "GET", Some(&old_cookie), None, origin).await;
    assert_eq!(status, StatusCode::SEE_OTHER);
    let authenticated_cookie = cookie(&headers);
    assert_ne!(old_cookie, authenticated_cookie);
    assert!(
        headers[header::SET_COOKIE]
            .to_str()
            .unwrap()
            .contains("HttpOnly; SameSite=Lax")
    );
    assert_eq!(
        request(&app, &callback, "GET", Some(&old_cookie), None, origin)
            .await
            .0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        request(&app, "/private", "GET", Some(&old_cookie), None, origin)
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );
    let (status, _, user) = request(
        &app,
        "/private",
        "GET",
        Some(&authenticated_cookie),
        None,
        origin,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(user["id"], identity.to_string());
    assert_eq!(user["is_staff"], false);
    assert_eq!(user["is_superuser"], false);
    assert_eq!(user["avatar_url"], "");
    let (_, _, session) = request(
        &app,
        "/api/session",
        "GET",
        Some(&authenticated_cookie),
        None,
        origin,
    )
    .await;
    let login_csrf = session["csrf_token"].as_str().unwrap();
    assert_ne!(login_csrf, csrf);
    assert_eq!(
        request(
            &app,
            "/api/auth/logout",
            "POST",
            Some(&authenticated_cookie),
            Some(&csrf),
            origin
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        request(
            &app,
            "/api/auth/logout",
            "POST",
            Some(&authenticated_cookie),
            Some(login_csrf),
            origin
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(
        request(
            &app,
            "/private",
            "GET",
            Some(&authenticated_cookie),
            None,
            origin
        )
        .await
        .0,
        StatusCode::UNAUTHORIZED
    );

    sqlx::query("UPDATE hub_user SET is_staff=true,display_name='Preserved profile' WHERE id=$1")
        .bind(identity)
        .execute(&db)
        .await
        .unwrap();
    let (old_cookie, _, callback) = begin_login(&app, origin).await;
    let (_, headers, _) = request(&app, &callback, "GET", Some(&old_cookie), None, origin).await;
    let current_cookie = cookie(&headers);
    let (_, _, user) = request(&app, "/private", "GET", Some(&current_cookie), None, origin).await;
    assert_eq!(user["display_name"], "Preserved profile");
    assert_eq!(user["is_staff"], true);
    sqlx::query("UPDATE hub_user SET is_active=false WHERE id=$1")
        .bind(identity)
        .execute(&db)
        .await
        .unwrap();
    assert_eq!(
        request(&app, "/private", "GET", Some(&current_cookie), None, origin)
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );
    assert!(
        request(
            &app,
            "/api/session",
            "GET",
            Some(&current_cookie),
            None,
            origin
        )
        .await
        .2["user"]
            .is_null()
    );
    let (old_cookie, _, callback) = begin_login(&app, origin).await;
    assert_eq!(
        request(&app, &callback, "GET", Some(&old_cookie), None, origin)
            .await
            .0,
        StatusCode::FORBIDDEN
    );
    sqlx::query("UPDATE hub_user SET is_active=true WHERE id=$1")
        .bind(identity)
        .execute(&db)
        .await
        .unwrap();
    let (old_cookie, _, callback) = begin_login(&app, origin).await;
    let (_, headers, _) = request(&app, &callback, "GET", Some(&old_cookie), None, origin).await;
    let current_cookie = cookie(&headers);
    sqlx::query("UPDATE hub_rustsession SET expires_at=now()-interval '1 second' WHERE user_id=$1")
        .bind(identity)
        .execute(&db)
        .await
        .unwrap();
    assert_eq!(
        request(&app, "/private", "GET", Some(&current_cookie), None, origin)
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );

    server.abort();
    db.close().await;
    sqlx::raw_sql(&format!("DROP SCHEMA {schema} CASCADE"))
        .execute(&admin)
        .await
        .unwrap();
    admin.close().await;
}
