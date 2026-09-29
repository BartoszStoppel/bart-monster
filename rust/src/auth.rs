//! Supabase proves identity; opaque, server-side sessions authorize application requests.
use std::{env, sync::Arc, time::Duration};

use axum::{
    Json, Router,
    extract::{FromRef, FromRequestParts, Query, State},
    http::{HeaderMap, HeaderValue, StatusCode, header, request::Parts},
    response::{IntoResponse, Redirect, Response},
    routing::{get, post},
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use chrono::{DateTime, Utc};
use rand::RngCore;
use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::{FromRow, PgPool};
use subtle::ConstantTimeEq;
use uuid::Uuid;

const COOKIE: &str = "bart_session";
const SESSION_SECONDS: i64 = 14 * 24 * 60 * 60;
const ANONYMOUS_SECONDS: i64 = 60 * 60;

#[derive(Clone)]
pub struct AuthConfig {
    pub app_origin: String,
    pub supabase_url: String,
    pub supabase_anon_key: String,
    pub secure_cookies: bool,
}

impl AuthConfig {
    pub fn from_env() -> Result<Self, AuthError> {
        let app_origin = env::var("APP_ORIGIN")
            .or_else(|_| env::var("VERCEL_URL").map(|host| format!("https://{host}")))
            .unwrap_or_else(|_| "http://localhost:3000".into());
        let url = Url::parse(&app_origin).map_err(|_| AuthError::configuration())?;
        let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
        if url.path() != "/"
            || url.query().is_some()
            || url.fragment().is_some()
            || !url.username().is_empty()
            || url.password().is_some()
            || (url.scheme() != "https"
                && !(url.scheme() == "http" && local && env::var("VERCEL").is_err()))
        {
            return Err(AuthError::configuration());
        }
        Ok(Self {
            app_origin: url.origin().ascii_serialization(),
            supabase_url: env::var("SUPABASE_URL")
                .or_else(|_| env::var("NEXT_PUBLIC_SUPABASE_URL"))
                .unwrap_or_default()
                .trim_end_matches('/')
                .into(),
            supabase_anon_key: env::var("SUPABASE_ANON_KEY")
                .or_else(|_| env::var("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
                .unwrap_or_default(),
            secure_cookies: url.scheme() == "https",
        })
    }
}

#[derive(Clone)]
pub struct AuthState {
    pub db: PgPool,
    pub http: Client,
    pub config: Arc<AuthConfig>,
}

#[derive(Clone, Debug, Serialize, FromRow)]
pub struct CurrentUser {
    pub id: Uuid,
    pub display_name: String,
    pub email: String,
    pub avatar_url: String,
    pub is_staff: bool,
    pub is_superuser: bool,
    pub partner_id: Option<Uuid>,
}

#[derive(Clone)]
pub struct AuthSession {
    pub user: CurrentUser,
    pub csrf_token: String,
    origin: String,
}

#[derive(Debug, thiserror::Error)]
#[error("{1}")]
pub struct AuthError(pub StatusCode, pub &'static str);

impl AuthError {
    fn configuration() -> Self {
        Self(
            StatusCode::SERVICE_UNAVAILABLE,
            "Sign-in is not configured.",
        )
    }
    fn invalid_login() -> Self {
        Self(
            StatusCode::BAD_REQUEST,
            "Sign-in expired or invalid. Please start again.",
        )
    }
    fn csrf() -> Self {
        Self(
            StatusCode::FORBIDDEN,
            "Refresh this page before trying again.",
        )
    }
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        (self.0, Json(json!({"error": self.1}))).into_response()
    }
}

impl From<sqlx::Error> for AuthError {
    fn from(error: sqlx::Error) -> Self {
        eprintln!("Authentication database operation failed: {error}");
        Self(
            StatusCode::SERVICE_UNAVAILABLE,
            "Sign-in is temporarily unavailable.",
        )
    }
}

#[derive(FromRow)]
struct SessionRow {
    session_hash: String,
    user_id: Option<Uuid>,
    csrf_token: String,
    oauth_verifier: Option<String>,
    oauth_state_hash: Option<String>,
    oauth_started_at: Option<DateTime<Utc>>,
}

fn random_token() -> String {
    let mut bytes = [0; 32];
    rand::rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn digest(value: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(value.as_bytes()))
}

fn constant_equal(left: &str, right: &str) -> bool {
    bool::from(left.as_bytes().ct_eq(right.as_bytes()))
}

fn session_key(headers: &HeaderMap) -> Option<String> {
    let mut values = headers
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(|v| v.split(';'))
        .filter_map(|v| v.trim().split_once('='))
        .filter(|(name, _)| *name == COOKIE)
        .map(|(_, value)| value);
    let token = values.next()?;
    // Reject ambiguous cookies and arbitrary large attacker-provided keys.
    if values.next().is_some()
        || token.len() != 43
        || !token
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    {
        return None;
    }
    Some(digest(token))
}

async fn find_session(
    state: &AuthState,
    headers: &HeaderMap,
) -> Result<Option<SessionRow>, AuthError> {
    let Some(key) = session_key(headers) else {
        return Ok(None);
    };
    Ok(crate::db::query_as::<_, SessionRow>(
        "SELECT * FROM hub_rustsession WHERE session_hash = $1 AND expires_at > now()",
    )
    .bind(key)
    .fetch_optional(&state.db)
    .await?)
}

async fn user_by_id(db: &PgPool, id: Uuid) -> Result<Option<CurrentUser>, AuthError> {
    Ok(crate::db::query_as::<_, CurrentUser>(
        "SELECT id, display_name, email, avatar_url, is_staff, is_superuser, partner_id FROM hub_user WHERE id = $1 AND is_active",
    ).bind(id).fetch_optional(db).await?)
}

impl<S> FromRequestParts<S> for AuthSession
where
    S: Send + Sync,
    AuthState: FromRef<S>,
{
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        if let Some(session) = parts.extensions.get::<Self>() {
            return Ok(session.clone());
        }
        let state = AuthState::from_ref(state);
        let row = find_session(&state, &parts.headers)
            .await?
            .ok_or(AuthError(StatusCode::UNAUTHORIZED, "Please sign in."))?;
        let user = match row.user_id {
            Some(id) => user_by_id(&state.db, id).await?,
            None => None,
        }
        .ok_or(AuthError(StatusCode::UNAUTHORIZED, "Please sign in."))?;
        let session = Self {
            user,
            csrf_token: row.csrf_token,
            origin: state.config.app_origin.clone(),
        };
        parts.extensions.insert(session.clone());
        Ok(session)
    }
}

impl<S> FromRequestParts<S> for CurrentUser
where
    S: Send + Sync,
    AuthState: FromRef<S>,
{
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        Ok(AuthSession::from_request_parts(parts, state).await?.user)
    }
}

fn verify_csrf(
    headers: &HeaderMap,
    expected_token: &str,
    expected_origin: &str,
) -> Result<(), AuthError> {
    let token = headers
        .get("x-csrf-token")
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default();
    let origin = headers
        .get(header::ORIGIN)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default();
    if !constant_equal(token, expected_token) || origin != expected_origin {
        return Err(AuthError::csrf());
    }
    Ok(())
}

/// Call before every authenticated state-changing operation.
pub fn require_csrf(headers: &HeaderMap, session: &AuthSession) -> Result<(), AuthError> {
    verify_csrf(headers, &session.csrf_token, &session.origin)
}

fn session_cookie(config: &AuthConfig, token: &str, seconds: i64) -> HeaderValue {
    let secure = if config.secure_cookies {
        "; Secure"
    } else {
        ""
    };
    HeaderValue::from_str(&format!(
        "{COOKIE}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={seconds}{secure}"
    ))
    .expect("session tokens contain only URL-safe ASCII")
}

fn private_response(mut response: Response) -> Response {
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
        .headers_mut()
        .insert(header::VARY, HeaderValue::from_static("Cookie"));
    response.headers_mut().insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("no-referrer"),
    );
    response
}

