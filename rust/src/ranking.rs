//! Ranking rules shared by games and expansions. Database callers own atomicity and locks.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    fmt,
    hash::Hash,
    str::FromStr,
};

#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Metric {
    #[default]
    Enjoyment,
    Difficulty,
}

impl Metric {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Enjoyment => "enjoyment",
            Self::Difficulty => "difficulty",
        }
    }
    pub fn codes(self) -> &'static str {
        match self {
            Self::Enjoyment => "SABCDF",
            Self::Difficulty => "654321",
        }
    }
    pub fn score_max(self) -> u8 {
        match self {
            Self::Enjoyment => 10,
            Self::Difficulty => 6,
        }
    }
    fn tier_index(self, tier: &str) -> Option<usize> {
        (tier.len() == 1).then(|| self.codes().find(tier)).flatten()
    }
}

impl FromStr for Metric {
    type Err = RankingError;
    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "enjoyment" => Ok(Self::Enjoyment),
            "difficulty" => Ok(Self::Difficulty),
            _ => Err(RankingError::UnknownMetric),
        }
    }
}

#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Category {
    #[default]
    Board,
    Party,
}

impl Category {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Board => "board",
            Self::Party => "party",
        }
    }
}

impl FromStr for Category {
    type Err = RankingError;
    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "board" => Ok(Self::Board),
            "party" => Ok(Self::Party),
            _ => Err(RankingError::InvalidScope),
        }
    }
}

#[derive(Clone, Debug)]
pub struct RankingScope {
    pub user_id: String,
    pub category: Category,
    pub game_id: Option<i64>,
    pub metric: Metric,
}

impl RankingScope {
    pub fn validate(&self) -> Result<(), RankingError> {
        if self.user_id.is_empty()
            || self.game_id.is_some_and(|id| id <= 0)
            || (self.game_id.is_some() && self.metric != Metric::Enjoyment)
        {
            return Err(RankingError::InvalidScope);
        }
        Ok(())
    }
}

/// An existing row projected onto just one metric. `row_id` is the association UUID.
#[derive(Clone, Debug, PartialEq)]
pub struct Placement {
    pub row_id: String,
    pub id: String,
    pub tier: String,
    pub position: u32,
    pub score: f64,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct RankedEntry {
    pub id: String,
    pub tier: String,
    pub position: u32,
    pub score: f64,
}

impl From<&Placement> for RankedEntry {
    fn from(row: &Placement) -> Self {
        Self {
            id: row.id.clone(),
            tier: row.tier.clone(),
            position: row.position,
            score: row.score,
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct ScoreChange {
    pub id: String,
    pub before: Option<f64>,
    pub after: Option<f64>,
}

#[derive(Debug)]
pub struct SavePlan {
    pub current_revision: String,
    pub unchanged: bool,
    pub placements: Vec<RankedEntry>,
    pub removed_ids: Vec<String>,
    pub score_changes: Vec<ScoreChange>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RankingError {
    UnknownMetric,
    InvalidScope,
    InvalidRanking,
    InvalidEntry,
    InvalidTierOrGame,
    InvalidStoredRanking,
    Stale,
}

impl fmt::Display for RankingError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::UnknownMetric => "Unknown ranking metric.",
            Self::InvalidScope => "Invalid ranking scope.",
            Self::InvalidRanking => "Invalid ranking.",
            Self::InvalidEntry => "Invalid ranking entry.",
            Self::InvalidTierOrGame => {
                "Rank each game once, in its own category, using the displayed tiers."
            }
            Self::InvalidStoredRanking => "Stored ranking is invalid.",
            Self::Stale => "Your ranking changed in another tab. Reload before saving again.",
        })
    }
}
impl std::error::Error for RankingError {}

/// Preserve the old operation order and JavaScript's rounding, including floating-point ties.
pub fn scores(count: usize) -> Vec<f64> {
    if count < 2 {
        return vec![10.0; count];
    }
    let step = 9.0 / (count - 1) as f64;
    (0..count)
        .map(|i| ((10.0 - i as f64 * step) * 10.0 + 0.5).floor() / 10.0)
        .collect()
}

pub fn ordered<'a>(
    rows: &'a [Placement],
    scope: &RankingScope,
) -> Result<Vec<&'a Placement>, RankingError> {
    scope.validate()?;
    if rows.iter().any(|r| {
        scope.metric.tier_index(&r.tier).is_none()
            || !r.score.is_finite()
            || !(1.0..=scope.metric.score_max() as f64).contains(&r.score)
            || (scope.game_id.is_none() && r.id.parse::<i64>().is_err())
    }) {
        return Err(RankingError::InvalidStoredRanking);
    }
    let mut result: Vec<_> = rows.iter().collect();
    result.sort_by(|a, b| {
        scope
            .metric
            .tier_index(&a.tier)
            .cmp(&scope.metric.tier_index(&b.tier))
            .then(a.position.cmp(&b.position))
            .then_with(|| {
                if scope.game_id.is_some() {
                    a.id.cmp(&b.id)
                } else {
                    a.id.parse::<i64>()
                        .unwrap()
                        .cmp(&b.id.parse::<i64>().unwrap())
                }
            })
    });
    Ok(result)
}

