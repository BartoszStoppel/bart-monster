//! Use nonpersistent statements and pin standalone queries inside a transaction.
//! SQLx 0.8 separates prepare and bind with Sync; an explicit transaction keeps
//! Supabase's transaction pooler on the same backend across those exchanges.
use futures_util::{
    TryStreamExt,
    future::BoxFuture,
    stream::{self, BoxStream},
};
use sqlx::{
    Database, Describe, Either, Error, Execute, Executor, FromRow, PgPool, Postgres,
    database::HasStatementCache,
    postgres::{PgQueryResult, PgRow, PgStatement, PgTypeInfo},
    query::{Query, QueryAs, QueryScalar},
};

/// Executor for a single standalone operation against a transaction pooler.
/// Results are buffered until COMMIT succeeds, so callers cannot observe success
/// before deferred constraints or the commit have been checked. Use an explicit
/// transaction directly for operations that need to be atomic together.
#[derive(Clone, Copy, Debug)]
pub struct TransactionPool<'p>(&'p PgPool);

pub fn pool(pool: &PgPool) -> TransactionPool<'_> {
    TransactionPool(pool)
}

impl<'p> Executor<'p> for TransactionPool<'p> {
    type Database = Postgres;

    fn fetch_many<'e, 'q: 'e, E>(
        self,
        query: E,
    ) -> BoxStream<'e, Result<Either<PgQueryResult, PgRow>, Error>>
    where
        'p: 'e,
        E: 'q + Execute<'q, Postgres>,
    {
        Box::pin(
            stream::once(async move {
                let mut transaction = self.0.begin().await?;
                let rows: Vec<_> = (&mut *transaction).fetch_many(query).try_collect().await?;
                transaction.commit().await?;
                Ok::<_, Error>(rows)
            })
            .map_ok(|rows| stream::iter(rows.into_iter().map(Ok)))
            .try_flatten(),
        )
    }

    fn fetch_optional<'e, 'q: 'e, E>(self, query: E) -> BoxFuture<'e, Result<Option<PgRow>, Error>>
    where
        'p: 'e,
        E: 'q + Execute<'q, Postgres>,
    {
        Box::pin(async move {
            let mut transaction = self.0.begin().await?;
            let row = (&mut *transaction).fetch_optional(query).await?;
            transaction.commit().await?;
            Ok(row)
        })
    }

    fn prepare_with<'e, 'q: 'e>(
        self,
        _sql: &'q str,
        _parameters: &'e [PgTypeInfo],
    ) -> BoxFuture<'e, Result<PgStatement<'q>, Error>>
    where
        'p: 'e,
    {
        Box::pin(async {
            Err(Error::Protocol(
                "explicit prepared statements are unsupported through the transaction pool; use crate::db queries".into(),
            ))
        })
    }

    fn describe<'e, 'q: 'e>(self, _sql: &'q str) -> BoxFuture<'e, Result<Describe<Postgres>, Error>>
    where
        'p: 'e,
    {
        Box::pin(async {
            Err(Error::Protocol(
                "query description requires a direct/session connection".into(),
            ))
        })
    }
}

pub fn query<DB: Database + HasStatementCache>(sql: &str) -> Query<'_, DB, DB::Arguments<'_>> {
    sqlx::query(sql).persistent(false)
}

pub fn query_as<'q, DB, O>(sql: &'q str) -> QueryAs<'q, DB, O, DB::Arguments<'q>>
where
    DB: Database + HasStatementCache,
    O: for<'r> FromRow<'r, DB::Row>,
{
    sqlx::query_as(sql).persistent(false)
}