async fn bootstrap(
    State(state): State<AuthState>,
    headers: HeaderMap,
) -> Result<Response, AuthError> {
    let mut row = find_session(&state, &headers).await?;
    let user = match row.as_ref().and_then(|r| r.user_id) {
        Some(id) => user_by_id(&state.db, id).await?,
        None => None,
    };
    // An inactive account must not retain its authenticated session.
    if row.as_ref().is_some_and(|r| r.user_id.is_some()) && user.is_none() {
        crate::db::query("DELETE FROM hub_rustsession WHERE session_hash = $1")
            .bind(&row.as_ref().unwrap().session_hash)
            .execute(&state.db)
            .await?;
        row = None;
    }
    let mut cookie = None;
    let csrf = if let Some(row) = row {
        row.csrf_token
    } else {
        let token = random_token();
        let csrf = random_token();
        crate::db::query("DELETE FROM hub_rustsession WHERE expires_at <= now()")
            .execute(&state.db)
            .await?;
        crate::db::query("INSERT INTO hub_rustsession (session_hash, csrf_token, expires_at) VALUES ($1, $2, now() + interval '1 hour')")
            .bind(digest(&token)).bind(&csrf).execute(&state.db).await?;
        cookie = Some(session_cookie(&state.config, &token, ANONYMOUS_SECONDS));
        csrf
    };
    let mut response =
        private_response(Json(json!({"user":user,"csrf_token":csrf})).into_response());
    if let Some(cookie) = cookie {
        response.headers_mut().insert(header::SET_COOKIE, cookie);
    }
    Ok(response)
}

