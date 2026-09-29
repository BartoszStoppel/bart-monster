"""One ranking implementation for games and expansions; scores are server-owned."""

import hashlib
import json
import math
from collections import defaultdict

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Avg
from django.utils import timezone

from .models import DIFFICULTIES, DailyScore, Expansion, ExpansionPlacement, Game, User, UserGame

TIERS = "SABCDF"


class StaleRanking(Exception):
    pass


def lock_ids(queryset):
    """Acquire shared-item/user locks in a consistent order inside the caller's transaction."""
    return list(queryset.order_by("pk").select_for_update().values_list("pk", flat=True))


def scores(count):
    if count < 2:
        return [10.0] * count
    # Preserve the legacy operation order as well as JavaScript's rounding.
    step = 9 / (count - 1)
    return [math.floor((10 - i * step) * 10 + 0.5) / 10 for i in range(count)]


def metric_config(metric="enjoyment"):
    tier_codes(metric)
    difficulty = metric == "difficulty"
    descriptions = [
        "Quick to learn and easy to follow.",
        "Straightforward rules with a little planning.",
        "Meaningful rules and decisions; some learning effort.",
        "Several systems to manage and substantial planning.",
        "Heavy learning effort and sustained concentration.",
        "Extremely demanding rules, planning, or interacting systems.",
    ]
    tiers = (
        [
            {
                "value": str(level),
                "label": label,
                "description": descriptions[level - 1],
                "color": TIERS[6 - level],
            }
            for level, label in reversed(DIFFICULTIES)
        ]
        if difficulty
        else [{"value": tier, "label": tier, "description": "", "color": tier} for tier in TIERS]
    )
    tiers.append(
        {"value": "U", "label": "Unranked", "description": "No assessment yet.", "color": "U"}
    )
    return {
        "metric": metric,
        "metric_label": metric.title(),
        "score_max": 6 if difficulty else 10,
        "difficulty_levels": DIFFICULTIES,
        "tier_options": tiers,
    }


def tier_codes(metric="enjoyment"):
    if metric not in ("enjoyment", "difficulty"):
        raise ValidationError("Unknown ranking metric.")
    return "654321" if metric == "difficulty" else TIERS


def placement_values(row, metric="enjoyment"):
    if metric == "difficulty":
        return str(row.difficulty_tier), row.difficulty_position, row.difficulty_tier
    return row.tier, row.position, row.score


def ordered(rows, metric="enjoyment"):
    codes = tier_codes(metric)
    return sorted(
        rows,
        key=lambda p: (
            codes.index(placement_values(p, metric)[0]),
            placement_values(p, metric)[1],
            p.game_id if isinstance(p, UserGame) else str(p.expansion_id),
        ),
    )


def present(rows, metric="enjoyment"):
    options = {t["value"]: t for t in metric_config(metric)["tier_options"]}
    rows = ordered(rows, metric)
    for row in rows:
        tier, _, row.display_score = placement_values(row, metric)
        row.display_tier = options[tier]["label"]
        row.tier_color = options[tier]["color"]
    return rows


def revision(rows, metric="enjoyment", *, user=None, category="board", game=None):
    value = [
        str(user.pk) if user else None,
        category,
        str(game.pk) if game else None,
        metric,
        [(str(p.pk), *placement_values(p, metric)) for p in ordered(rows, metric)],
    ]
    return hashlib.sha256(json.dumps(value).encode()).hexdigest()


def scope(user, category="board", game=None, metric="enjoyment"):
    tier_codes(metric)
    if category not in ("board", "party") or (game and metric != "enjoyment"):
        raise ValidationError("Invalid ranking scope.")
    if game:
        return ExpansionPlacement.objects.filter(user=user, expansion__game=game), "expansion_id"
    return UserGame.objects.ranked(metric).filter(user=user, game__category=category), "game_id"


def current_revision(user, category="board", game=None, metric="enjoyment"):
    rows, _ = scope(user, category, game, metric)
    return revision(rows, metric, user=user, category=category, game=game)


