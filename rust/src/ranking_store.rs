//! Atomic persistence for ranking autosave against the existing private application schema.

use crate::ranking::{
    self, Category, Metric, Placement, RankedEntry, RankingError, RankingScope, ScoreChange,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde_json::{Value, json};
use sqlx::{PgConnection, PgPool, Postgres, QueryBuilder, Transaction};
use std::{
    collections::{HashMap, HashSet},
    fmt,
};
use uuid::Uuid;

#[derive(Debug)]
pub enum StoreError {
    Ranking(RankingError),
    Database(sqlx::Error),
    NotFound,
}
impl From<RankingError> for StoreError {
    fn from(error: RankingError) -> Self {
        Self::Ranking(error)
    }
}
impl From<sqlx::Error> for StoreError {
    fn from(error: sqlx::Error) -> Self {
        Self::Database(error)
    }
}
impl fmt::Display for StoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Ranking(error) if *error != RankingError::InvalidStoredRanking => error.fmt(f),
            Self::NotFound => f.write_str("Player or game not found."),
            _ => f.write_str("Could not save this ranking. Please try again."),
        }
    }
}
impl std::error::Error for StoreError {}
impl StoreError {
    pub fn status_code(&self) -> u16 {
        match self {
            Self::Ranking(RankingError::Stale) => 409,
            Self::Ranking(RankingError::InvalidStoredRanking) | Self::Database(_) => 500,
            Self::Ranking(_) => 400,
            Self::NotFound => 404,
        }
    }
}

fn make_scope(
    user_id: Uuid,
    category: Category,
    game_id: Option<i64>,
    metric: Metric,
) -> RankingScope {
    RankingScope {
        user_id: user_id.to_string(),
        category,
        game_id,
        metric,
    }
}

fn game_id(value: &str) -> Result<i32, StoreError> {
    value
        .parse::<i32>()
        .ok()
        .filter(|id| *id > 0)
        .ok_or(RankingError::InvalidTierOrGame.into())
}
fn expansion_id(value: &str) -> Result<Uuid, StoreError> {
    Uuid::parse_str(value).map_err(|_| RankingError::InvalidTierOrGame.into())
}

pub fn local_day(now: DateTime<Utc>) -> NaiveDate {
    now.with_timezone(&chrono_tz::America::Indiana::Indianapolis)
        .date_naive()
}

async fn load(
    connection: &mut PgConnection,
    scope: &RankingScope,
) -> Result<Vec<Placement>, StoreError> {
    scope.validate()?;
    let user_id = Uuid::parse_str(&scope.user_id).map_err(|_| RankingError::InvalidScope)?;
    let sql = match (scope.game_id, scope.metric) {
        (Some(_), _) => {
            "SELECT p.id::text, p.expansion_id::text, p.tier, p.position, p.score FROM hub_expansionplacement p JOIN hub_expansion e ON e.id=p.expansion_id WHERE p.user_id=$1 AND e.game_id=$2"
        }
        (None, Metric::Enjoyment) => {
            "SELECT p.id::text, p.game_id::text, p.tier, p.position, p.score FROM hub_usergame p JOIN hub_game g ON g.bgg_id=p.game_id WHERE p.user_id=$1 AND g.category=$2 AND p.tier<>''"
        }
        (None, Metric::Difficulty) => {
            "SELECT p.id::text, p.game_id::text, p.difficulty_tier::text, p.difficulty_position, p.difficulty_tier::double precision FROM hub_usergame p JOIN hub_game g ON g.bgg_id=p.game_id WHERE p.user_id=$1 AND g.category=$2 AND p.difficulty_tier IS NOT NULL"
        }
    };
    let query = crate::db::query_as::<_, (String, String, String, i32, f64)>(sql).bind(user_id);
    let rows = if let Some(id) = scope.game_id {
        query
            .bind(game_id(&id.to_string())?)
            .fetch_all(connection)
            .await?
    } else {
        query
            .bind(scope.category.as_str())
            .fetch_all(connection)
            .await?
    };
    rows.into_iter()
        .map(|(row_id, id, tier, position, score)| {
            Ok(Placement {
                row_id,
                id,
                tier,
                position: u32::try_from(position)
                    .map_err(|_| RankingError::InvalidStoredRanking)?,
                score,
            })
        })
        .collect()
}

