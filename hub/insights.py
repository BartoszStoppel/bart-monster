"""Bulk-loaded community calculations shared by pages and the chat tools."""

import json
import math
from collections import Counter, defaultdict
from datetime import timedelta
from pathlib import Path
from statistics import mean, pstdev

from django.utils import timezone

from .models import Activity, DailyScore, Game, User, UserGame, household_groups
from .ranking import alignments, ordered, placement_values, present

RANKS = json.loads((Path(__file__).parent / "data/ranks.json").read_text())


def score_history(game_id, user_id, metric="enjoyment"):
    """Daily closing values. Missing legacy observations are unknown, not quiet days."""
    daily = DailyScore.objects.filter(game_id=game_id, user_id=user_id, metric=metric).order_by(
        "day"
    )
    previous, last_day, last_imported, points = None, None, False, []
    for day, score, imported in daily.values_list("day", "score", "imported").iterator():
        if last_imported and day > last_day + timedelta(days=1):
            points.append(
                {
                    "date": last_day + timedelta(days=1),
                    "score": None,
                    "change": None,
                    "missing": True,
                }
            )
            previous = None
        change = round(score - previous, 1) if score is not None and previous is not None else None
        points.append({"date": day, "score": score, "change": change})
        previous, last_day, last_imported = score, day, imported
    if last_imported and timezone.localdate() > last_day:
        points.append(
            {"date": last_day + timedelta(days=1), "score": None, "change": None, "missing": True}
        )
    return points


def rank(count):
    return next((r for r in RANKS if count >= r["minGames"]), RANKS[-1])


def medals():
    groups = defaultdict(list)
    badges = defaultdict(lambda: defaultdict(list))
    for placement in UserGame.objects.ranked().select_related("game", "user"):
        groups[(placement.user_id, placement.game.category)].append(placement)
    for rows in groups.values():
        rows = ordered(rows)
        for row, icon in zip(rows, ["🥇", "🥈", "🥉"]):
            badges[row.game_id][icon].append(str(row.user))
        if rows:
            badges[rows[-1].game_id]["🗑️"].append(str(rows[-1].user))
    return badges


def households(users):
    return [
        {
            "id": members[0].pk,
            "members": [u.pk for u in members],
            "name": " & ".join(str(u) for u in members),
        }
        for members in household_groups(users)
    ]


def community_data(category, metric="enjoyment"):
    users = list(User.objects.filter(is_active=True))
    games = list(Game.objects.with_difficulty().filter(category=category))
    associations = list(UserGame.objects.filter(game__category=category).select_related("game"))
    levels = Counter(p.user_id for p in associations if p.tier)
    users.sort(key=lambda user: (-levels[user.pk], user.pk))
    placements = [
        p
        for p in associations
        if (p.difficulty_tier is not None if metric == "difficulty" else bool(p.tier))
    ]
    by_user, by_game = defaultdict(list), defaultdict(list)
    for p in placements:
        by_user[p.user_id].append(p)
        score = placement_values(p, metric)[2]
        if score is not None:
            by_game[p.game_id].append(score)
    orders = {uid: [p.game_id for p in ordered(rows, metric)] for uid, rows in by_user.items()}
    user_map = {u.pk: u for u in users}
    pairs = (
        alignments({uid: order for uid, order in orders.items() if uid in user_map})
        if metric == "enjoyment"
        else {}
    )
    averages = {game_id: mean(values) for game_id, values in by_game.items() if len(values) >= 3}
    rows = []
    for user in users:
        ratings = present(by_user[user.pk], metric)
        relation = pairs.get(user.pk, {"allies": [], "rivals": []})
        hot_take = max(
            (p for p in ratings if p.display_score is not None and p.game_id in averages),
            key=lambda p: (abs(p.display_score - averages[p.game_id]), -p.game_id),
            default=None,
        )
        rows.append(
            {
                "user": user,
                "placements": ratings,
                "hot_take_id": hot_take.game_id if hot_take else None,
                "count": len(ratings),
                "rank": rank(levels[user.pk]),
                **{
                    key: [
                        {"user": user_map[uid], "distance": value}
                        for uid, value in values
                        if uid in user_map
                    ]
                    for key, values in relation.items()
                },
            }
        )
    return {
        "users": users,
        "games": games,
        "placements": placements,
        "by_game": by_game,
        "orders": orders,
        "rows": rows,
        "alignments": pairs,
    }


def suggestions(user, limit=12):
    rated = list(UserGame.objects.ranked().filter(user=user).select_related("game"))
    high = [p for p in rated if p.score is not None and p.score >= 7]
    if not high:
        return []
    excluded = {p.game_id for p in rated} | set(
        UserGame.objects.filter(user_id__in=user.household_ids, owned=True).values_list(
            "game_id", flat=True
        )
    )
    excluded |= set(
        UserGame.objects.filter(user=user, wishlist=True).values_list("game_id", flat=True)
    )
    weights = Counter()
    for p in high:
        for field in ("mechanics", "categories"):
            for tag in getattr(p.game, field):
                weights[(field, tag)] += p.score
    normalizer = max(p.score for p in high) * len(high)
    result = []
    for game in Game.objects.exclude(pk__in=excluded):
        tags = [
            (field, tag) for field in ("mechanics", "categories") for tag in getattr(game, field)
        ]
        matches = [tag for field, tag in tags if weights[(field, tag)]]
        if matches:
            score = min(sum(weights[tag] for tag in tags) / normalizer / math.sqrt(len(tags)), 1)
            result.append({"game": game, "match": round(score * 100), "tags": matches})
    return sorted(result, key=lambda row: -row["match"])[:limit]