def board(items, placements, metric="enjoyment"):
    buckets = {
        option["value"]: {**option, "items": []} for option in metric_config(metric)["tier_options"]
    }
    by_id = {str(item.pk): item for item in items}
    for p in ordered(placements, metric):
        item = by_id.pop(str(p.game_id if isinstance(p, UserGame) else p.expansion_id), None)
        if item:
            tier, _, item.tier_score = placement_values(p, metric)
            buckets[tier]["items"].append(item)
    buckets["U"]["items"] = list(by_id.values())
    return list(buckets.values())


def record_community_scores(game_ids, metric, day):
    field = "difficulty_tier" if metric == "difficulty" else "score"
    averages = dict(
        UserGame.objects.ranked(metric)
        .filter(game_id__in=game_ids)
        .values("game_id")
        .annotate(avg=Avg(field))
        .values_list("game_id", "avg")
    )
    for key in game_ids:
        DailyScore.objects.update_or_create(
            metric=metric,
            user=None,
            game_id=key,
            day=day,
            defaults={"score": averages.get(key), "imported": False},
        )


def record_daily_scores(before, after, user, metric="enjoyment"):
    changed = {key for key in before.keys() | after.keys() if before.get(key) != after.get(key)}
    if not changed:
        return
    day = timezone.localdate()
    for key in changed:
        DailyScore.objects.update_or_create(
            metric=metric,
            user=user,
            game_id=key,
            day=day,
            defaults={"score": after.get(key), "imported": False},
        )
    record_community_scores(changed, metric, day)


@transaction.atomic
def save_ranking(user, entries, expected_revision, category="board", game=None, metric="enjoyment"):
    User.objects.select_for_update().get(pk=user.pk)
    query, field = scope(user, category, game, metric)
    previous = list(query)
    current = revision(previous, metric, user=user, category=category, game=game)
    allowed = {
        str(pk)
        for pk in lock_ids(
            Expansion.objects.filter(game=game) if game else Game.objects.filter(category=category)
        )
    }
    # Shared item locks serialize community daily averages across different users' saves.
    if not isinstance(entries, list) or len(entries) > len(allowed):
        raise ValidationError("Invalid ranking.")
    codes = tier_codes(metric)
    seen, normalized = set(), []
    for entry in entries:
        if not isinstance(entry, dict):
            raise ValidationError("Invalid ranking entry.")
        key, tier = str(entry.get("id", "")), entry.get("tier")
        if key not in allowed or key in seen or tier not in list(codes):
            raise ValidationError(
                "Rank each game once, in its own category, using the displayed tiers."
            )
        seen.add(key)
        normalized.append((key, tier))
    normalized.sort(key=lambda row: codes.index(row[1]))
    # A committed save can lose its response. Every identical save is a read-only acknowledgment.
    existing = [
        (str(getattr(p, field)), placement_values(p, metric)[0]) for p in ordered(previous, metric)
    ]
    if normalized == existing:
        return current
    if expected_revision != current:
        raise StaleRanking("Your ranking changed in another tab. Reload before saving again.")
    positions = defaultdict(int)
    existing = previous if game else UserGame.objects.filter(user=user, game__category=category)
    previous_by_id = {str(getattr(p, field)): p for p in existing}
    before = {getattr(p, field): placement_values(p, metric)[2] for p in previous}
    rows = []
    for (key, tier), score in zip(normalized, scores(len(normalized))):
        row = previous_by_id.get(key) or query.model(user=user, **{field: key})
        if metric == "difficulty":
            if (row.difficulty_tier, row.difficulty_position) != (int(tier), positions[tier]):
                row.difficulty_updated_at = timezone.now()
            row.difficulty_tier, row.difficulty_position = int(tier), positions[tier]
        else:
            row.tier, row.score, row.position = tier, score, positions[tier]
            row.updated_at = timezone.now()
            if not game:
                row.tier_created_at = row.tier_created_at or row.updated_at
        positions[tier] += 1
        rows.append(row)
    removed = query.exclude(**{f"{field}__in": seen})
    if game:
        removed.delete()
    elif metric == "difficulty":
        removed.update(
            difficulty_tier=None, difficulty_position=0, difficulty_updated_at=timezone.now()
        )
    else:
        removed.update(tier="", position=0, score=None, updated_at=timezone.now())
    update_fields = (
        ["difficulty_tier", "difficulty_position", "difficulty_updated_at"]
        if metric == "difficulty"
        else ["tier", "position", "score", "updated_at"] + ([] if game else ["tier_created_at"])
    )
    query.model.objects.bulk_create(
        rows,
        update_conflicts=True,
        update_fields=update_fields,
        unique_fields=["user", field.removesuffix("_id")],
    )
    if not game:
        UserGame.objects.filter(user=user).prune_empty()
        record_daily_scores(
            before,
            {int(getattr(p, field)): placement_values(p, metric)[2] for p in rows},
            user,
            metric,
        )
    return revision(query.all(), metric, user=user, category=category, game=game)