fn response(rows: &[Placement], scope: &RankingScope) -> Result<Value, StoreError> {
    let placements: Vec<_> = ranking::ordered(rows, scope)?
        .into_iter()
        .map(RankedEntry::from)
        .collect();
    Ok(json!({"revision":ranking::revision(rows,scope)?,"placements":placements}))
}

pub async fn board_state(
    pool: &PgPool,
    user_id: Uuid,
    category: Category,
    game_id: Option<i64>,
    metric: Metric,
) -> Result<Value, StoreError> {
    let scope = make_scope(user_id, category, game_id, metric);
    let mut tx = pool.begin().await?;
    let rows = load(&mut tx, &scope).await?;
    tx.commit().await?;
    response(&rows, &scope)
}

/// Every ranking or personal-state mutation must lock its player before touching associations.
/// Shared item locks serialize community snapshots across different players' saves.
pub async fn save(
    pool: &PgPool,
    user_id: Uuid,
    category: Category,
    parent_id: Option<i64>,
    metric: Metric,
    entries: Value,
    expected_revision: &str,
) -> Result<Value, StoreError> {
    let scope = make_scope(user_id, category, parent_id, metric);
    scope.validate()?;
    let mut tx = pool.begin().await?;
    let user = crate::db::query_scalar::<_, Uuid>(
        "SELECT id FROM hub_user WHERE id=$1 AND is_active ORDER BY id FOR UPDATE",
    )
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?;
    if user.is_none() {
        return Err(StoreError::NotFound);
    }
    let allowed: HashSet<String> = if let Some(parent_id) = parent_id {
        if !crate::db::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM hub_game WHERE bgg_id=$1)",
        )
        .bind(game_id(&parent_id.to_string())?)
        .fetch_one(&mut *tx)
        .await?
        {
            return Err(StoreError::NotFound);
        }
        crate::db::query_scalar::<_, Uuid>(
            "SELECT id FROM hub_expansion WHERE game_id=$1 ORDER BY id FOR UPDATE",
        )
        .bind(game_id(&parent_id.to_string())?)
        .fetch_all(&mut *tx)
        .await?
        .into_iter()
        .map(|id| id.to_string())
        .collect()
    } else {
        crate::db::query_scalar::<_, i32>(
            "SELECT bgg_id FROM hub_game WHERE category=$1 ORDER BY bgg_id FOR UPDATE",
        )
        .bind(category.as_str())
        .fetch_all(&mut *tx)
        .await?
        .into_iter()
        .map(|id| id.to_string())
        .collect()
    };
    let previous = load(&mut tx, &scope).await?;
    let plan = ranking::plan_save(&scope, &previous, &allowed, &entries, expected_revision)?;
    if plan.unchanged {
        tx.commit().await?;
        return Ok(json!({"revision":plan.current_revision,"placements":plan.placements}));
    }
    let now = Utc::now();
    if parent_id.is_some() {
        let removed = plan
            .removed_ids
            .iter()
            .map(|id| expansion_id(id))
            .collect::<Result<Vec<_>, _>>()?;
        if !removed.is_empty() {
            crate::db::query(
                "DELETE FROM hub_expansionplacement WHERE user_id=$1 AND expansion_id=ANY($2)",
            )
            .bind(user_id)
            .bind(removed)
            .execute(&mut *tx)
            .await?;
        }
        for entries in plan.placements.chunks(500) {
            let mut insert = QueryBuilder::<Postgres>::new(
                "INSERT INTO hub_expansionplacement (id,created_at,user_id,expansion_id,tier,position,score,updated_at) ",
            );
            let entries = entries
                .iter()
                .map(|row| Ok((expansion_id(&row.id)?, row)))
                .collect::<Result<Vec<_>, StoreError>>()?;
            insert.push_values(entries, |mut values, (id, row)| {
                values
                    .push_bind(Uuid::new_v4())
                    .push_bind(now)
                    .push_bind(user_id)
                    .push_bind(id)
                    .push_bind(&row.tier)
                    .push_bind(row.position as i32)
                    .push_bind(row.score)
                    .push_bind(now);
            });
            insert.push(" ON CONFLICT (user_id,expansion_id) DO UPDATE SET tier=EXCLUDED.tier, position=EXCLUDED.position, score=EXCLUDED.score, updated_at=EXCLUDED.updated_at");
            insert.build().persistent(false).execute(&mut *tx).await?;
        }
    } else {
        let removed = plan
            .removed_ids
            .iter()
            .map(|id| game_id(id))
            .collect::<Result<Vec<_>, _>>()?;
        if !removed.is_empty() {
            let sql = match metric {
                Metric::Enjoyment => {
                    "UPDATE hub_usergame SET tier='', position=0, score=NULL, updated_at=$3 WHERE user_id=$1 AND game_id=ANY($2)"
                }
                Metric::Difficulty => {
                    "UPDATE hub_usergame SET difficulty_tier=NULL, difficulty_position=0, difficulty_updated_at=$3 WHERE user_id=$1 AND game_id=ANY($2)"
                }
            };
            crate::db::query(sql)
                .bind(user_id)
                .bind(removed)
                .bind(now)
                .execute(&mut *tx)
                .await?;
        }
        for entries in plan.placements.chunks(500) {
            let mut insert = QueryBuilder::<Postgres>::new(
                "INSERT INTO hub_usergame (id,created_at,user_id,game_id,owned,wishlist,wishlist_note,comment,tier,position,score,updated_at,legacy_ids,difficulty_position,difficulty_tier,difficulty_updated_at,tier_created_at) ",
            );
            let entries = entries
                .iter()
                .map(|row| Ok((game_id(&row.id)?, row)))
                .collect::<Result<Vec<_>, StoreError>>()?;
            insert.push_values(entries, |mut values, (id, row)| {
                let enjoyment = metric == Metric::Enjoyment;
                values
                    .push_bind(Uuid::new_v4())
                    .push_bind(now)
                    .push_bind(user_id)
                    .push_bind(id)
                    .push("false")
                    .push("false")
                    .push("''")
                    .push("''")
                    .push_bind(if enjoyment { row.tier.as_str() } else { "" })
                    .push_bind(if enjoyment { row.position as i32 } else { 0 })
                    .push_bind(enjoyment.then_some(row.score))
                    .push_bind(now)
                    .push("'{}'::jsonb")
                    .push_bind(if enjoyment { 0 } else { row.position as i32 })
                    .push_bind((!enjoyment).then_some(row.score as i16))
                    .push_bind((!enjoyment).then_some(now))
                    .push_bind(enjoyment.then_some(now));
            });
            insert.push(match metric {
                Metric::Enjoyment => " ON CONFLICT (user_id,game_id) DO UPDATE SET tier=EXCLUDED.tier, position=EXCLUDED.position, score=EXCLUDED.score, updated_at=EXCLUDED.updated_at, tier_created_at=COALESCE(hub_usergame.tier_created_at,EXCLUDED.tier_created_at)",
                Metric::Difficulty => " ON CONFLICT (user_id,game_id) DO UPDATE SET difficulty_tier=EXCLUDED.difficulty_tier, difficulty_position=EXCLUDED.difficulty_position, difficulty_updated_at=CASE WHEN (hub_usergame.difficulty_tier,hub_usergame.difficulty_position) IS DISTINCT FROM (EXCLUDED.difficulty_tier,EXCLUDED.difficulty_position) THEN EXCLUDED.difficulty_updated_at ELSE hub_usergame.difficulty_updated_at END",
            });
            insert.build().persistent(false).execute(&mut *tx).await?;
        }
        crate::db::query("DELETE FROM hub_usergame WHERE user_id=$1 AND NOT owned AND NOT wishlist AND wishlist_priority IS NULL AND wishlist_note='' AND tier='' AND difficulty_tier IS NULL AND rating IS NULL AND comment=''").bind(user_id).execute(&mut *tx).await?;
        record_scores(
            &mut tx,
            user_id,
            metric,
            &plan.score_changes,
            local_day(now),
        )
        .await?;
    }
    let result = response(&load(&mut tx, &scope).await?, &scope)?;
    tx.commit().await?;
    Ok(result)
}

