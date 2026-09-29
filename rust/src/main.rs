#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();
    let state = bart_monster::state_from_env().await?;
    if std::env::args().nth(1).as_deref() == Some("migrate") {
        bart_monster::migrate::migrate(&state.db).await?;
        println!("Application schema is ready.");
        return Ok(());
    }
    let port = std::env::var("PORT").unwrap_or_else(|_| "8000".into());
    let bind = std::env::var("BIND_ADDRESS").unwrap_or_else(|_| "127.0.0.1".into());
    let listener = tokio::net::TcpListener::bind(format!("{bind}:{port}")).await?;
    tracing::info!(%port,"Rust server listening");
    axum::serve(listener, bart_monster::router(state)).await?;
    Ok(())
}