def recompute_all():
    """Call inside a transaction after deleting/reclassifying games or expansions."""
    changes = {"corrected_scores": 0, "reordered_positions": 0}
    for model, relation in ((UserGame, "game"), (ExpansionPlacement, "expansion")):
        query = model.objects.ranked() if model is UserGame else model.objects.all()
        groups = defaultdict(list)
        for p in query.select_related(relation, "user"):
            parent = p.game.category if model is UserGame else p.expansion.game_id
            groups[(p.user_id, parent)].append(p)
        for rows in groups.values():
            before = {p.game_id: p.score for p in rows} if model is UserGame else {}
            positions, changed = defaultdict(int), []
            for p, score in zip(ordered(rows), scores(len(rows))):
                changes["corrected_scores"] += p.score != score
                changes["reordered_positions"] += p.position != positions[p.tier]
                if p.score != score or p.position != positions[p.tier]:
                    p.score, p.position, p.updated_at = score, positions[p.tier], timezone.now()
                    changed.append(p)
                positions[p.tier] += 1
            model.objects.bulk_update(changed, ["score", "position", "updated_at"])
            if model is UserGame:
                record_daily_scores(before, {p.game_id: p.score for p in rows}, rows[0].user)
    difficulty_groups = defaultdict(list)
    for row in UserGame.objects.ranked("difficulty").select_related("game"):
        difficulty_groups[(row.user_id, row.game.category)].append(row)
    for rows in difficulty_groups.values():
        positions, changed = defaultdict(int), []
        for row in ordered(rows, "difficulty"):
            if row.difficulty_position != positions[row.difficulty_tier]:
                row.difficulty_position = positions[row.difficulty_tier]
                changed.append(row)
            positions[row.difficulty_tier] += 1
        UserGame.objects.bulk_update(changed, ["difficulty_position"])
    return changes


def shared_distance(left, right, penalize=False):
    shared = set(left) & set(right)
    if len(shared) < 3:
        return None
    a = dict(zip([key for key in left if key in shared], scores(len(shared))))
    b = dict(zip([key for key in right if key in shared], scores(len(shared))))
    total = sum(abs(value - b[key]) for key, value in a.items())
    return (total + 2 * (len(left) - len(shared))) / len(left) if penalize else total / len(shared)


def alignments(orders):
    result = {}
    for uid, order in orders.items():
        comparisons = [
            (other, shared_distance(order, other_order, True))
            for other, other_order in orders.items()
            if other != uid
        ]
        comparisons = sorted(
            [(uid, round(d, 2)) for uid, d in comparisons if d is not None], key=lambda x: x[1]
        )
        result[uid] = {"allies": comparisons[:3], "rivals": comparisons[-3:][::-1]}
    return result


def predictions(user_id, orders, games):
    target = orders.get(user_id, [])
    others = []
    for uid, order in orders.items():
        if uid != user_id and (distance := shared_distance(target, order)) is not None:
            others.append((dict(zip(order, scores(len(order)))), 1 / (distance + 0.1)))
    average = sum(scores(len(target))) / len(target) if target else 5.5
    result = []
    for game in games:
        if game.pk in target:
            continue
        votes = [(rank[game.pk], weight) for rank, weight in others if game.pk in rank]
        if len(votes) < 2:
            continue
        score = round(
            0.65 * sum(s * w for s, w in votes) / sum(w for _, w in votes) + 0.35 * average, 1
        )
        tier = next(
            (t for t, minimum in zip(TIERS, [8.5, 7, 5.5, 4, 2.5, 1]) if score >= minimum), "F"
        )
        result.append({"game": game, "score": score, "tier": tier})
    return sorted(result, key=lambda row: -row["score"])