async fn google_login(
    State(state): State<AuthState>,
    headers: HeaderMap,
) -> Result<Response, AuthError> {
    let row = find_session(&state, &headers)
        .await?
        .ok_or_else(AuthError::csrf)?;
    verify_csrf(&headers, &row.csrf_token, &state.config.app_origin)?;
    if state.config.supabase_url.is_empty() || state.config.supabase_anon_key.is_empty() {
        return Err(AuthError::configuration());
    }
    let verifier = random_token();
    let oauth_state = random_token();
    let mut callback = Url::parse(&format!("{}/callback", state.config.app_origin))
        .map_err(|_| AuthError::configuration())?;
    callback
        .query_pairs_mut()
        .append_pair("state", &oauth_state);
    let mut authorize = Url::parse(&format!("{}/auth/v1/authorize", state.config.supabase_url))
        .map_err(|_| AuthError::configuration())?;
    authorize
        .query_pairs_mut()
        .append_pair("provider", "google")
        .append_pair("redirect_to", callback.as_str())
        .append_pair("code_challenge", &digest(&verifier))
        .append_pair("code_challenge_method", "s256");
    let updated = crate::db::query("UPDATE hub_rustsession SET oauth_verifier=$1, oauth_state_hash=$2, oauth_started_at=now() WHERE session_hash=$3 AND expires_at > now()")
        .bind(verifier).bind(digest(&oauth_state)).bind(row.session_hash).execute(&state.db).await?;
    if updated.rows_affected() != 1 {
        return Err(AuthError::invalid_login());
    }
    Ok(private_response(
        Json(json!({"redirect_url":authorize.as_str()})).into_response(),
    ))
}

#[derive(Deserialize)]
struct CallbackQuery {
    code: Option<String>,
    state: Option<String>,
}

#[derive(Deserialize)]
struct TokenResponse {
    user: Identity,
}

#[derive(Deserialize)]
struct Identity {
    id: Uuid,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    user_metadata: Value,
}