/// Match Python json.dumps separators and number types to preserve in-flight revision tokens.
pub fn revision(rows: &[Placement], scope: &RankingScope) -> Result<String, RankingError> {
    let quote = |value: &str| serde_json::to_string(value).expect("string is valid JSON");
    let records = ordered(rows, scope)?
        .iter()
        .map(|row| {
            let score = match scope.metric {
                Metric::Enjoyment => serde_json::to_string(&row.score).expect("finite score"),
                Metric::Difficulty => row.tier.clone(),
            };
            format!(
                "[{}, {}, {}, {}]",
                quote(&row.row_id),
                quote(&row.tier),
                row.position,
                score
            )
        })
        .collect::<Vec<_>>()
        .join(", ");
    let data = format!(
        "[{}, {}, {}, {}, [{}]]",
        quote(&scope.user_id),
        quote(scope.category.as_str()),
        scope
            .game_id
            .map(|id| quote(&id.to_string()))
            .unwrap_or_else(|| "null".into()),
        quote(scope.metric.as_str()),
        records
    );
    Ok(format!("{:x}", Sha256::digest(data.as_bytes())))
}

/// Validate first, acknowledge identical retries second, reject stale changes third.
/// A changed plan must be applied with its personal/community daily snapshots in one transaction.
pub fn plan_save(
    scope: &RankingScope,
    previous: &[Placement],
    allowed: &HashSet<String>,
    entries: &Value,
    expected_revision: &str,
) -> Result<SavePlan, RankingError> {
    let current_revision = revision(previous, scope)?;
    let entries = entries
        .as_array()
        .filter(|rows| rows.len() <= allowed.len())
        .ok_or(RankingError::InvalidRanking)?;
    let mut seen = HashSet::new();
    let mut normalized = Vec::with_capacity(entries.len());
    for entry in entries {
        let entry = entry.as_object().ok_or(RankingError::InvalidEntry)?;
        let id = match entry.get("id") {
            Some(Value::String(value)) => value.clone(),
            Some(Value::Number(value)) if value.is_i64() || value.is_u64() => value.to_string(),
            _ => return Err(RankingError::InvalidTierOrGame),
        };
        let tier = entry
            .get("tier")
            .and_then(Value::as_str)
            .ok_or(RankingError::InvalidTierOrGame)?;
        if !allowed.contains(&id)
            || !seen.insert(id.clone())
            || scope.metric.tier_index(tier).is_none()
        {
            return Err(RankingError::InvalidTierOrGame);
        }
        normalized.push((id, tier.to_owned()));
    }
    normalized.sort_by_key(|(_, tier)| scope.metric.tier_index(tier));
    let old = ordered(previous, scope)?;
    if normalized
        .iter()
        .map(|(id, tier)| (id, tier))
        .eq(old.iter().map(|row| (&row.id, &row.tier)))
    {
        return Ok(SavePlan {
            current_revision,
            unchanged: true,
            placements: old.into_iter().map(RankedEntry::from).collect(),
            removed_ids: vec![],
            score_changes: vec![],
        });
    }
    if expected_revision != current_revision {
        return Err(RankingError::Stale);
    }
    let mut positions = HashMap::<String, u32>::new();
    let placements: Vec<_> = normalized
        .into_iter()
        .zip(scores(entries.len()))
        .map(|((id, tier), score)| {
            let position = positions.entry(tier.clone()).or_default();
            let row = RankedEntry {
                id,
                score: if scope.metric == Metric::Difficulty {
                    tier.parse::<f64>().unwrap()
                } else {
                    score
                },
                tier,
                position: *position,
            };
            *position += 1;
            row
        })
        .collect();
    let before: BTreeMap<_, _> = previous.iter().map(|r| (r.id.clone(), r.score)).collect();
    let after: BTreeMap<_, _> = placements.iter().map(|r| (r.id.clone(), r.score)).collect();
    let mut removed_ids: Vec<_> = before
        .keys()
        .filter(|id| !after.contains_key(*id))
        .cloned()
        .collect();
    removed_ids.sort();
    let all_ids: std::collections::BTreeSet<_> = before.keys().chain(after.keys()).collect();
    let score_changes = all_ids
        .into_iter()
        .filter_map(|id| {
            let (before, after) = (before.get(id).copied(), after.get(id).copied());
            (before != after).then(|| ScoreChange {
                id: id.clone(),
                before,
                after,
            })
        })
        .collect();
    Ok(SavePlan {
        current_revision,
        unchanged: false,
        placements,
        removed_ids,
        score_changes,
    })
}