pub fn query_scalar<'q, DB, O>(sql: &'q str) -> QueryScalar<'q, DB, O, DB::Arguments<'q>>
where
    DB: Database + HasStatementCache,
    (O,): for<'r> FromRow<'r, DB::Row>,
{
    sqlx::query_scalar(sql).persistent(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::{Connection, PgConnection, Row, postgres::PgConnectOptions};
    use std::str::FromStr;

    #[test]
    fn bound_queries_never_request_persistent_prepared_statements() {
        let plain = query::<Postgres>("SELECT $1::integer").bind(7);
        let row = query_as::<Postgres, (i32,)>("SELECT $1::integer").bind(7);
        let scalar = query_scalar::<Postgres, i32>("SELECT $1::integer").bind(7);
        assert!(!Execute::persistent(&plain));
        assert!(!Execute::persistent(&row));
        assert!(!Execute::persistent(&scalar));
        let mut bulk = sqlx::QueryBuilder::<Postgres>::new("SELECT ");
        bulk.push_bind(7);
        assert!(!Execute::persistent(&bulk.build().persistent(false)));
    }

    #[tokio::test]
    async fn transaction_pool_rejects_explicit_named_statement_apis() {
        let database = PgPool::connect_lazy("postgres://localhost/unused").unwrap();
        assert!(matches!(
            pool(&database).prepare("SELECT 1").await,
            Err(Error::Protocol(_))
        ));
        assert!(matches!(
            pool(&database).describe("SELECT 1").await,
            Err(Error::Protocol(_))
        ));
    }

    #[test]
    fn runtime_queries_do_not_bypass_central_query_policy() {
        // Nonpersistent queries must also run through pool() or an explicit
        // transaction so prepare/bind cannot use different pooled backends.
        for (name, source) in [
            ("actions.rs", include_str!("actions.rs")),
            ("auth.rs", include_str!("auth.rs")),
            ("bgg.rs", include_str!("bgg.rs")),
            ("chat.rs", include_str!("chat.rs")),
            ("data.rs", include_str!("data.rs")),
            ("lib.rs", include_str!("lib.rs")),
            ("migrate.rs", include_str!("migrate.rs")),
            ("ranking_store.rs", include_str!("ranking_store.rs")),
        ] {
            assert!(
                !source.contains("sqlx::query"),
                "{name} bypasses crate::db; use the shared nonpersistent query wrappers"
            );
            assert!(
                !source.contains(".persistent(true)"),
                "{name} enables named prepared statements"
            );
        }
        let ranking: String = include_str!("ranking_store.rs")
            .chars()
            .filter(|c| !c.is_whitespace())
            .collect();
        assert_eq!(
            ranking.matches(".build()").count(),
            ranking.matches(".build().persistent(false)").count(),
            "ranking bulk QueryBuilder statements must also disable persistence"
        );
    }

    #[tokio::test]
    #[ignore = "requires ACTION_TEST_DATABASE_URL for local bart_actions_test"]
    async fn existing_server_statement_names_do_not_collide_with_wrappers() {
        let raw = std::env::var("ACTION_TEST_DATABASE_URL").expect("local test database URL");
        let url = url::Url::parse(&raw).unwrap();
        assert!(matches!(url.host_str(), Some("127.0.0.1" | "localhost")));
        assert_eq!(url.path(), "/bart_actions_test");
        let options = PgConnectOptions::from_str(&raw)
            .unwrap()
            .statement_cache_capacity(0);
        let mut connection = PgConnection::connect_with(&options).await.unwrap();

        // Simulate a pooled server connection carrying another client's first
        // statement. Disabling the client cache alone still produces this clash.
        sqlx::raw_sql("PREPARE sqlx_s_1 AS SELECT 99")
            .execute(&mut connection)
            .await
            .unwrap();
        let error = sqlx::query_scalar::<_, i32>("SELECT $1::integer")
            .bind(7)
            .fetch_one(&mut connection)
            .await
            .unwrap_err();
        assert_eq!(
            error
                .as_database_error()
                .and_then(|error| error.code())
                .as_deref(),
            Some("42P05")
        );

        for value in 1..=3 {
            let row = query("SELECT $1::integer")
                .bind(value)
                .fetch_one(&mut connection)
                .await
                .unwrap();
            assert_eq!(row.get::<i32, _>(0), value);
            let row: (i32, String) = query_as("SELECT $1::integer, $2::text")
                .bind(value)
                .bind("bound text")
                .fetch_one(&mut connection)
                .await
                .unwrap();
            assert_eq!(row, (value, "bound text".into()));
            let scalar: i32 = query_scalar("SELECT $1::integer + 1")
                .bind(value)
                .fetch_one(&mut connection)
                .await
                .unwrap();
            assert_eq!(scalar, value + 1);
            let mut bulk = sqlx::QueryBuilder::<Postgres>::new("SELECT ");
            bulk.push_bind(value).push("::integer");
            let row = bulk
                .build()
                .persistent(false)
                .fetch_one(&mut connection)
                .await
                .unwrap();
            assert_eq!(row.get::<i32, _>(0), value);
        }
        let names: Vec<(String,)> =
            query_as("SELECT name FROM pg_prepared_statements ORDER BY name")
                .fetch_all(&mut connection)
                .await
                .unwrap();
        assert_eq!(
            names,
            vec![("sqlx_s_1".into(),)],
            "wrappers create no named statements"
        );
        connection.close().await.unwrap();
    }
}
