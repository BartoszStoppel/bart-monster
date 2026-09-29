//! Explicit application mutations; identity and scores are never supplied by the browser.
use crate::{
    AppError, AppState, Result,
    auth::{AuthSession, CurrentUser},
    bgg, ranking_store,
};
use axum::{Json, extract::State, http::HeaderMap};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

#[derive(Deserialize)]
pub struct Action {
    pub action: String,
    pub args: Value,
}
fn text<'a>(args: &'a Value, key: &str, max: usize) -> Result<&'a str> {
    let v = args[key]
        .as_str()
        .ok_or_else(|| AppError::bad(format!("{key} is required.")))?;
    if v.chars().count() > max {
        return Err(AppError::bad(format!("{key} is too long.")));
    }
    Ok(v)
}
fn id(args: &Value, key: &str) -> Result<i32> {
    args[key]
        .as_i64()
        .filter(|n| *n > 0 && *n <= i32::MAX as i64)
        .map(|n| n as i32)
        .ok_or_else(|| AppError::bad("Invalid game ID."))
}
fn uuid(args: &Value, key: &str) -> Result<Uuid> {
    Uuid::parse_str(args[key].as_str().unwrap_or(""))
        .map_err(|_| AppError::bad("Invalid record ID."))
}
fn staff(user: &CurrentUser) -> Result<()> {
    if user.is_staff {
        Ok(())
    } else {
        Err(AppError::forbidden())
    }
}
fn category(args: &Value) -> Result<&str> {
    let c = args["category"].as_str().unwrap_or("");
    if matches!(c, "board" | "party") {
        Ok(c)
    } else {
        Err(AppError::bad("Choose board or party games."))
    }
}
fn optional_positive(args: &Value, key: &str, max: i64) -> Result<Option<i32>> {
    let value = args
        .get(key)
        .ok_or_else(|| AppError::bad(format!("Missing {key}.")))?;
    if value.is_null() {
        return Ok(None);
    }
    value
        .as_i64()
        .filter(|v| *v >= 1 && *v <= max)
        .map(|v| Some(v as i32))
        .ok_or_else(|| AppError::bad(format!("Invalid {key}.")))
}
async fn lock_all(tx: &mut Transaction<'_, Postgres>) -> Result<()> {
    crate::db::query("SELECT id FROM hub_user ORDER BY id FOR UPDATE")
        .fetch_all(&mut **tx)
        .await?;
    crate::db::query("SELECT bgg_id FROM hub_game ORDER BY bgg_id FOR UPDATE")
        .fetch_all(&mut **tx)
        .await?;
    crate::db::query("SELECT id FROM hub_expansion ORDER BY id FOR UPDATE")
        .fetch_all(&mut **tx)
        .await?;
    Ok(())
}
async fn personal(state: &AppState, user: &CurrentUser, name: &str, args: &Value) -> Result<()> {
    let gid = id(args, "bggId")?;
    let mut tx = state.db.begin().await?;
    crate::db::query("SELECT id FROM hub_user WHERE id=$1 FOR UPDATE")
        .bind(user.id)
        .fetch_one(&mut *tx)
        .await?;
    let exists: bool =
        crate::db::query_scalar("SELECT EXISTS(SELECT 1 FROM hub_game WHERE bgg_id=$1)")
            .bind(gid)
            .fetch_one(&mut *tx)
            .await?;
    if !exists {
        return Err(AppError::bad("Game not found."));
    }
    crate::db::query("INSERT INTO hub_usergame(id,created_at,user_id,game_id,owned,wishlist,wishlist_note,comment,tier,position,updated_at,difficulty_position,legacy_ids) VALUES($1,now(),$2,$3,false,false,'','','',0,now(),0,'{}') ON CONFLICT(user_id,game_id) DO NOTHING").bind(Uuid::new_v4()).bind(user.id).bind(gid).execute(&mut *tx).await?;
    if name == "updateRating" {
        let rating = if args["rating"].is_null() {
            None
        } else {
            Some(
                args["rating"]
                    .as_f64()
                    .filter(|n| n.is_finite() && *n >= 1.0 && *n <= 10.0)
                    .ok_or_else(|| AppError::bad("Rating must be between 1 and 10."))?,
            )
        };
        let comment = args
            .get("comment")
            .map(|_| text(args, "comment", 10000))
            .transpose()?
            .unwrap_or("");
        crate::db::query("UPDATE hub_usergame SET rating=$3,comment=$4,rating_created_at=coalesce(rating_created_at,now()),rating_updated_at=now() WHERE user_id=$1 AND game_id=$2").bind(user.id).bind(gid).bind(rating).bind(comment).execute(&mut *tx).await?;
    } else {
        let optional_bool = |key: &str| -> Result<Option<bool>> {
            args.get(key)
                .map(|v| {
                    v.as_bool()
                        .ok_or_else(|| AppError::bad(format!("Invalid {key}.")))
                })
                .transpose()
        };
        let mut owned = optional_bool("owned")?;
        let mut wishlist = optional_bool("wishlist")?;
        match name {
            "moveToOwned" => {
                owned = Some(true);
                wishlist = Some(false)
            }
            "addToWishlist" => wishlist = Some(true),
            "removeFromWishlist" => wishlist = Some(false),
            _ => {}
        }
        let priority = if args["wishlist_priority"].is_null() {
            None
        } else {
            Some(
                args["wishlist_priority"]
                    .as_i64()
                    .filter(|p| (1..=3).contains(p))
                    .ok_or_else(|| AppError::bad("Priority must be between 1 and 3."))?
                    as i16,
            )
        };
        let note = args
            .get("wishlist_note")
            .map(|value| {
                if value.is_null() {
                    Ok("")
                } else {
                    text(args, "wishlist_note", 10000)
                }
            })
            .transpose()?;
        crate::db::query("UPDATE hub_usergame SET owned=coalesce($3,owned),wishlist=coalesce($4,wishlist),wishlist_priority=CASE WHEN $5 THEN $6 ELSE wishlist_priority END,wishlist_note=coalesce($7,wishlist_note),collection_added_at=coalesce(collection_added_at,now()) WHERE user_id=$1 AND game_id=$2").bind(user.id).bind(gid).bind(owned).bind(wishlist).bind(args.get("wishlist_priority").is_some()).bind(priority).bind(note).execute(&mut *tx).await?;
    }
    crate::db::query("DELETE FROM hub_usergame WHERE user_id=$1 AND game_id=$2 AND NOT owned AND NOT wishlist AND wishlist_priority IS NULL AND wishlist_note='' AND rating IS NULL AND comment='' AND tier='' AND difficulty_tier IS NULL").bind(user.id).bind(gid).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(())
}
async fn delete_game(tx: &mut Transaction<'_, Postgres>, gid: i32) -> Result<()> {
    crate::db::query("DELETE FROM hub_expansionplacement WHERE expansion_id IN (SELECT id FROM hub_expansion WHERE game_id=$1)").bind(gid).execute(&mut **tx).await?;
    for table in [
        "hub_expansion",
        "hub_rulebook",
        "hub_rulesanswer",
        "hub_rulesrun",
        "hub_usergame",
        "hub_dailyscore",
    ] {
        crate::db::query(&format!("DELETE FROM {table} WHERE game_id=$1"))
            .bind(gid)
            .execute(&mut **tx)
            .await?;
    }
    crate::db::query("DELETE FROM hub_game WHERE bgg_id=$1")
        .bind(gid)
        .execute(&mut **tx)
        .await?;
    Ok(())
}
async fn insert_game(
    state: &AppState,
    user: &CurrentUser,
    args: &Value,
    refresh: bool,
) -> Result<()> {
    let raw = &args["game"];
    let gid = raw["bgg_id"]
        .as_i64()
        .or(raw["id"].as_i64())
        .ok_or_else(|| AppError::bad("Invalid game."))?;
    if !(1..=i32::MAX as i64).contains(&gid) {
        return Err(AppError::bad("Invalid game ID."));
    }
    if refresh {
        staff(user)?;
    } else if crate::db::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM hub_game WHERE bgg_id=$1)",
    )
    .bind(gid as i32)
    .fetch_one(crate::db::pool(&state.db))
    .await?
    {
        return Ok(());
    }
    let cat = category(args)?;
    let mut game = bgg::details(state, gid).await?;
    for (field, camel, max) in [
        ("min_players", "minPlayers", 99),
        ("max_players", "maxPlayers", 99),
        ("playing_time", "playingTime", 9999),
    ] {
        if let Some(value) = raw.get(field).or(raw.get(camel)) {
            let n = value
                .as_i64()
                .filter(|v| *v >= 1 && *v <= max)
                .ok_or_else(|| AppError::bad("Invalid player count or duration."))?;
            game[field] = json!(n);
        }
    }
    if game["min_players"]
        .as_i64()
        .zip(game["max_players"].as_i64())
        .is_some_and(|(a, b)| a > b)
    {
        return Err(AppError::bad(
            "Minimum players cannot exceed maximum players.",
        ));
    }
    game["category"] = json!(cat);
    game["created_at"] = json!(chrono::Utc::now());
    game["fetched_at"] = json!(chrono::Utc::now());
    let mut tx = state.db.begin().await?;
    lock_all(&mut tx).await?;
    let existing: Option<String> =
        crate::db::query_scalar("SELECT category FROM hub_game WHERE bgg_id=$1")
            .bind(gid as i32)
            .fetch_optional(&mut *tx)
            .await?;
    if let Some(old) = existing.as_ref() {
        if !refresh {
            return Ok(());
        }
        game["category"] = json!(old);
        let created: chrono::DateTime<chrono::Utc> =
            crate::db::query_scalar("SELECT created_at FROM hub_game WHERE bgg_id=$1")
                .bind(gid as i32)
                .fetch_one(&mut *tx)
                .await?;
        game["created_at"] = json!(created);
    }
    let columns = [
        "bgg_id",
        "name",
        "description",
        "image_url",
        "thumbnail_url",
        "category",
        "year_published",
        "min_players",
        "max_players",
        "playing_time",
        "min_play_time",
        "max_play_time",
        "min_age",
        "bgg_rating",
        "categories",
        "mechanics",
        "designers",
        "artists",
        "publishers",
        "alternate_names",
        "expansions",
        "suggested_players",
        "suggested_age",
        "language_dependence",
        "bgg_users_rated",
        "bgg_std_dev",
        "bgg_owned",
        "bgg_wanting",
        "bgg_wishing",
        "fetched_at",
        "created_at",
    ];
    let names = columns.join(",");
    let updates = columns
        .iter()
        .filter(|&&c| c != "bgg_id" && c != "created_at")
        .map(|c| format!("{c}=EXCLUDED.{c}"))
        .collect::<Vec<_>>()
        .join(",");
    crate::db::query(&format!("INSERT INTO hub_game({names}) SELECT {names} FROM jsonb_populate_record(NULL::hub_game,$1) ON CONFLICT(bgg_id) DO UPDATE SET {updates}")).bind(game).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(())
}

