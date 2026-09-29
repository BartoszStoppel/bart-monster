#[tokio::main]
async fn main() -> Result<(), vercel_runtime::Error> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_ansi(false)
        .init();
    let state = bart_monster::state_from_env().await?;
    let app = tower::ServiceBuilder::new()
        .layer(vercel_runtime::axum::VercelLayer::new())
        .service(bart_monster::router(state));
    vercel_runtime::run(app).await
}
