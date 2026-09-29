use crate::{
    AppError, AppState, Result,
    auth::{AuthSession, CurrentUser},
    ranking::{Category, Metric},
    ranking_store::{self, StoreError},
};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
};
use serde::Deserialize;
use serde_json::{Value, json};
use std::str::FromStr;

impl From<StoreError> for AppError {
    fn from(error: StoreError) -> Self {
        Self {
            status: StatusCode::from_u16(error.status_code())
                .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
            message: error.to_string(),
        }
    }
}

pub async fn bootstrap(State(state): State<AppState>, user: CurrentUser) -> Result<Json<Value>> {
    let tables:Value=crate::db::query_scalar(r#"
 SELECT jsonb_build_object(
 'profiles',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'display_name',display_name,'avatar_url',avatar_url,'email',CASE WHEN $1 OR id=$2 THEN email ELSE NULL END,'is_admin',is_staff,'is_active',is_active,'partner_id',partner_id,'created_at',date_joined,'updated_at',updated_at)),'[]'::jsonb) FROM hub_user),
 'board_games',(SELECT coalesce(jsonb_agg(to_jsonb(g)||jsonb_build_object('difficulty',d.difficulty,'difficulty_votes',coalesce(d.votes,0),'community_score',CASE WHEN e.votes>=3 THEN e.score END,'rankers',coalesce(e.votes,0))),'[]'::jsonb) FROM hub_game g LEFT JOIN LATERAL (SELECT avg(difficulty_tier) difficulty,count(*) votes FROM hub_usergame WHERE game_id=g.bgg_id AND difficulty_tier IS NOT NULL) d ON true LEFT JOIN LATERAL (SELECT avg(score) score,count(score) votes FROM hub_usergame WHERE game_id=g.bgg_id AND tier<>'') e ON true),
 'user_game_collection',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'user_id',user_id,'bgg_id',game_id,'owned',owned,'wishlist',wishlist,'wishlist_priority',wishlist_priority,'wishlist_note',wishlist_note,'added_at',coalesce(collection_added_at,created_at))),'[]'::jsonb) FROM hub_usergame WHERE owned OR wishlist OR wishlist_priority IS NOT NULL OR wishlist_note<>''),
 'game_ratings',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'user_id',user_id,'bgg_id',game_id,'rating',rating,'comment',comment,'created_at',coalesce(rating_created_at,created_at),'updated_at',coalesce(rating_updated_at,created_at))),'[]'::jsonb) FROM hub_usergame WHERE rating IS NOT NULL OR comment<>''),
 'tier_placements',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'user_id',user_id,'bgg_id',game_id,'tier',tier,'position',position,'score',score,'created_at',coalesce(tier_created_at,created_at),'updated_at',updated_at)),'[]'::jsonb) FROM hub_usergame WHERE tier<>''),
 'difficulty_placements',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'user_id',user_id,'bgg_id',game_id,'tier',difficulty_tier::text,'position',difficulty_position,'score',difficulty_tier,'created_at',created_at,'updated_at',difficulty_updated_at)),'[]'::jsonb) FROM hub_usergame WHERE difficulty_tier IS NOT NULL),
 'game_expansions',(SELECT coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('game_bgg_id',game_id)),'[]'::jsonb) FROM hub_expansion e),
 'expansion_tier_placements',(SELECT coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('game_bgg_id',e.game_id)),'[]'::jsonb) FROM hub_expansionplacement p JOIN hub_expansion e ON e.id=p.expansion_id),
 'achievements',(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) FROM hub_achievement a),
 'user_achievements',(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) FROM hub_award a),
 'bounties',(SELECT coalesce(jsonb_agg(to_jsonb(b)||jsonb_build_object('claimed_by',claimed_by_id)),'[]'::jsonb) FROM hub_bounty b),
 'feedback',(SELECT coalesce(jsonb_agg(to_jsonb(f)),'[]'::jsonb) FROM hub_feedback f),
 'user_activity',(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) FROM hub_activity a),
 'game_rules',CASE WHEN $1 THEN (SELECT coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('bgg_id',game_id,'created_by',created_by_id)),'[]'::jsonb) FROM hub_rulebook r) ELSE '[]'::jsonb END
 )"#).bind(user.is_staff).bind(user.id).fetch_one(&state.db).await?;
    Ok(Json(json!({"user":user,"tables":tables})))
}

#[derive(Deserialize)]
pub struct HistoryQuery {
    metric: Option<String>,
    bgg_id: Option<i32>,
    user_id: Option<String>,
}
pub async fn history(
    State(state): State<AppState>,
    _user: CurrentUser,
    Query(query): Query<HistoryQuery>,
) -> Result<Json<Value>> {
    let metric = Metric::from_str(query.metric.as_deref().unwrap_or("enjoyment"))
        .map_err(|e| AppError::bad(e.to_string()))?;
    let metric = metric.as_str();
    let rows:Value=crate::db::query_scalar(r#"SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'metric',metric,'user_id',user_id,'bgg_id',game_id,'day',day,'snapshot_at',day::text||'T12:00:00Z','score',score,'imported',imported) ORDER BY day,id),'[]'::jsonb) FROM hub_dailyscore WHERE metric=$1 AND ($2::integer IS NULL OR game_id=$2) AND ($3::text IS NULL OR coalesce(user_id::text,'community')=$3)"#).bind(metric).bind(query.bgg_id).bind(query.user_id).fetch_one(&state.db).await?;
    Ok(Json(rows))
}

fn scope(metric: &str, category: &str) -> Result<(Metric, Category)> {
    Ok((
        Metric::from_str(metric).map_err(|e| AppError::bad(e.to_string()))?,
        Category::from_str(category).map_err(|e| AppError::bad(e.to_string()))?,
    ))
}
pub async fn ranking_board(
    State(state): State<AppState>,
    user: CurrentUser,
    Path((metric, category)): Path<(String, String)>,
) -> Result<Json<Value>> {
    let (metric, category) = scope(&metric, &category)?;
    Ok(Json(
        ranking_store::board_state(&state.db, user.id, category, None, metric).await?,
    ))
}
#[derive(Deserialize)]
pub struct SaveRequest {
    pub entries: Value,
    pub revision: String,
}
pub async fn save_ranking(
    State(state): State<AppState>,
    session: AuthSession,
    Path((metric, category)): Path<(String, String)>,
    headers: HeaderMap,
    Json(body): Json<SaveRequest>,
) -> Result<Json<Value>> {
    crate::auth::require_csrf(&headers, &session).map_err(|_| AppError::forbidden())?;
    let (metric, category) = scope(&metric, &category)?;
    Ok(Json(
        ranking_store::save(
            &state.db,
            session.user.id,
            category,
            None,
            metric,
            body.entries,
            &body.revision,
        )
        .await?,
    ))
}
pub async fn expansion_board(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(game): Path<i64>,
) -> Result<Json<Value>> {
    Ok(Json(
        ranking_store::board_state(
            &state.db,
            user.id,
            Category::Board,
            Some(game),
            Metric::Enjoyment,
        )
        .await?,
    ))
}
pub async fn save_expansions(
    State(state): State<AppState>,
    session: AuthSession,
    Path(game): Path<i64>,
    headers: HeaderMap,
    Json(body): Json<SaveRequest>,
) -> Result<Json<Value>> {
    crate::auth::require_csrf(&headers, &session).map_err(|_| AppError::forbidden())?;
    Ok(Json(
        ranking_store::save(
            &state.db,
            session.user.id,
            Category::Board,
            Some(game),
            Metric::Enjoyment,
            body.entries,
            &body.revision,
        )
        .await?,
    ))
}