pub async fn action(
    State(state): State<AppState>,
    session: AuthSession,
    headers: HeaderMap,
    Json(request): Json<Action>,
) -> Result<Json<Value>> {
    crate::auth::require_csrf(&headers, &session).map_err(|_| AppError::forbidden())?;
    let user = &session.user;
    let args = &request.args;
    if !args.is_object() {
        return Err(AppError::bad("Invalid action arguments."));
    }
    match request.action.as_str() {
        name @ ("updateCollection" | "updateRating" | "moveToOwned" | "removeFromWishlist"
        | "addToWishlist") => personal(&state, user, name, args).await?,
        "updateProfile" => {
            let name = text(args, "display_name", 150)?.trim();
            if name.is_empty() {
                return Err(AppError::bad("A display name is required."));
            }
            crate::db::query("UPDATE hub_user SET display_name=$2,updated_at=now() WHERE id=$1")
                .bind(user.id)
                .bind(name)
                .execute(crate::db::pool(&state.db))
                .await?;
        }
        "addGame" => insert_game(&state, user, args, false).await?,
        "refreshGame" => insert_game(&state, user, args, true).await?,
        "updateGame" | "updateCategory" => {
            staff(user)?;
            let gid = id(args, "bggId")?;
            let cat = category(args)?;
            let mut tx = state.db.begin().await?;
            lock_all(&mut tx).await?;
            if request.action == "updateGame" {
                let min = optional_positive(args, "minPlayers", 99)?;
                let max = optional_positive(args, "maxPlayers", 99)?;
                if min.zip(max).is_some_and(|(min, max)| min > max) {
                    return Err(AppError::bad(
                        "Minimum players cannot exceed maximum players.",
                    ));
                }
                let time = optional_positive(args, "playingTime", 9999)?;
                crate::db::query("UPDATE hub_game SET category=$2,min_players=$3,max_players=$4,playing_time=$5 WHERE bgg_id=$1").bind(gid).bind(cat).bind(min).bind(max).bind(time).execute(&mut *tx).await?;
            } else {
                crate::db::query("UPDATE hub_game SET category=$2 WHERE bgg_id=$1")
                    .bind(gid)
                    .bind(cat)
                    .execute(&mut *tx)
                    .await?;
            }
            ranking_store::recompute_all(&mut tx).await?;
            tx.commit().await?;
        }
        "deleteGame" => {
            staff(user)?;
            let gid = id(args, "bggId")?;
            let mut tx = state.db.begin().await?;
            lock_all(&mut tx).await?;
            delete_game(&mut tx, gid).await?;
            ranking_store::recompute_all(&mut tx).await?;
            tx.commit().await?;
        }
        "submitFeedback" => {
            let title = text(args, "title", 300)?.trim();
            let description = text(args, "description", 50000)?.trim();
            let category = text(args, "category", 20)?;
            if title.is_empty()
                || description.is_empty()
                || !matches!(category, "feature" | "bug" | "improvement")
            {
                return Err(AppError::bad(
                    "Enter a title, description, and valid category.",
                ));
            }
            crate::db::query("INSERT INTO hub_feedback(id,created_at,user_id,title,description,category,status,admin_note,updated_at) VALUES($1,now(),$2,$3,$4,$5,'new','',now())").bind(Uuid::new_v4()).bind(user.id).bind(title).bind(description).bind(category).execute(crate::db::pool(&state.db)).await?;
        }
        "updateFeedbackStatus" => {
            staff(user)?;
            let fid = uuid(args, "feedbackId")?;
            let status = text(args, "status", 20)?;
            if !matches!(
                status,
                "new" | "planned" | "in-progress" | "done" | "declined"
            ) {
                return Err(AppError::bad("Invalid feedback status."));
            }
            let note = args
                .get("adminNote")
                .map(|_| text(args, "adminNote", 10000))
                .transpose()?;
            crate::db::query("UPDATE hub_feedback SET status=$2,admin_note=coalesce($3,admin_note),updated_at=now() WHERE id=$1").bind(fid).bind(status).bind(note).execute(crate::db::pool(&state.db)).await?;
        }
        "deleteFeedback" => {
            let count = crate::db::query(
                "DELETE FROM hub_feedback WHERE id=$1 AND ($2 OR (user_id=$3 AND status='new'))",
            )
            .bind(uuid(args, "feedbackId")?)
            .bind(user.is_staff)
            .bind(user.id)
            .execute(crate::db::pool(&state.db))
            .await?
            .rows_affected();
            if count == 0 {
                return Err(AppError::forbidden());
            }
        }
        "setUserAdmin" => {
            staff(user)?;
            let target = uuid(args, "targetUserId")?;
            let value = args["newValue"]
                .as_bool()
                .ok_or_else(|| AppError::bad("Invalid role."))?;
            if target == user.id {
                return Err(AppError::bad("You cannot change your own admin role."));
            }
            crate::db::query(
                "UPDATE hub_user SET is_staff=$2,is_superuser=$2,updated_at=now() WHERE id=$1",
            )
            .bind(target)
            .bind(value)
            .execute(crate::db::pool(&state.db))
            .await?;
        }
        "addExpansionsToBank" => {
            staff(user)?;
            let gid = id(args, "gameBggId")?;
            let entries = args["expansions"]
                .as_array()
                .filter(|a| !a.is_empty() && a.len() <= 100)
                .ok_or_else(|| AppError::bad("Select up to 100 expansions."))?;
            let mut rows = Vec::new();
            for entry in entries {
                let name = text(entry, "name", 500)?.trim();
                if name.is_empty() {
                    return Err(AppError::bad("Expansion name is required."));
                }
                let eid = entry["bggExpansionId"]
                    .as_i64()
                    .map(|id| {
                        i32::try_from(id)
                            .ok()
                            .filter(|n| *n > 0)
                            .ok_or_else(|| AppError::bad("Invalid expansion ID."))
                    })
                    .transpose()?;
                rows.push((name.to_string(), eid));
            }
            let ids = rows
                .iter()
                .filter_map(|(_, id)| id.map(|v| v.to_string()))
                .collect::<Vec<_>>()
                .join(",");
            let mut images = std::collections::HashMap::new();
            if !ids.is_empty()
                && let Ok(xml) = bgg::fetch_xml(&state, "thing", &[("id", ids)]).await
                && let Ok(doc) = roxmltree::Document::parse(&xml)
            {
                for item in doc.descendants().filter(|n| n.has_tag_name("item")) {
                    if let Some(id) = item.attribute("id").and_then(|s| s.parse::<i32>().ok()) {
                        let image = item
                            .children()
                            .find(|n| n.has_tag_name("thumbnail"))
                            .and_then(|n| n.text())
                            .unwrap_or("");
                        images.insert(id, image.to_string());
                    }
                }
            }
            let mut tx = state.db.begin().await?;
            lock_all(&mut tx).await?;
            for (name, eid) in rows {
                crate::db::query("INSERT INTO hub_expansion(id,created_at,game_id,name,bgg_expansion_id,thumbnail_url) VALUES($1,now(),$2,$3,$4,$5) ON CONFLICT(game_id,name) DO NOTHING").bind(Uuid::new_v4()).bind(gid).bind(name).bind(eid).bind(eid.and_then(|id|images.get(&id)).map(String::as_str).unwrap_or("")).execute(&mut *tx).await?;
            }
            tx.commit().await?;
        }
        "removeExpansionFromBank" => {
            staff(user)?;
            let eid = uuid(args, "expansionId")?;
            let gid = id(args, "gameBggId")?;
            let mut tx = state.db.begin().await?;
            lock_all(&mut tx).await?;
            let valid: bool = crate::db::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM hub_expansion WHERE id=$1 AND game_id=$2)",
            )
            .bind(eid)
            .bind(gid)
            .fetch_one(&mut *tx)
            .await?;
            if !valid {
                return Err(AppError::bad("Expansion does not belong to this game."));
            }
            crate::db::query("DELETE FROM hub_expansionplacement WHERE expansion_id=$1")
                .bind(eid)
                .execute(&mut *tx)
                .await?;
            crate::db::query("DELETE FROM hub_expansion WHERE id=$1")
                .bind(eid)
                .execute(&mut *tx)
                .await?;
            ranking_store::recompute_all(&mut tx).await?;
            tx.commit().await?;
        }
        "saveGameRules" => {
            staff(user)?;
            let gid = id(args, "bggId")?;
            let name = text(args, "moduleName", 300)?.trim();
            let kind = text(args, "moduleType", 10)?;
            let content = text(args, "contentMd", 500000)?;
            let source = args["source"].as_str().unwrap_or("");
            if name.is_empty()
                || content.trim().is_empty()
                || !matches!(kind, "base" | "expansion")
                || source.len() > 4000
            {
                return Err(AppError::bad("Invalid rulebook module."));
            }
            crate::db::query("INSERT INTO hub_rulebook(id,created_at,game_id,module_name,module_type,content_md,token_estimate,source,created_by_id,updated_at) VALUES($1,now(),$2,$3,$4,$5,$6,$7,$8,now()) ON CONFLICT(game_id,module_name) DO UPDATE SET module_type=EXCLUDED.module_type,content_md=EXCLUDED.content_md,token_estimate=EXCLUDED.token_estimate,source=EXCLUDED.source,updated_at=now()").bind(Uuid::new_v4()).bind(gid).bind(name).bind(kind).bind(content).bind(content.len().div_ceil(4) as i32).bind(source).bind(user.id).execute(crate::db::pool(&state.db)).await?;
        }
        "deleteGameRules" => {
            staff(user)?;
            crate::db::query("DELETE FROM hub_rulebook WHERE id=$1")
                .bind(uuid(args, "id")?)
                .execute(crate::db::pool(&state.db))
                .await?;
        }
        "heartbeat" => {
            let seconds = args["seconds"].as_i64().unwrap_or(0).clamp(0, 60) as i32;
            let visit = args["is_visit"].as_bool().unwrap_or(false);
            crate::db::query("INSERT INTO hub_activity(user_id,visit_count,total_seconds,last_seen_at) VALUES($1,$2,0,now()) ON CONFLICT(user_id) DO UPDATE SET total_seconds=hub_activity.total_seconds+LEAST($3,GREATEST(0,EXTRACT(EPOCH FROM now()-hub_activity.last_seen_at)::integer)),visit_count=hub_activity.visit_count+CASE WHEN hub_activity.last_seen_at<now()-interval '30 minutes' THEN 1 ELSE 0 END,last_seen_at=now()").bind(user.id).bind(if visit{1i32}else{0i32}).bind(seconds).execute(crate::db::pool(&state.db)).await?;
        }
        _ => return Err(AppError::bad("Unknown action.")),
    }
    Ok(Json(json!({"ok":true})))
}