async fn callback(
    State(state): State<AuthState>,
    headers: HeaderMap,
    Query(query): Query<CallbackQuery>,
) -> Result<Response, AuthError> {
    let key = session_key(&headers).ok_or_else(AuthError::invalid_login)?;
    let code = query
        .code
        .filter(|s| !s.is_empty() && s.len() <= 2048)
        .ok_or_else(AuthError::invalid_login)?;
    let received_state = query
        .state
        .filter(|s| s.len() == 43)
        .ok_or_else(AuthError::invalid_login)?;
    let mut tx = state.db.begin().await?;
    let flow = crate::db::query_as::<_, SessionRow>(
        "SELECT * FROM hub_rustsession WHERE session_hash=$1 AND expires_at > now() FOR UPDATE",
    )
    .bind(&key)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(AuthError::invalid_login)?;
    if !flow
        .oauth_state_hash
        .as_deref()
        .is_some_and(|s| constant_equal(s, &digest(&received_state)))
        || !flow.oauth_started_at.is_some_and(|t| {
            (Utc::now() - t).num_seconds() >= 0 && (Utc::now() - t).num_seconds() <= 600
        })
    {
        return Err(AuthError::invalid_login());
    }
    let verifier = flow.oauth_verifier.ok_or_else(AuthError::invalid_login)?;
    // Consume under a row lock before the network exchange: simultaneous callbacks cannot replay a flow.
    crate::db::query("UPDATE hub_rustsession SET oauth_verifier=NULL, oauth_state_hash=NULL, oauth_started_at=NULL WHERE session_hash=$1")
        .bind(&key).execute(&mut *tx).await?;
    tx.commit().await?;
    let identity = state
        .http
        .post(format!(
            "{}/auth/v1/token?grant_type=pkce",
            state.config.supabase_url
        ))
        .header("apikey", &state.config.supabase_anon_key)
        .timeout(Duration::from_secs(20))
        .json(&json!({"auth_code":code,"code_verifier":verifier}))
        .send()
        .await
        .map_err(|_| AuthError::invalid_login())?
        .error_for_status()
        .map_err(|_| AuthError::invalid_login())?
        .json::<TokenResponse>()
        .await
        .map_err(|_| AuthError::invalid_login())?
        .user;
    let name = identity
        .user_metadata
        .get("full_name")
        .or_else(|| identity.user_metadata.get("name"))
        .and_then(Value::as_str)
        .filter(|v| !v.is_empty())
        .unwrap_or("Friend")
        .chars()
        .take(150)
        .collect::<String>();
    let avatar = identity
        .user_metadata
        .get("avatar_url")
        .and_then(Value::as_str)
        .filter(|v| Url::parse(v).is_ok_and(|u| u.scheme() == "https"))
        .unwrap_or("")
        .chars()
        .take(1000)
        .collect::<String>();
    let email = identity
        .email
        .unwrap_or_default()
        .chars()
        .take(254)
        .collect::<String>();
    let token = random_token();
    let csrf = random_token();
    let mut tx = state.db.begin().await?;
    // Existing profile and permissions remain authoritative. Metadata never assigns staff access.
    crate::db::query("INSERT INTO hub_user (id, password, last_login, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined, display_name, avatar_url, updated_at, partner_id) VALUES ($1, '!', now(), false, $2, '', '', $3, false, true, now(), $4, $5, now(), NULL) ON CONFLICT (id) DO NOTHING")
        .bind(identity.id).bind(identity.id.to_string()).bind(email).bind(name).bind(avatar)
        .execute(&mut *tx).await?;
    let active =
        crate::db::query_scalar::<_, bool>("SELECT is_active FROM hub_user WHERE id=$1 FOR UPDATE")
            .bind(identity.id)
            .fetch_one(&mut *tx)
            .await?;
    if !active {
        return Err(AuthError(
            StatusCode::FORBIDDEN,
            "This account is disabled.",
        ));
    }
    // Logout or expiry during the token exchange must not resurrect a deleted session.
    let removed = crate::db::query(
        "DELETE FROM hub_rustsession WHERE session_hash=$1 AND expires_at > now()",
    )
    .bind(&key)
    .execute(&mut *tx)
    .await?;
    if removed.rows_affected() != 1 {
        return Err(AuthError::invalid_login());
    }
    crate::db::query("INSERT INTO hub_rustsession (session_hash, user_id, csrf_token, expires_at) VALUES ($1,$2,$3, now() + interval '14 days')")
        .bind(digest(&token)).bind(identity.id).bind(csrf).execute(&mut *tx).await?;
    crate::db::query("UPDATE hub_user SET last_login=now() WHERE id=$1")
        .bind(identity.id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    let mut response = private_response(Redirect::to("/").into_response());
    response.headers_mut().insert(
        header::SET_COOKIE,
        session_cookie(&state.config, &token, SESSION_SECONDS),
    );
    Ok(response)
}

async fn logout(State(state): State<AuthState>, headers: HeaderMap) -> Result<Response, AuthError> {
    let row = find_session(&state, &headers)
        .await?
        .ok_or_else(AuthError::csrf)?;
    verify_csrf(&headers, &row.csrf_token, &state.config.app_origin)?;
    crate::db::query("DELETE FROM hub_rustsession WHERE session_hash=$1")
        .bind(row.session_hash)
        .execute(&state.db)
        .await?;
    let mut response = private_response(Json(json!({"ok":true})).into_response());
    response
        .headers_mut()
        .insert(header::SET_COOKIE, session_cookie(&state.config, "", 0));
    Ok(response)
}

pub fn router() -> Router<AuthState> {
    Router::new()
        .route("/api/session", get(bootstrap))
        .route("/api/auth/google", post(google_login))
        .route("/login/google", post(google_login))
        .route("/callback", get(callback))
        .route("/api/auth/logout", post(logout))
        .route("/logout", post(logout))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pkce_challenge_matches_rfc7636() {
        assert_eq!(
            digest("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn csrf_requires_the_session_token_and_exact_origin() {
        let mut headers = HeaderMap::new();
        headers.insert(
            header::ORIGIN,
            HeaderValue::from_static("https://bart.monster"),
        );
        headers.insert("x-csrf-token", HeaderValue::from_static("right"));
        assert!(verify_csrf(&headers, "right", "https://bart.monster").is_ok());
        assert!(verify_csrf(&headers, "wrong", "https://bart.monster").is_err());
        assert!(verify_csrf(&headers, "right", "https://other.example").is_err());
        headers.remove(header::ORIGIN);
        assert!(verify_csrf(&headers, "right", "https://bart.monster").is_err());
    }

    #[test]
    fn only_one_well_formed_session_cookie_is_accepted() {
        let token = random_token();
        let mut headers = HeaderMap::new();
        headers.insert(
            header::COOKIE,
            HeaderValue::from_str(&format!("unrelated=x; {COOKIE}={token}")).unwrap(),
        );
        assert_eq!(session_key(&headers), Some(digest(&token)));
        headers.append(
            header::COOKIE,
            HeaderValue::from_str(&format!("{COOKIE}={token}")).unwrap(),
        );
        assert_eq!(session_key(&headers), None);
    }
}

#[cfg(test)]
#[path = "auth_tests.rs"]
mod integration_tests;