async fn record_scores(
    tx: &mut Transaction<'_, Postgres>,
    user_id: Uuid,
    metric: Metric,
    changes: &[ScoreChange],
    day: NaiveDate,
) -> Result<(), StoreError> {
    if changes.is_empty() {
        return Ok(());
    }
    let ids = changes
        .iter()
        .map(|row| game_id(&row.id))
        .collect::<Result<Vec<_>, _>>()?;
    let scores: Vec<_> = changes.iter().map(|row| row.after).collect();
    crate::db::query("INSERT INTO hub_dailyscore (metric,user_id,game_id,day,score,imported) SELECT $1,$2,game_id,$3,score,false FROM UNNEST($4::integer[],$5::double precision[]) AS changed(game_id,score) ON CONFLICT (metric,user_id,game_id,day) WHERE user_id IS NOT NULL DO UPDATE SET score=EXCLUDED.score, imported=false")
        .bind(metric.as_str()).bind(user_id).bind(day).bind(&ids).bind(scores).execute(&mut **tx).await?;
    record_community_scores(
        tx,
        &ids.into_iter().map(i64::from).collect::<Vec<_>>(),
        metric,
        day,
    )
    .await
}

/// Caller holds shared game locks until commit; never substitute averages of daily edit events.
pub async fn record_community_scores(
    tx: &mut Transaction<'_, Postgres>,
    game_ids: &[i64],
    metric: Metric,
    day: NaiveDate,
) -> Result<(), StoreError> {
    if game_ids.is_empty() {
        return Ok(());
    }
    let mut ids = game_ids
        .iter()
        .map(|id| i32::try_from(*id).map_err(|_| RankingError::InvalidScope))
        .collect::<Result<Vec<_>, _>>()?;
    ids.sort_unstable();
    ids.dedup();
    let average = match metric {
        Metric::Enjoyment => {
            "SELECT AVG(score) FROM hub_usergame WHERE game_id=g.bgg_id AND tier<>''"
        }
        Metric::Difficulty => {
            "SELECT AVG(difficulty_tier) FROM hub_usergame WHERE game_id=g.bgg_id AND difficulty_tier IS NOT NULL"
        }
    };
    let sql = format!(
        "INSERT INTO hub_dailyscore (metric,user_id,game_id,day,score,imported) SELECT $1,NULL,g.bgg_id,$2,({average}),false FROM hub_game g WHERE g.bgg_id=ANY($3) ON CONFLICT (metric,game_id,day) WHERE user_id IS NULL DO UPDATE SET score=EXCLUDED.score, imported=false"
    );
    crate::db::query(&sql)
        .bind(metric.as_str())
        .bind(day)
        .bind(ids)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

/// Normalize surviving rankings after catalog mutations. Caller locks all users, then games,
/// then expansions in ascending PK order before modifying shared data and calling this helper.
pub async fn recompute_all(tx: &mut Transaction<'_, Postgres>) -> Result<(), StoreError> {
    let now = Utc::now();
    let scopes = crate::db::query_as::<_,(Uuid,String)>("SELECT DISTINCT p.user_id,g.category FROM hub_usergame p JOIN hub_game g ON g.bgg_id=p.game_id WHERE p.tier<>'' OR p.difficulty_tier IS NOT NULL ORDER BY p.user_id,g.category").fetch_all(&mut **tx).await?;
    for (user_id, category) in scopes {
        for metric in [Metric::Enjoyment, Metric::Difficulty] {
            let scope = make_scope(user_id, category.parse()?, None, metric);
            recompute_scope(tx, &scope, now).await?;
        }
    }
    let scopes = crate::db::query_as::<_,(Uuid,i32)>("SELECT DISTINCT p.user_id,e.game_id FROM hub_expansionplacement p JOIN hub_expansion e ON e.id=p.expansion_id ORDER BY p.user_id,e.game_id").fetch_all(&mut **tx).await?;
    for (user_id, parent_id) in scopes {
        recompute_scope(
            tx,
            &make_scope(
                user_id,
                Category::Board,
                Some(i64::from(parent_id)),
                Metric::Enjoyment,
            ),
            now,
        )
        .await?;
    }
    Ok(())
}

async fn recompute_scope(
    tx: &mut Transaction<'_, Postgres>,
    scope: &RankingScope,
    now: DateTime<Utc>,
) -> Result<(), StoreError> {
    let rows = load(tx, scope).await?;
    let rows = ranking::ordered(&rows, scope)?;
    let mut positions = HashMap::<&str, u32>::new();
    let mut changes = Vec::new();
    for (row, score) in rows.iter().zip(ranking::scores(rows.len())) {
        let position = positions.entry(&row.tier).or_default();
        let score = if scope.metric == Metric::Difficulty {
            row.score
        } else {
            score
        };
        if row.score != score || row.position != *position {
            let id =
                Uuid::parse_str(&row.row_id).map_err(|_| RankingError::InvalidStoredRanking)?;
            if scope.metric == Metric::Difficulty {
                crate::db::query("UPDATE hub_usergame SET difficulty_position=$2 WHERE id=$1")
                    .bind(id)
                    .bind(*position as i32)
                    .execute(&mut **tx)
                    .await?;
            } else {
                let sql = if scope.game_id.is_some() {
                    "UPDATE hub_expansionplacement SET position=$2,score=$3,updated_at=$4 WHERE id=$1"
                } else {
                    "UPDATE hub_usergame SET position=$2,score=$3,updated_at=$4 WHERE id=$1"
                };
                crate::db::query(sql)
                    .bind(id)
                    .bind(*position as i32)
                    .bind(score)
                    .bind(now)
                    .execute(&mut **tx)
                    .await?;
            }
            if row.score != score {
                changes.push(ScoreChange {
                    id: row.id.clone(),
                    before: Some(row.score),
                    after: Some(score),
                });
            }
        }
        *position += 1;
    }
    if scope.game_id.is_none() {
        let user_id = Uuid::parse_str(&scope.user_id).map_err(|_| RankingError::InvalidScope)?;
        record_scores(tx, user_id, scope.metric, &changes, local_day(now)).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn daily_boundary_uses_indiana_timezone_including_winter() {
        for (timestamp, day) in [
            ("2026-09-28T01:00:00Z", "2026-09-27"),
            ("2026-09-28T04:30:00Z", "2026-09-28"),
            ("2026-01-01T04:30:00Z", "2025-12-31"),
            ("2026-01-01T05:00:00Z", "2026-01-01"),
        ] {
            assert_eq!(local_day(timestamp.parse().unwrap()).to_string(), day);
        }
    }

    #[test]
    fn database_errors_are_not_exposed_to_browsers() {
        assert_eq!(
            StoreError::Database(sqlx::Error::RowNotFound).to_string(),
            "Could not save this ranking. Please try again."
        );
        assert_eq!(StoreError::Ranking(RankingError::Stale).status_code(), 409);
    }

    async fn test_state(pool: &PgPool, user: Uuid, metric: Metric) -> Value {
        board_state(pool, user, Category::Board, None, metric)
            .await
            .unwrap()
    }

    async fn test_save(pool: &PgPool, user: Uuid, metric: Metric, entries: Value) -> Value {
        let state = test_state(pool, user, metric).await;
        save(
            pool,
            user,
            Category::Board,
            None,
            metric,
            entries,
            state["revision"].as_str().unwrap(),
        )
        .await
        .unwrap()
    }

    /// Run against a disposable database with the existing hub schema, never production.
    #[tokio::test]
    #[ignore = "requires RANKING_TEST_DATABASE_URL pointing to a migrated local PostgreSQL database"]
    async fn postgres_autosave_preserves_state_history_retries_and_concurrency() {
        let url = std::env::var("RANKING_TEST_DATABASE_URL").expect("local test database URL");
        assert!(
            url.contains("@127.0.0.1:") || url.contains("@localhost:"),
            "only local test databases are allowed"
        );
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(8)
            .connect(&url)
            .await
            .unwrap();
        let users: Vec<_> = (0..7).map(|_| Uuid::new_v4()).collect();
        let base = (Uuid::new_v4().as_u128() % 900_000_000) as i32 + 1_000_000_000;
        let games: Vec<_> = (0..8).map(|index| base + index).collect();
        for user in &users {
            crate::db::query("INSERT INTO hub_user (id,password,username,display_name,first_name,last_name,email,avatar_url,is_superuser,is_staff,is_active,date_joined,updated_at) VALUES ($1,'!',$2,'Ranking test','','','','',false,false,true,now(),now())").bind(user).bind(user.to_string()).execute(&pool).await.unwrap();
        }
        for game in &games {
            crate::db::query("INSERT INTO hub_game (bgg_id,name,description,image_url,thumbnail_url,category,categories,mechanics,designers,artists,publishers,alternate_names,expansions,suggested_players,language_dependence,fetched_at,created_at) VALUES ($1,'Ranking test','','','','board','[]','[]','[]','[]','[]','[]','[]','[]','',now(),now())").bind(game).execute(&pool).await.unwrap();
        }
        let entries = json!([{"id":games[0],"tier":"S","score":999},{"id":games[1],"tier":"F"}]);
        let first = test_save(&pool, users[0], Metric::Enjoyment, entries.clone()).await;
        assert_eq!(first["placements"][0]["score"], 10.0);
        let versions = crate::db::query_as::<_,(String,String)>("SELECT id::text,xmin::text FROM hub_usergame WHERE user_id=$1 UNION ALL SELECT id::text,xmin::text FROM hub_dailyscore WHERE user_id=$1 ORDER BY 1").bind(users[0]).fetch_all(&pool).await.unwrap();
        let retry = save(
            &pool,
            users[0],
            Category::Board,
            None,
            Metric::Enjoyment,
            entries,
            "lost response",
        )
        .await
        .unwrap();
        assert_eq!(first, retry);
        assert_eq!(versions,crate::db::query_as::<_,(String,String)>("SELECT id::text,xmin::text FROM hub_usergame WHERE user_id=$1 UNION ALL SELECT id::text,xmin::text FROM hub_dailyscore WHERE user_id=$1 ORDER BY 1").bind(users[0]).fetch_all(&pool).await.unwrap());

        let enjoyment_revision = first["revision"].as_str().unwrap();
        test_save(
            &pool,
            users[0],
            Metric::Difficulty,
            json!([{"id":games[0],"tier":"1"},{"id":games[1],"tier":"6"}]),
        )
        .await;
        assert_eq!(
            test_state(&pool, users[0], Metric::Enjoyment).await["revision"],
            enjoyment_revision
        );
        crate::db::query("UPDATE hub_usergame SET owned=true, wishlist_note='keep',rating=8,comment='review' WHERE user_id=$1 AND game_id=$2").bind(users[0]).bind(games[0]).execute(&pool).await.unwrap();
        let yesterday = local_day(Utc::now()).pred_opt().unwrap();
        crate::db::query("INSERT INTO hub_dailyscore(metric,user_id,game_id,day,score,imported) VALUES ('enjoyment',$1,$2,$3,10,false)").bind(users[0]).bind(games[0]).bind(yesterday).execute(&pool).await.unwrap();
        let second = test_save(
            &pool,
            users[0],
            Metric::Enjoyment,
            json!([{"id":games[1],"tier":"S"},{"id":games[0],"tier":"F"}]),
        )
        .await;
        let history = crate::db::query_as::<_,(NaiveDate,Option<f64>)>("SELECT day,score FROM hub_dailyscore WHERE user_id=$1 AND game_id=$2 AND metric='enjoyment' ORDER BY day").bind(users[0]).bind(games[0]).fetch_all(&pool).await.unwrap();
        assert_eq!(
            history,
            vec![(yesterday, Some(10.0)), (local_day(Utc::now()), Some(1.0))]
        );
        assert_eq!(
            save(
                &pool,
                users[0],
                Category::Board,
                None,
                Metric::Enjoyment,
                json!([]),
                enjoyment_revision
            )
            .await
            .unwrap_err()
            .status_code(),
            409
        );

        // A failed history insert rolls back association updates and deletions together.
        let trigger_name = format!("rank_fail_{}", users[0].simple());
        sqlx::raw_sql(&format!("CREATE FUNCTION {trigger_name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test history write failure'; END $$; CREATE TRIGGER {trigger_name} BEFORE INSERT ON hub_dailyscore FOR EACH ROW WHEN (NEW.user_id='{}') EXECUTE FUNCTION {trigger_name}();",users[0])).execute(&pool).await.unwrap();
        assert_eq!(
            save(
                &pool,
                users[0],
                Category::Board,
                None,
                Metric::Enjoyment,
                json!([]),
                second["revision"].as_str().unwrap()
            )
            .await
            .unwrap_err()
            .status_code(),
            500
        );
        sqlx::raw_sql(&format!(
            "DROP TRIGGER {trigger_name} ON hub_dailyscore; DROP FUNCTION {trigger_name}();"
        ))
        .execute(&pool)
        .await
        .unwrap();
        assert_eq!(test_state(&pool, users[0], Metric::Enjoyment).await, second);

        // Emptying one mode preserves the other; empty associations alone are pruned.
        test_save(&pool, users[0], Metric::Enjoyment, json!([])).await;
        assert_eq!(
            crate::db::query_scalar::<_, i64>("SELECT COUNT(*) FROM hub_usergame WHERE user_id=$1")
                .bind(users[0])
                .fetch_one(&pool)
                .await
                .unwrap(),
            2
        );
        test_save(&pool, users[0], Metric::Difficulty, json!([])).await;
        let retained = crate::db::query_as::<_, (i32, bool, String, f64, String)>(
            "SELECT game_id,owned,wishlist_note,rating,comment FROM hub_usergame WHERE user_id=$1",
        )
        .bind(users[0])
        .fetch_all(&pool)
        .await
        .unwrap();
        assert_eq!(
            retained,
            vec![(games[0], true, "keep".into(), 8.0, "review".into())]
        );

        // Different requests racing with one revision cannot silently overwrite each other.
        let initial = test_state(&pool, users[1], Metric::Enjoyment).await;
        let revision = initial["revision"].as_str().unwrap();
        let (left, right) = tokio::join!(
            save(
                &pool,
                users[1],
                Category::Board,
                None,
                Metric::Enjoyment,
                json!([{"id":games[2],"tier":"S"}]),
                revision
            ),
            save(
                &pool,
                users[1],
                Category::Board,
                None,
                Metric::Enjoyment,
                json!([{"id":games[3],"tier":"S"}]),
                revision
            )
        );
        assert_eq!(usize::from(left.is_ok()) + usize::from(right.is_ok()), 1);
        assert_eq!(
            left.err().or_else(|| right.err()).unwrap().status_code(),
            409
        );

        // Separate metrics share an association safely and do not invalidate each other's revision.
        let enjoyment = test_state(&pool, users[2], Metric::Enjoyment).await;
        let difficulty = test_state(&pool, users[2], Metric::Difficulty).await;
        let (left, right) = tokio::join!(
            save(
                &pool,
                users[2],
                Category::Board,
                None,
                Metric::Enjoyment,
                json!([{"id":games[4],"tier":"S"}]),
                enjoyment["revision"].as_str().unwrap()
            ),
            save(
                &pool,
                users[2],
                Category::Board,
                None,
                Metric::Difficulty,
                json!([{"id":games[4],"tier":"2"}]),
                difficulty["revision"].as_str().unwrap()
            )
        );
        left.unwrap();
        right.unwrap();
        assert_eq!(
            crate::db::query_as::<_, (String, i16)>(
                "SELECT tier,difficulty_tier FROM hub_usergame WHERE user_id=$1 AND game_id=$2"
            )
            .bind(users[2])
            .bind(games[4])
            .fetch_one(&pool)
            .await
            .unwrap(),
            ("S".into(), 2)
        );

        // Other players serialize on shared games, leaving one current community average.
        let left_state = test_state(&pool, users[3], Metric::Enjoyment).await;
        let right_state = test_state(&pool, users[4], Metric::Enjoyment).await;
        let (left, right) = tokio::join!(
            save(
                &pool,
                users[3],
                Category::Board,
                None,
                Metric::Enjoyment,
                json!([{"id":games[5],"tier":"S"},{"id":games[6],"tier":"S"}]),
                left_state["revision"].as_str().unwrap()
            ),
            save(
                &pool,
                users[4],
                Category::Board,
                None,
                Metric::Enjoyment,
                json!([{"id":games[6],"tier":"S"},{"id":games[5],"tier":"S"}]),
                right_state["revision"].as_str().unwrap()
            )
        );
        left.unwrap();
        right.unwrap();
        let community = crate::db::query_scalar::<_,f64>("SELECT score FROM hub_dailyscore WHERE user_id IS NULL AND game_id=ANY($1) AND metric='enjoyment'").bind(vec![games[5],games[6]]).fetch_all(&pool).await.unwrap();
        assert_eq!(community, vec![5.5, 5.5]);

        // Parent-scoped expansions use the same server scores without game history writes.
        let expansions = [Uuid::new_v4(), Uuid::new_v4()];
        for expansion in expansions {
            crate::db::query("INSERT INTO hub_expansion(id,created_at,game_id,name,thumbnail_url) VALUES ($1,now(),$2,$3,'')").bind(expansion).bind(games[0]).bind(expansion.to_string()).execute(&pool).await.unwrap();
        }
        let history_count =
            crate::db::query_scalar::<_, i64>("SELECT COUNT(*) FROM hub_dailyscore")
                .fetch_one(&pool)
                .await
                .unwrap();
        let state = board_state(
            &pool,
            users[5],
            Category::Board,
            Some(i64::from(games[0])),
            Metric::Enjoyment,
        )
        .await
        .unwrap();
        let expansion_entries =
            json!([{"id":expansions[0],"tier":"F"},{"id":expansions[1],"tier":"S"}]);
        let state = save(
            &pool,
            users[5],
            Category::Board,
            Some(i64::from(games[0])),
            Metric::Enjoyment,
            expansion_entries.clone(),
            state["revision"].as_str().unwrap(),
        )
        .await
        .unwrap();
        assert_eq!(state["placements"][0]["score"], 10.0);
        assert_eq!(
            state,
            save(
                &pool,
                users[5],
                Category::Board,
                Some(i64::from(games[0])),
                Metric::Enjoyment,
                expansion_entries,
                "lost response"
            )
            .await
            .unwrap()
        );
        assert_eq!(
            history_count,
            crate::db::query_scalar::<_, i64>("SELECT COUNT(*) FROM hub_dailyscore")
                .fetch_one(&pool)
                .await
                .unwrap()
        );

        // Reclassification normalizes both sides and refreshes affected daily averages.
        let mut tx = pool.begin().await.unwrap();
        crate::db::query("SELECT id FROM hub_user ORDER BY id FOR UPDATE")
            .fetch_all(&mut *tx)
            .await
            .unwrap();
        crate::db::query("SELECT bgg_id FROM hub_game ORDER BY bgg_id FOR UPDATE")
            .fetch_all(&mut *tx)
            .await
            .unwrap();
        crate::db::query("SELECT id FROM hub_expansion ORDER BY id FOR UPDATE")
            .fetch_all(&mut *tx)
            .await
            .unwrap();
        crate::db::query("UPDATE hub_game SET category='party' WHERE bgg_id=$1")
            .bind(games[5])
            .execute(&mut *tx)
            .await
            .unwrap();
        recompute_all(&mut tx).await.unwrap();
        tx.commit().await.unwrap();
        assert!(
            crate::db::query_scalar::<_, f64>(
                "SELECT score FROM hub_usergame WHERE game_id=ANY($1)"
            )
            .bind(vec![games[5], games[6]])
            .fetch_all(&pool)
            .await
            .unwrap()
            .iter()
            .all(|score| *score == 10.0)
        );
        assert!(crate::db::query_scalar::<_,f64>("SELECT score FROM hub_dailyscore WHERE user_id IS NULL AND game_id=ANY($1) AND metric='enjoyment'").bind(vec![games[5],games[6]]).fetch_all(&pool).await.unwrap().iter().all(|score|*score==10.0));

        // Remove only this test's synthetic records, honoring Django's non-cascading FKs.
        let mut tx = pool.begin().await.unwrap();
        crate::db::query("DELETE FROM hub_dailyscore WHERE game_id=ANY($1)")
            .bind(&games)
            .execute(&mut *tx)
            .await
            .unwrap();
        crate::db::query("DELETE FROM hub_expansionplacement WHERE user_id=ANY($1)")
            .bind(&users)
            .execute(&mut *tx)
            .await
            .unwrap();
        crate::db::query("DELETE FROM hub_usergame WHERE user_id=ANY($1)")
            .bind(&users)
            .execute(&mut *tx)
            .await
            .unwrap();
        crate::db::query("DELETE FROM hub_expansion WHERE game_id=ANY($1)")
            .bind(&games)
            .execute(&mut *tx)
            .await
            .unwrap();
        crate::db::query("DELETE FROM hub_game WHERE bgg_id=ANY($1)")
            .bind(&games)
            .execute(&mut *tx)
            .await
            .unwrap();
        crate::db::query("DELETE FROM hub_user WHERE id=ANY($1)")
            .bind(&users)
            .execute(&mut *tx)
            .await
            .unwrap();
        tx.commit().await.unwrap();
    }
}
