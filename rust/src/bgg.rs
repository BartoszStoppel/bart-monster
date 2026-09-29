//! Bounded, cached external reads. Upstream tokens never reach the browser.
use crate::{AppError, AppState, Result, auth::CurrentUser};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};
use bytes::Bytes;
use image::ImageReader;
use roxmltree::{Document, Node};
use serde::Deserialize;
use serde_json::{Value, json};
use std::io::Cursor;
use std::{
    collections::HashMap,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};

static CACHE: OnceLock<Mutex<HashMap<String, (Instant, Bytes)>>> = OnceLock::new();
fn cache_get(key: &str) -> Option<Bytes> {
    CACHE
        .get_or_init(Default::default)
        .lock()
        .ok()?
        .get(key)
        .filter(|(at, _)| at.elapsed() < Duration::from_secs(3600))
        .map(|(_, v)| v.clone())
}
fn cache_put(key: String, value: Bytes) {
    if value.len() > 2_000_000 {
        return;
    }
    let mut cache = CACHE.get_or_init(Default::default).lock().unwrap();
    if cache.len() >= 64 {
        cache.retain(|_, (at, _)| at.elapsed() < Duration::from_secs(300));
        if cache.len() >= 64 {
            cache.clear();
        }
    }
    cache.insert(key, (Instant::now(), value));
}
async fn bounded(mut response: reqwest::Response, limit: usize) -> Result<Bytes> {
    if !response.status().is_success() {
        return Err(AppError::upstream(
            "The external service is busy. Please try again.",
        ));
    }
    if response
        .content_length()
        .is_some_and(|size| size > limit as u64)
    {
        return Err(AppError::upstream("The external response is too large."));
    }
    let mut out = Vec::new();
    while let Some(chunk) = response.chunk().await? {
        if out.len() + chunk.len() > limit {
            return Err(AppError::upstream("The external response is too large."));
        }
        out.extend_from_slice(&chunk)
    }
    Ok(out.into())
}
pub async fn fetch_xml(
    state: &AppState,
    endpoint: &str,
    params: &[(&str, String)],
) -> Result<String> {
    if !matches!(
        endpoint,
        "search" | "thing" | "forumlist" | "forum" | "thread"
    ) {
        return Err(AppError::bad("Invalid BGG endpoint."));
    }
    let key = format!("bgg:{endpoint}:{params:?}");
    if let Some(v) = cache_get(&key) {
        return String::from_utf8(v.to_vec())
            .map_err(|_| AppError::upstream("Invalid BGG response."));
    }
    let response = state
        .http
        .get(format!("https://boardgamegeek.com/xmlapi2/{endpoint}"))
        .query(params)
        .bearer_auth(std::env::var("BGG_API_TOKEN").unwrap_or_default())
        .send()
        .await?;
    let bytes = bounded(response, 8_000_000).await?;
    let xml = String::from_utf8(bytes.to_vec())
        .map_err(|_| AppError::upstream("Invalid BGG response."))?;
    let doc = Document::parse(&xml).map_err(|_| AppError::upstream("Invalid BGG response."))?;
    if doc.descendants().any(|n| n.has_tag_name("error")) {
        return Err(AppError::upstream(
            "BoardGameGeek could not find this item.",
        ));
    }
    cache_put(key, bytes);
    Ok(xml)
}
fn child<'a, 'i>(node: Node<'a, 'i>, tag: &str) -> Option<Node<'a, 'i>> {
    node.children().find(|n| n.has_tag_name(tag))
}
fn number(node: Option<Node<'_, '_>>) -> Value {
    node.and_then(|n| n.attribute("value"))
        .and_then(|x| x.parse::<f64>().ok())
        .filter(|v| v.is_finite())
        .map_or(Value::Null, |n| {
            if n.fract() == 0.0 {
                json!(n as i64)
            } else {
                json!(n)
            }
        })
}
fn text(node: Node<'_, '_>, tag: &str) -> String {
    child(node, tag).and_then(|n| n.text()).unwrap_or("").into()
}
fn links(node: Node<'_, '_>, tag: &str) -> Value {
    json!(
        node.children()
            .filter(|n| n.has_tag_name("link") && n.attribute("type") == Some(tag))
            .filter_map(|n| n.attribute("value"))
            .collect::<Vec<_>>()
    )
}
pub fn strip_markup(value: &str) -> String {
    static TAGS: OnceLock<regex::Regex> = OnceLock::new();
    let decoded = html_escape::decode_html_entities(value);
    TAGS.get_or_init(|| regex::Regex::new(r"<[^>]*>").unwrap())
        .replace_all(&decoded, "")
        .into_owned()
}
fn parse_game(xml: &str, id: i64) -> Result<Value> {
    let doc = Document::parse(xml).map_err(|_| AppError::upstream("Invalid BGG response."))?;
    let item = doc
        .descendants()
        .find(|n| {
            n.has_tag_name("item")
                && n.attribute("id").and_then(|s| s.parse::<i64>().ok()) == Some(id)
        })
        .ok_or(AppError {
            status: StatusCode::NOT_FOUND,
            message: "Game not found.".into(),
        })?;
    let name = item
        .children()
        .find(|n| n.has_tag_name("name") && n.attribute("type") == Some("primary"))
        .or_else(|| child(item, "name"))
        .and_then(|n| n.attribute("value"))
        .unwrap_or("Untitled game");
    let ratings = child(item, "statistics").and_then(|n| child(n, "ratings"));
    let mut game = json!({"bgg_id":id,"name":name,"description":strip_markup(&text(item,"description")),"image_url":text(item,"image"),"thumbnail_url":text(item,"thumbnail"),"suggested_age":null,"language_dependence":""});
    for (field, tag) in [
        ("year_published", "yearpublished"),
        ("min_players", "minplayers"),
        ("max_players", "maxplayers"),
        ("playing_time", "playingtime"),
        ("min_play_time", "minplaytime"),
        ("max_play_time", "maxplaytime"),
        ("min_age", "minage"),
    ] {
        game[field] = number(child(item, tag));
    }
    for (field, tag) in [
        ("categories", "boardgamecategory"),
        ("mechanics", "boardgamemechanic"),
        ("designers", "boardgamedesigner"),
        ("artists", "boardgameartist"),
        ("publishers", "boardgamepublisher"),
    ] {
        game[field] = links(item, tag);
    }
    for (field, tag) in [
        ("bgg_rating", "average"),
        ("bgg_std_dev", "stddev"),
        ("bgg_users_rated", "usersrated"),
        ("bgg_owned", "owned"),
        ("bgg_wanting", "wanting"),
        ("bgg_wishing", "wishing"),
    ] {
        game[field] = number(ratings.and_then(|n| child(n, tag)));
    }
    game["alternate_names"] = json!(
        item.children()
            .filter(|n| n.has_tag_name("name") && n.attribute("type") == Some("alternate"))
            .filter_map(|n| n.attribute("value"))
            .collect::<Vec<_>>()
    );
    game["expansions"] = json!(
        item.children()
            .filter(|n| n.has_tag_name("link")
                && n.attribute("type") == Some("boardgameexpansion")
                && n.attribute("inbound") != Some("true"))
            .filter_map(|n| Some(
                json!({"id":n.attribute("id")?.parse::<i64>().ok()?,"name":n.attribute("value")})
            ))
            .collect::<Vec<_>>()
    );
    let mut players = vec![];
    for poll in item.children().filter(|n| n.has_tag_name("poll")) {
        let name = poll.attribute("name").unwrap_or("");
        if name == "suggested_numplayers" {
            for results in poll.children().filter(|n| n.has_tag_name("results")) {
                let votes = |label: &str| {
                    results
                        .children()
                        .find(|n| n.attribute("value") == Some(label))
                        .and_then(|n| n.attribute("numvotes"))
                        .and_then(|v| v.parse::<i64>().ok())
                        .unwrap_or(0)
                };
                players.push(json!({"numPlayers":results.attribute("numplayers"),"best":votes("Best"),"recommended":votes("Recommended"),"notRecommended":votes("Not Recommended")}));
            }
        } else if matches!(name, "suggested_playerage" | "language_dependence")
            && let Some(winner) = poll
                .descendants()
                .filter(|n| n.has_tag_name("result"))
                .max_by_key(|n| {
                    n.attribute("numvotes")
                        .and_then(|v| v.parse::<i64>().ok())
                        .unwrap_or(0)
                })
        {
            let value = winner.attribute("value").unwrap_or("");
            if name == "suggested_playerage" {
                game["suggested_age"] = value
                    .trim_end_matches('+')
                    .parse::<i32>()
                    .map_or(Value::Null, |n| json!(n));
            } else {
                game["language_dependence"] = json!(value);
            }
        }
    }
    game["suggested_players"] = json!(players);
    Ok(game)
}
pub async fn details(state: &AppState, id: i64) -> Result<Value> {
    if !(1..=i32::MAX as i64).contains(&id) {
        return Err(AppError::bad("Invalid game ID."));
    }
    let xml = fetch_xml(
        state,
        "thing",
        &[("id", id.to_string()), ("stats", "1".into())],
    )
    .await?;
    parse_game(&xml, id)
}
fn camel(key: &str) -> String {
    let mut parts = key.split('_');
    let mut out = parts.next().unwrap_or("").to_string();
    for part in parts {
        let mut chars = part.chars();
        if let Some(first) = chars.next() {
            out.extend(first.to_uppercase());
            out.extend(chars)
        }
    }
    out
}
pub async fn details_route(
    State(state): State<AppState>,
    _user: CurrentUser,
    Path(id): Path<i64>,
) -> Result<Json<Value>> {
    let game = details(&state, id).await?;
    let mut public = serde_json::Map::new();
    for (key, value) in game.as_object().unwrap() {
        public.insert(
            if key == "bgg_id" {
                "id".into()
            } else {
                camel(key)
            },
            value.clone(),
        );
    }
    Ok(Json(json!({"game":public})))
}
#[derive(Deserialize)]
pub struct Search {
    q: String,
}
pub async fn search_route(
    State(state): State<AppState>,
    _user: CurrentUser,
    Query(input): Query<Search>,
) -> Result<Json<Value>> {
    let q = input.q.trim();
    if q.len() < 2 {
        return Ok(Json(json!({"results":[]})));
    }
    if q.len() > 200 {
        return Err(AppError::bad("Search is too long."));
    }
    let xml = fetch_xml(
        &state,
        "search",
        &[("query", q.into()), ("type", "boardgame".into())],
    )
    .await?;
    let mut results = {
        let doc = Document::parse(&xml).map_err(|_| AppError::upstream("Invalid BGG response."))?;
        doc.descendants().filter(|n|n.has_tag_name("item")).filter_map(|n|Some(json!({"id":n.attribute("id")?.parse::<i64>().ok()?,"name":child(n,"name")?.attribute("value")?,"yearPublished":number(child(n,"yearpublished"))}))).collect::<Vec<_>>()
    };
    let lower = q.to_lowercase();
    let relevance = |v: &Value| {
        let name = v["name"].as_str().unwrap_or("").to_lowercase();
        let score = if name == lower {
            100
        } else if name.starts_with(&lower) {
            80
        } else if name.split_whitespace().any(|word| word.starts_with(&lower)) {
            60
        } else if name.contains(&lower) {
            40
        } else {
            20
        };
        (score, v["yearPublished"].as_i64().unwrap_or(0))
    };
    results.sort_by_key(|v| std::cmp::Reverse(relevance(v)));
    results.truncate(20);
    if !results.is_empty() {
        let ids = results
            .iter()
            .map(|r| r["id"].to_string())
            .collect::<Vec<_>>()
            .join(",");
        if let Ok(xml) = fetch_xml(&state, "thing", &[("id", ids)]).await
            && let Ok(doc) = Document::parse(&xml)
        {
            for row in &mut results {
                if let Some(item) = doc.descendants().find(|n| {
                    n.has_tag_name("item")
                        && n.attribute("id").and_then(|x| x.parse::<i64>().ok())
                            == row["id"].as_i64()
                }) {
                    row["thumbnailUrl"] = json!(text(item, "thumbnail"));
                    row["minPlayers"] = number(child(item, "minplayers"));
                    row["maxPlayers"] = number(child(item, "maxplayers"));
                }
            }
        }
    }
    Ok(Json(json!({"results":results})))
}
#[derive(Deserialize)]
pub struct ImageQuery {
    url: String,
    w: Option<u32>,
}
pub async fn image_proxy(
    State(state): State<AppState>,
    Query(query): Query<ImageQuery>,
) -> Result<Response> {
    let url = url::Url::parse(&query.url).map_err(|_| AppError::bad("Invalid image URL."))?;
    let host = url.host_str().unwrap_or("");
    if url.scheme() != "https"
        || url.port().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
        || !(host == "cf.geekdo-images.com"
            || host == "cf.geekdo-static.com"
            || host.ends_with(".googleusercontent.com"))
    {
        return Err(AppError::bad("Unsupported image host."));
    }
    let width = query.w.unwrap_or(256).clamp(16, 1200);
    let key = format!("image:{width}:{url}");
    let bytes = if let Some(bytes) = cache_get(&key) {
        bytes
    } else {
        let body = bounded(state.http.get(url).send().await?, 6_000_000).await?;
        let output =
            tokio::task::spawn_blocking(move || -> std::result::Result<Vec<u8>, String> {
                let mut reader = ImageReader::new(Cursor::new(body))
                    .with_guessed_format()
                    .map_err(|_| "Invalid image")?;
                let mut limits = image::Limits::default();
                limits.max_image_width = Some(10000);
                limits.max_image_height = Some(10000);
                limits.max_alloc = Some(80_000_000);
                reader.limits(limits);
                let img = reader
                    .decode()
                    .map_err(|_| "Invalid image")?
                    .thumbnail(width, width);
                let mut bytes = Cursor::new(Vec::new());
                img.write_to(&mut bytes, image::ImageFormat::Png)
                    .map_err(|_| "Invalid image")?;
                Ok(bytes.into_inner())
            })
            .await
            .map_err(|_| AppError::upstream("Could not load image."))?
            .map_err(AppError::upstream)?;
        let bytes: Bytes = output.into();
        cache_put(key, bytes.clone());
        bytes
    };
    Ok((
        [
            (header::CONTENT_TYPE, "image/png"),
            (
                header::CACHE_CONTROL,
                "public, max-age=3600, s-maxage=86400",
            ),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff"),
        ],
        bytes,
    )
        .into_response())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parser_ignores_retired_bgg_difficulty() {
        let game=parse_game(r#"<items><item id="13"><name type="primary" value="Catan"/><statistics><ratings><average value="7.2"/><averageweight value="4.8"/></ratings></statistics><poll name="suggested_numplayers"><results numplayers="4"><result value="Best" numvotes="10"/></results></poll></item></items>"#,13).unwrap();
        assert_eq!(game["name"], "Catan");
        assert_eq!(game["bgg_rating"], 7.2);
        assert!(game.get("bgg_weight").is_none());
        assert_eq!(game["suggested_players"][0]["best"], 10);
    }
}
