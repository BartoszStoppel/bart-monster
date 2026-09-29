//! Explicit release step. The running server never applies schema changes.
use sqlx::PgPool;
pub async fn migrate(pool: &PgPool) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    crate::db::query("SELECT pg_advisory_xact_lock(782343901)")
        .execute(&mut *tx)
        .await?;
    let exists: bool = crate::db::query_scalar("SELECT to_regclass('hub_user') IS NOT NULL")
        .fetch_one(&mut *tx)
        .await?;
    if !exists {
        sqlx::raw_sql(include_str!("../migrations/0001_application.sql"))
            .execute(&mut *tx)
            .await?;
    }
    sqlx::raw_sql(include_str!("../migrations/0005_rust_sessions.sql"))
        .execute(&mut *tx)
        .await?;
    tx.commit().await
}