def top_distinct(pairs, reverse=True):
    pairs = sorted(pairs, key=lambda row: row[1], reverse=reverse)
    values = list(dict.fromkeys(value for _, value in pairs))[:3]
    return [(key, value) for key, value in pairs if value in values]


def computed_achievements():
    users = list(User.objects.all())
    user_map = {u.pk: str(u) for u in users}
    homes = households(users)
    home_map = {uid: home["id"] for home in homes for uid in home["members"]}
    names = {home["id"]: home["name"] for home in homes}
    owned, ranked, wishers, owners = (defaultdict(set) for _ in range(4))
    placements, by_game = [], defaultdict(list)
    for row in UserGame.objects.all():
        home = home_map[row.user_id]
        if row.tier:
            placements.append(row)
            ranked[home].add(row.game_id)
            if row.score is not None:
                by_game[row.game_id].append(row.score)
        if row.owned:
            owned[home].add(row.game_id)
            owners[row.game_id].add(home)
        if row.wishlist:
            wishers[row.game_id].add(home)
    results = []

    def award(title, icon, pairs, labels, reverse=True, suffix=""):
        holders = [
            {"name": labels[key], "detail": f"{value}{suffix}"}
            for key, value in top_distinct(pairs, reverse)
        ]
        if holders:
            results.append({"title": title, "icon": icon, "holders": holders})

    counts = [(hid, len(owned[hid])) for hid in names]
    award("Board Game Collector", "🏆", counts, names, suffix=" games")
    award("Professional Freeloader", "🛋️", counts, names, False, " games")
    shame = [(hid, len(owned[hid] - ranked[hid])) for hid in names]
    award(
        "Shelf of Shame",
        "🫣",
        [(uid, count) for uid, count in shame if count],
        names,
        suffix=" unranked games",
    )
    games = {g.pk: g for g in Game.objects.all()}
    stats = {
        gid: {
            "average": mean(values),
            "spread": pstdev(values),
            "gap": mean(values) - games[gid].bgg_rating if games[gid].bgg_rating else None,
        }
        for gid, values in by_game.items()
        if len(values) >= 3
    }
    for title, icon, key, descending in [
        ("Most Liked", "❤️", "average", True),
        ("Most Hated", "💀", "average", False),
        ("Most Controversial", "🔥", "spread", True),
        ("Consensus Pick", "🤝", "spread", False),
        ("Hidden Gem", "💎", "gap", True),
        ("Overrated", "📉", "gap", False),
    ]:
        holders = []
        for category in ("board", "party"):
            candidates = [
                (gid, stat[key])
                for gid, stat in stats.items()
                if games[gid].category == category
                and stat[key] is not None
                and (key != "gap" or (stat[key] > 0 if descending else stat[key] < 0))
            ]
            if candidates:
                gid, value = sorted(candidates, key=lambda row: row[1], reverse=descending)[0]
                holders.append(
                    {"name": games[gid].name, "detail": f"{category}: {key} {value:.1f}"}
                )
        if holders:
            results.append({"title": title, "icon": icon, "holders": holders})
    for title, icon, collection in [
        ("Most Owned", "📦", owners),
        ("Most Wishlisted", "⭐", wishers),
    ]:
        holders = []
        for category in ("board", "party"):
            candidates = [
                (gid, ids)
                for gid, ids in collection.items()
                if len(ids) >= 3 and games[gid].category == category
            ]
            if candidates:
                gid, ids = max(candidates, key=lambda row: len(row[1]))
                holders.append(
                    {
                        "name": games[gid].name,
                        "detail": ", ".join(names[uid] for uid in sorted(ids)),
                    }
                )
        if holders:
            results.append({"title": title, "icon": icon, "holders": holders})
    for category, titles in [
        ("board", ["The People Pleaser", "The Menace", "Vanilla Villain"]),
        ("party", ["Life of the Party", "The Party Pooper", "The Wallflower"]),
    ]:
        groups = defaultdict(list)
        for p in placements:
            if games[p.game_id].category == category:
                groups[p.user_id].append(p)
        pairs = alignments(
            {uid: [p.game_id for p in ordered(rows)] for uid, rows in groups.items()}
        )
        totals = {key: Counter() for key in ("allies", "rivals")}
        for relation in pairs.values():
            for key in totals:
                for (uid, _), points in zip(relation[key], [3, 2, 1]):
                    totals[key][uid] += points
        excluded = set()
        for title, icon, key in zip(titles, ["🤝", "😈"], totals):
            award(title, icon, totals[key].items(), user_map, suffix=" pts")
            excluded.update(uid for uid, _ in top_distinct(totals[key].items()))
        loners = [
            (uid, totals["allies"][uid] + totals["rivals"][uid])
            for uid, rows in groups.items()
            if uid not in excluded and len(rows) >= 3
        ]
        award(titles[2], "🕵️", loners, user_map, False, " pts")
    activity = list(Activity.objects.all())
    award(
        "Most Dedicated",
        "🏠",
        [(a.user_id, a.visit_count) for a in activity],
        user_map,
        suffix=" visits",
    )
    award(
        "Time Lord",
        "⏱️",
        [(a.user_id, a.total_seconds) for a in activity],
        user_map,
        suffix=" seconds",
    )
    return results
