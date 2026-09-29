pub mod actions;
pub mod auth;
pub mod bgg;
pub mod chat;
pub mod data;
pub mod db;
pub mod migrate;
pub mod ranking;
pub mod ranking_store;

#[cfg(test)]
mod action_tests;

use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, FromRef},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde_json::json;
use sqlx::{
    PgPool,
    postgres::{PgConnectOptions, PgPoolOptions},
};
use std::{str::FromStr, time::Duration};
use tower_http::{
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub http: reqwest::Client,
    pub auth: auth::AuthState,
}
impl FromRef<AppState> for auth::AuthState {
    fn from_ref(state: &AppState) -> Self {
        state.auth.clone()
    }
}

#[derive(Debug, thiserror::Error)]
#[error("{message}")]
pub struct AppError {
    pub status: StatusCode,
    pub message: String,
}
impl AppError {
    pub fn bad(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: message.into(),
        }
    }
    pub fn forbidden() -> Self {
        Self {
            status: StatusCode::FORBIDDEN,
            message: "You do not have permission to do that.".into(),
        }
    }
    pub fn upstream(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_GATEWAY,
            message: message.into(),
        }
    }
}
impl From<sqlx::Error> for AppError {
    fn from(error: sqlx::Error) -> Self {
        tracing::error!(error=%error,"database operation failed");
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: "The request could not be saved. Please try again.".into(),
        }
    }
}
impl From<reqwest::Error> for AppError {
    fn from(_: reqwest::Error) -> Self {
        Self::upstream("The external service is unavailable. Please try again.")
    }
}
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (self.status, Json(json!({"error":self.message}))).into_response()
    }
}
pub type Result<T> = std::result::Result<T, AppError>;

pub(crate) fn database_options(
    url: &str,
) -> std::result::Result<PgConnectOptions, Box<dyn std::error::Error + Send + Sync>> {
    let options = PgConnectOptions::from_str(url)?.statement_cache_capacity(0);
    Ok(options)
}

pub async fn state_from_env()
-> std::result::Result<AppState, Box<dyn std::error::Error + Send + Sync>> {
    let _ = dotenvy::dotenv();
    let _ = dotenvy::from_filename(".env.local");
    let url = std::env::var("DATABASE_URL")?;
    let options = database_options(&url)?;
    let db = PgPoolOptions::new()
        .max_connections(1)
        .min_connections(0)
        .acquire_timeout(Duration::from_secs(15))
        .idle_timeout(Duration::from_secs(5))
        .max_lifetime(Duration::from_secs(300))
        .connect_lazy_with(options);
    let http = reqwest::Client::builder()
        .timeout(Duration::from_secs(25))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent("bart.monster/0.3 (board-game group)")
        .build()?;
    let auth = auth::AuthState {
        db: db.clone(),
        http: http.clone(),
        config: std::sync::Arc::new(auth::AuthConfig::from_env()?),
    };
    Ok(AppState { db, http, auth })
}

pub fn router(state: AppState) -> Router {
    let auth_router = auth::router().with_state(state.auth.clone());
    Router::new()
        .route(
            "/health",
            get(|| async { Json(json!({"status":"ok","runtime":"rust"})) }),
        )
        .route("/api/bootstrap", get(data::bootstrap))
        .route("/api/history", get(data::history))
        .route("/api/actions", post(actions::action))
        .route(
            "/api/rankings/{metric}/{category}",
            get(data::ranking_board).post(data::save_ranking),
        )
        .route(
            "/api/expansion-rankings/{game}",
            get(data::expansion_board).post(data::save_expansions),
        )
        .route("/api/bgg/search", get(bgg::search_route))
        .route("/api/bgg/game/{id}", get(bgg::details_route))
        .route("/_next/image", get(bgg::image_proxy))
        .route("/api/chat", post(chat::chat))
        .route("/api/rules/convert", post(chat::convert_pdf))
        .route(
            "/api/{*path}",
            axum::routing::any(|| async {
                (
                    StatusCode::NOT_FOUND,
                    Json(json!({"error":"Endpoint not found."})),
                )
            }),
        )
        .layer(DefaultBodyLimit::max(21_000_000))
        .with_state(state)
        .merge(auth_router)
        .fallback_service(ServeDir::new("web/dist").fallback(ServeFile::new("web/dist/index.html")))
        .layer(
            tower_http::set_header::SetResponseHeaderLayer::if_not_present(
                axum::http::header::CACHE_CONTROL,
                axum::http::HeaderValue::from_static("private, no-store"),
            ),
        )
        .layer(tower_http::set_header::SetResponseHeaderLayer::overriding(
            axum::http::header::X_CONTENT_TYPE_OPTIONS,
            axum::http::HeaderValue::from_static("nosniff"),
        ))
        .layer(tower_http::set_header::SetResponseHeaderLayer::overriding(
            axum::http::header::X_FRAME_OPTIONS,
            axum::http::HeaderValue::from_static("DENY"),
        ))
        .layer(TraceLayer::new_for_http())
}