#[derive(Clone, Debug, Serialize)]
pub struct TierOption {
    pub value: &'static str,
    pub label: &'static str,
    pub description: &'static str,
    pub color: &'static str,
}

pub fn tier_options(metric: Metric) -> Vec<TierOption> {
    let mut options = match metric {
        Metric::Enjoyment => ["S", "A", "B", "C", "D", "F"]
            .into_iter()
            .map(|tier| TierOption {
                value: tier,
                label: tier,
                description: "",
                color: tier,
            })
            .collect(),
        Metric::Difficulty => [
            (
                "6",
                "Monstrous",
                "Extremely demanding rules, planning, or interacting systems.",
                "S",
            ),
            (
                "5",
                "Brutal",
                "Heavy learning effort and sustained concentration.",
                "A",
            ),
            (
                "4",
                "Demanding",
                "Several systems to manage and substantial planning.",
                "B",
            ),
            (
                "3",
                "Challenging",
                "Meaningful rules and decisions; some learning effort.",
                "C",
            ),
            (
                "2",
                "Tame",
                "Straightforward rules with a little planning.",
                "D",
            ),
            ("1", "Cuddly", "Quick to learn and easy to follow.", "F"),
        ]
        .into_iter()
        .map(|(value, label, description, color)| TierOption {
            value,
            label,
            description,
            color,
        })
        .collect::<Vec<_>>(),
    };
    options.push(TierOption {
        value: "U",
        label: "Unranked",
        description: "No assessment yet.",
        color: "U",
    });
    options
}

pub fn shared_distance<T: Eq + Hash>(left: &[T], right: &[T], penalize: bool) -> Option<f64> {
    let right_ids: HashSet<_> = right.iter().collect();
    let shared: HashSet<_> = left.iter().filter(|id| right_ids.contains(id)).collect();
    if shared.len() < 3 {
        return None;
    }
    let left_scores: HashMap<_, _> = left
        .iter()
        .filter(|id| shared.contains(id))
        .zip(scores(shared.len()))
        .collect();
    let distance: f64 = right
        .iter()
        .filter(|id| shared.contains(id))
        .zip(scores(shared.len()))
        .map(|(id, score)| (left_scores[id] - score).abs())
        .sum();
    Some(if penalize {
        (distance + 2.0 * (left.len() - shared.len()) as f64) / left.len() as f64
    } else {
        distance / shared.len() as f64
    })
}

/// Missing/unranked values reset comparison; quieter dates require no extra stored rows.
pub fn history_changes(scores: &[Option<f64>]) -> Vec<Option<f64>> {
    let mut previous = None;
    scores
        .iter()
        .map(|score| {
            let change = score.zip(previous).map(|(current, prior)| current - prior);
            previous = *score;
            change
        })
        .collect()
}

#[cfg(test)]
#[path = "ranking_tests.rs"]
mod tests;
