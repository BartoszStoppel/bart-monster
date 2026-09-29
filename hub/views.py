import json
import random
import time
from collections import defaultdict
from functools import wraps
from pathlib import Path

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import BadRequest, PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import F, Q
from django.http import HttpResponseBadRequest, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_GET, require_POST

from . import bgg, insights, ranking
from .forms import CollectionForm, FeedbackForm, GameForm, ProfileForm, RatingForm, RulebookForm
from .models import (
    Achievement,
    Activity,
    Bounty,
    DailyScore,
    Expansion,
    Feedback,
    Game,
    Rulebook,
    User,
    UserGame,
)


def category(request):
    return "party" if request.GET.get("category") == "party" else "board"


def request_metric(request):
    metric = request.GET.get("metric", "enjoyment")
    if metric not in ("enjoyment", "difficulty"):
        raise BadRequest("Unknown ranking metric.")
    return metric


def page(request, template, **context):
    return render(request, f"hub/{template}.html", context)


def api(view):
    @wraps(view)
    @login_required
    def wrapped(request, *args, **kwargs):
        try:
            return view(request, *args, **kwargs)
        except ranking.StaleRanking as exc:
            return JsonResponse({"error": str(exc)}, status=409)
        except (ValidationError, ValueError, TypeError, KeyError) as exc:
            detail = (
                "; ".join(exc.messages) if isinstance(exc, ValidationError) else "Invalid request."
            )
            return JsonResponse({"error": detail}, status=400)
        except bgg.BGGError as exc:
            return JsonResponse({"error": str(exc)}, status=502)

    return wrapped


def staff(request):
    if not request.user.is_staff:
        raise PermissionDenied


def back(request, fallback="collection"):
    target = request.POST.get("next", "")
    if target and url_has_allowed_host_and_scheme(
        target, allowed_hosts={request.get_host()}, require_https=request.is_secure()
    ):
        return redirect(target)
    return redirect(fallback)


@login_required
@require_GET
def collection(request):
    games = Game.objects.with_difficulty().with_enjoyment()
    query = request.GET.get("q", "").strip()
    if query:
        games = games.filter(name__icontains=query)
    if request.GET.get("category") in ("board", "party"):
        games = games.filter(category=request.GET["category"])
    own = UserGame.objects.filter(user_id__in=request.user.household_ids)
    owned = set(own.filter(owned=True).values_list("game_id", flat=True))
    wishes = set(own.filter(wishlist=True).values_list("game_id", flat=True))
    if request.GET.get("filter") == "owned":
        games = games.filter(pk__in=owned)
    if request.GET.get("filter") == "wishlist":
        games = games.filter(pk__in=wishes)
    if request.GET.get("filter") == "unranked":
        games = games.exclude(
            pk__in=UserGame.objects.ranked().filter(user=request.user).values("game_id")
        )
    sort = request.GET.get("sort", "community")
    if sort == "weight":
        sort = "difficulty"
    games = list(
        games.order_by(
            {
                "name": "name",
                "bgg": F("bgg_rating").desc(nulls_last=True),
                "community": F("community_score").desc(nulls_last=True),
                "difficulty": F("difficulty").desc(nulls_last=True),
                "time": F("playing_time").asc(nulls_last=True),
            }.get(sort, "name"),
            "name",
            "pk",
        )
    )
    medals = insights.medals()
    for game in games:
        game.owned, game.wishlisted = game.pk in owned, game.pk in wishes
        game.medals = [{"icon": icon, "names": names} for icon, names in medals[game.pk].items()]
        game.decoration = sum(
            len(medals[game.pk][icon]) * weight
            for icon, weight in [("🥇", 4), ("🥈", 2), ("🥉", 1)]
        )
    if sort == "decorated":
        games.sort(key=lambda game: (-game.decoration, game.name))
    return page(request, "collection", games=games, title="Collection", query=query, sort=sort)


@login_required
def search(request):
    query = request.GET.get("q", "").strip()
    results = []
    if request.method == "POST":
        try:
            game_id = int(request.POST.get("bgg_id", ""))
            if game_id <= 0:
                raise ValueError
            game = Game.objects.filter(pk=game_id).first()
            if not game:
                data = bgg.details(game_id)
                data["category"] = "party" if request.POST.get("category") == "party" else "board"
                game, _ = Game.objects.get_or_create(pk=game_id, defaults=data)
            return redirect(game)
        except (ValueError, bgg.BGGError) as exc:
            messages.error(request, str(exc) or "Enter a valid BGG ID.")
    elif query:
        try:
            results = bgg.search(query)
        except bgg.BGGError as exc:
            messages.error(request, str(exc))
    return page(request, "search", title="Find a game", query=query, results=results)


def board_context(user, cat="board", game=None, metric="enjoyment"):
    query, _ = ranking.scope(user, cat, game, metric)
    placements = list(query)
    items = list(game.rankable_expansions.all() if game else Game.objects.filter(category=cat))
    route = (
        f"expansions/{game.pk}" if game else f"difficulty/{cat}" if metric == "difficulty" else cat
    )
    return {
        **ranking.metric_config(metric),
        "buckets": ranking.board(items, placements, metric),
        "revision": ranking.revision(placements, metric, user=user, category=cat, game=game),
        "save_url": f"/api/rankings/{route}",
        "move_url": f"/rankings/{route}/move",
    }


@login_required
@require_GET
def game_detail(request, bgg_id):
    game = get_object_or_404(Game.objects.with_difficulty(), pk=bgg_id)
    own = UserGame.objects.filter(user=request.user, game=game).first()
    placements = list(game.user_games.ranked().select_related("user").order_by("-score"))
    expansions = game.rankable_expansions.prefetch_related("placements__user")
    return page(
        request,
        "game",
        title=game.name,
        game=game,
        collection_form=CollectionForm(instance=own),
        rating_form=RatingForm(instance=own),
        edit_form=GameForm(instance=game),
        ratings=game.user_games.rated().select_related("user"),
        placements=placements,
        difficulty_placements=ranking.present(
            game.user_games.ranked("difficulty").select_related("user"), "difficulty"
        ),
        own_difficulty=own.get_difficulty_tier_display() if own and own.difficulty_tier else None,
        **ranking.metric_config(request_metric(request)),
        owners=game.user_games.filter(owned=True).select_related("user"),
        expansions=expansions,
        expansion_board=board_context(request.user, game=game),
        **history_context(request, [game], request_metric(request)),
    )


@login_required
@require_POST
def game_action(request, bgg_id, action):
    game = get_object_or_404(Game, pk=bgg_id)
    if action in ("edit", "delete", "refresh", "expansion"):
        staff(request)
        with transaction.atomic():
            # Use the same lock order as ranking writes for metadata changes.
            ranking.lock_ids(User.objects.all())
            if action == "delete":
                game.delete()
                ranking.recompute_all()
                return redirect("collection")
            if action == "edit":
                form = GameForm(request.POST, instance=game)
                if form.is_valid():
                    form.save()
                    ranking.recompute_all()
                else:
                    messages.error(request, form.errors.as_text())
            elif action == "refresh":
                try:
                    data = bgg.details(game.pk)
                    Game.objects.filter(pk=game.pk).update(**data, fetched_at=timezone.now())
                except bgg.BGGError as exc:
                    messages.error(request, str(exc))
            elif action == "expansion":
                if request.POST.get("delete"):
                    get_object_or_404(Expansion, pk=request.POST["delete"], game=game).delete()
                    ranking.recompute_all()
                else:
                    name = request.POST.get("name", "").strip()[:500]
                    if name:
                        Expansion.objects.get_or_create(game=game, name=name)
                    selected = set(request.POST.getlist("bgg_expansion_id"))
                    refs = [ref for ref in game.expansions if str(ref["id"]) in selected]
                    thumbnails = {}
                    if refs:
                        try:
                            root = bgg.fetch("thing", id=",".join(str(ref["id"]) for ref in refs))
                            thumbnails = {
                                int(item.get("id")): item.findtext("thumbnail", "")
                                for item in root.findall("item")
                            }
                        except bgg.BGGError:
                            messages.warning(
                                request,
                                "Added the expansions; BGG thumbnails are temporarily unavailable.",
                            )
                    for ref in refs:
                        Expansion.objects.get_or_create(
                            game=game,
                            name=ref["name"],
                            defaults={
                                "bgg_expansion_id": ref["id"],
                                "thumbnail_url": thumbnails.get(ref["id"], ""),
                            },
                        )
    elif action in ("collection", "rating", "wishlist", "acquire", "remove-wishlist"):
        with transaction.atomic():
            User.objects.select_for_update().get(pk=request.user.pk)
            row, _ = UserGame.objects.get_or_create(user=request.user, game=game)
            form_class = {"collection": CollectionForm, "rating": RatingForm}.get(action)
            form = form_class(request.POST, instance=row) if form_class else None
            if form and not form.is_valid():
                messages.error(request, form.errors.as_text())
            else:
                if form:
                    row = form.save(commit=False)
                else:
                    row.wishlist = action == "wishlist"
                    if action == "acquire":
                        row.owned = True
                if action == "rating":
                    row.rating_created_at = row.rating_created_at or timezone.now()
                    row.rating_updated_at = timezone.now()
                else:
                    row.collection_added_at = row.collection_added_at or timezone.now()
                row.save()
            UserGame.objects.filter(pk=row.pk).prune_empty()
    else:
        return HttpResponseBadRequest("Unknown action.")
    return back(request, game)


@login_required
@require_GET
def tier_list(request):
    cat = category(request)
    return page(
        request,
        "tiers",
        title="Your tier list",
        category=cat,
        **board_context(request.user, cat, metric=request_metric(request)),
    )


@api
@require_POST
def save_tiers(request, cat="board", bgg_id=None, metric="enjoyment"):
    if cat not in ("board", "party"):
        raise ValueError
    game = get_object_or_404(Game, pk=bgg_id) if bgg_id else None
    data = json.loads(request.body)
    with transaction.atomic():
        updated = ranking.save_ranking(
            request.user, data["entries"], data["revision"], cat, game, metric
        )
        query, field = ranking.scope(request.user, cat, game, metric)
        placements = [
            {
                "id": str(getattr(p, field)),
                "tier": ranking.placement_values(p, metric)[0],
                "position": ranking.placement_values(p, metric)[1],
                "score": ranking.placement_values(p, metric)[2],
            }
            for p in ranking.ordered(query, metric)
        ]
    return JsonResponse({"revision": updated, "placements": placements})


@login_required
@require_POST
def move_tier(request, cat="board", bgg_id=None, metric="enjoyment"):
    if cat not in ("board", "party"):
        return HttpResponseBadRequest("Unknown category.")
    game = get_object_or_404(Game, pk=bgg_id) if bgg_id else None
    query, field = ranking.scope(request.user, cat, game, metric)
    rows = ranking.ordered(list(query), metric)
    key, tier = request.POST.get("id"), request.POST.get("tier")
    allowed = game.rankable_expansions.all() if game else Game.objects.filter(category=cat)
    if key not in {str(pk) for pk in allowed.values_list("pk", flat=True)} or tier not in list(
        ranking.tier_codes(metric) + "U"
    ):
        return HttpResponseBadRequest("Invalid tier or game.")
    entries = [
        {"id": str(getattr(p, field)), "tier": ranking.placement_values(p, metric)[0]}
        for p in rows
        if str(getattr(p, field)) != key
    ]
    if tier != "U":
        try:
            position = max(0, int(request.POST.get("position") or "99999"))
        except ValueError:
            return HttpResponseBadRequest("Invalid position.")
        indices = [i for i, entry in enumerate(entries) if entry["tier"] == tier]
        index = (
            indices[position]
            if position < len(indices)
            else (indices[-1] + 1 if indices else len(entries))
        )
        entries.insert(index, {"id": key, "tier": tier})
    try:
        ranking.save_ranking(request.user, entries, request.POST.get("revision"), cat, game, metric)
    except (ranking.StaleRanking, ValidationError) as exc:
        messages.error(request, str(exc))
    return redirect(
        game.get_absolute_url() if game else f"/tier-list?category={cat}&metric={metric}"
    )


@login_required
@require_GET
def community(request):
    cat, metric = category(request), request_metric(request)
    data = insights.community_data(cat, metric)
    return page(
        request,
        "community",
        title="Community",
        category=cat,
        **ranking.metric_config(metric),
        ranks=insights.RANKS,
        predictions=ranking.predictions(request.user.pk, data["orders"], data["games"])
        if metric == "enjoyment"
        else [],
        **data,
    )


@login_required
def profile(request, user_id=None):
    person = get_object_or_404(User, pk=user_id) if user_id else request.user
    form = ProfileForm(request.POST or None, instance=person)
    if request.method == "POST":
        if user_id:
            raise PermissionDenied
        if form.is_valid():
            form.save()
            return redirect("profile")
    metric = request_metric(request)
    placements = list(UserGame.objects.ranked(metric).filter(user=person).select_related("game"))
    progression_count = UserGame.objects.ranked().filter(user=person).count()
    return page(
        request,
        "profile",
        title=str(person),
        person=person,
        form=form,
        rankings=ranking.present(placements, metric),
        **ranking.metric_config(metric),
        progression_count=progression_count,
        rank=insights.rank(progression_count),
        owned=Game.objects.filter(
            user_games__user_id__in=person.household_ids, user_games__owned=True
        ).distinct(),
        wishlist=UserGame.objects.filter(
            user_id__in=person.household_ids, wishlist=True
        ).select_related("game", "user"),
        awards=person.award_set.select_related("achievement"),
    )


@login_required
@require_GET
def wishlist(request):
    shared = request.GET.get("view") == "shared"
    rows = (
        UserGame.objects.filter(wishlist=True)
        .select_related("game", "user")
        .order_by(F("wishlist_priority").asc(nulls_last=True), "game__name")
    )
    if not shared:
        rows = rows.filter(user_id__in=request.user.household_ids)
    return page(
        request,
        "wishlist",
        title="Wishlist",
        rows=rows,
        shared=shared,
        suggestions=insights.suggestions(request.user),
    )


@login_required
@require_GET
def picker(request):
    users = list(User.objects.filter(is_active=True).order_by("display_name"))
    homes = insights.households(User.objects.all())
    supplier = request.GET.get("supplier") or str(
        next((h["id"] for h in homes if request.user.pk in h["members"]), request.user.pk)
    )
    home = next((h for h in homes if str(h["id"]) == supplier), None)
    selected = request.GET.getlist("players") if "pick" in request.GET else [str(request.user.pk)]
    selected = [str(u.pk) for u in users if str(u.pk) in selected]
    games = (
        Game.objects.with_difficulty()
        .filter(user_games__user_id__in=home["members"], user_games__owned=True)
        .distinct()
        if home
        else Game.objects.none()
    )
    if request.GET.get("category") in ("board", "party"):
        games = games.filter(category=request.GET["category"])
    count = len(selected)
    if count:
        games = games.filter(
            Q(min_players__lte=count) | Q(min_players__isnull=True),
            Q(max_players__gte=count) | Q(max_players__isnull=True),
        )
    try:
        for field, lookup in [("min_time", "playing_time__gte"), ("max_time", "playing_time__lte")]:
            if request.GET.get(field):
                games = games.filter(**{lookup: max(0, int(request.GET[field]))})
        aggression = min(100, max(0, int(request.GET.get("aggression", 50))))
    except ValueError:
        return HttpResponseBadRequest("Invalid time or aggression.")
    tiers = request.GET.getlist("tiers") if "pick" in request.GET else list(ranking.TIERS)
    games = list(games)
    placements = UserGame.objects.ranked().filter(user_id__in=selected)
    game_tiers, user_scores = defaultdict(set), defaultdict(dict)
    for p in placements:
        game_tiers[p.game_id].add(p.tier)
        if p.score is not None:
            user_scores[str(p.user_id)][p.game_id] = p.score
    games = [g for g in games if not game_tiers[g.pk] or game_tiers[g.pk] & set(tiers)]
    mode = request.GET.get("mode", "random")
    missing_difficulty = 0
    if mode in ("favor-easy", "favor-hard"):
        missing_difficulty = sum(g.difficulty is None for g in games)
        games = [g for g in games if g.difficulty is not None]
    weights = [1.0] * len(games)
    if mode == "favor-easy":
        weights = [7 - g.difficulty for g in games]
    elif mode == "favor-hard":
        weights = [g.difficulty for g in games]
    elif mode == "player-ranked":
        voters = selected
        averages = {
            uid: sum(user_scores[uid].values()) / len(user_scores[uid]) if user_scores[uid] else 5.5
            for uid in voters
        }
        weights = [
            sum(user_scores[uid].get(g.pk, averages[uid]) for uid in voters) / len(voters)
            if voters
            else 5
            for g in games
        ]
    exponent = 0.1 + (aggression / 100) * 2.9
    weights = [weight**exponent for weight in weights]
    chosen = (
        random.choices(games, weights=weights, k=1)[0] if games and "pick" in request.GET else None
    )
    total = sum(weights)
    return page(
        request,
        "picker",
        title="What should we play?",
        users=users,
        households=homes,
        supplier=supplier,
        selected=selected,
        tiers=tiers,
        mode=mode,
        aggression=aggression,
        missing_difficulty=missing_difficulty,
        chosen=chosen,
        pool=[
            {"game": game, "chance": round(weight / total * 100, 1)}
            for game, weight in zip(games, weights)
        ],
        wheel={
            "chosen": chosen.pk if chosen else None,
            "games": [
                {"id": game.pk, "name": game.name, "weight": weight}
                for game, weight in zip(games, weights)
            ],
        },
    )


def history_context(request, games, metric="enjoyment"):
    games = list(games)
    game = next(
        (game for game in games if str(game.pk) == request.GET.get("history_game")),
        games[0] if games else None,
    )
    players = [
        {
            "id": str(uid) if uid else "community",
            "name": (name or username) if uid else "Community",
        }
        for uid, name, username in DailyScore.objects.filter(game=game, metric=metric)
        .order_by()
        .values_list("user_id", "user__display_name", "user__username")
        .distinct()
    ]
    players.sort(key=lambda row: (row["id"] != "community", row["name"], row["id"]))
    player_ids = {row["id"] for row in players}
    preferred = "community"
    selected = request.GET.get("history_user", preferred)
    if selected not in player_ids:
        selected = preferred if preferred in player_ids else (players[0]["id"] if players else None)
    points = (
        insights.score_history(game.pk, None if selected == "community" else selected, metric)
        if game
        else []
    )
    return {
        "history_games": games,
        "history_game": game,
        "history_players": players,
        "history_user": selected,
        "history": {
            "points": points,
            "score_max": 6 if metric == "difficulty" else 10,
            "metric": metric,
            "today": timezone.localdate(),
            "timezone": timezone.get_current_timezone_name(),
        },
        "history_rows": points[::-1],
    }


@login_required
@require_GET
def statistics(request):
    cat, metric = category(request), request_metric(request)
    games = Game.objects.with_difficulty().filter(category=cat)
    if metric == "enjoyment":
        games = games.with_enjoyment()
    score_field = "difficulty_tier" if metric == "difficulty" else "score"
    placements = list(
        UserGame.objects.ranked(metric)
        .filter(game__category=cat)
        .values_list("user_id", "game_id", score_field)
    )
    own = {gid: score for uid, gid, score in placements if uid == request.user.pk}
    charts = [
        {
            "id": game.pk,
            "name": game.name,
            "bgg": game.bgg_rating,
            "difficulty": game.difficulty,
            "difficulty_votes": game.difficulty_votes,
            "community": game.difficulty if metric == "difficulty" else game.community_score,
            "you": own.get(game.pk),
        }
        for game in games
    ]
    return page(
        request,
        "statistics",
        title="Statistics",
        category=cat,
        **ranking.metric_config(metric),
        charts=charts,
        game_count=len(charts),
        ranked_count=len({gid for _, gid, score in placements if score is not None}),
        ranker_count=len({uid for uid, _, _ in placements}),
        **history_context(
            request,
            Game.objects.filter(category=cat, daily_scores__metric=metric).distinct(),
            metric,
        ),
    )


@login_required
@require_GET
def achievements(request):
    manual = Achievement.objects.prefetch_related("awards__user")
    return page(
        request,
        "achievements",
        title="Achievements & bounties",
        manual=manual,
        computed=insights.computed_achievements(),
        bounties=Bounty.objects.select_related("claimed_by"),
    )


@login_required
def feedback(request):
    form = FeedbackForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        row = form.save(commit=False)
        row.user = request.user
        row.save()
        return redirect("feedback")
    return page(
        request,
        "feedback",
        title="Feedback",
        form=form,
        rows=Feedback.objects.select_related("user").order_by("-created_at"),
    )


@login_required
@require_POST
def delete_feedback(request, pk):
    row = get_object_or_404(Feedback, pk=pk)
    if not request.user.is_staff and (row.user_id != request.user.pk or row.status != "new"):
        raise PermissionDenied
    row.delete()
    return redirect("feedback")


@login_required
@require_GET
def furtch(request):
    stories = json.loads((Path(__file__).parent / "data/stories.json").read_text())
    for story in stories:
        story["paragraphs"] = [p.replace("<name>", str(request.user)) for p in story["paragraphs"]]
    return page(request, "furtch", title="The Furtch Chronicles", stories=stories)


@api
@require_POST
def heartbeat(request):
    now = time.time()
    last = request.session.get("heartbeat", 0)
    elapsed = max(0, min(int(now - last), 60)) if last else 0
    if last and now - last < 20:
        return JsonResponse({"ok": True})
    Activity.objects.get_or_create(user=request.user)
    Activity.objects.filter(user=request.user).update(
        total_seconds=F("total_seconds") + elapsed,
        visit_count=F("visit_count") + (1 if not last or now - last > 1800 else 0),
        last_seen_at=timezone.now(),
    )
    request.session["heartbeat"] = now
    return JsonResponse({"ok": True})


@api
@require_GET
def bgg_search(request):
    return JsonResponse(bgg.search(request.GET.get("q", "")), safe=False)


@api
@require_GET
def bgg_game(request, bgg_id):
    return JsonResponse(bgg.details(bgg_id))


@login_required
def rules(request):
    staff(request)
    instance = (
        get_object_or_404(Rulebook, pk=request.GET["edit"]) if request.GET.get("edit") else None
    )
    form = RulebookForm(request.POST or None, instance=instance)
    if request.method == "POST" and form.is_valid():
        row = form.save(commit=False)
        row.created_by = row.created_by or request.user
        row.updated_at = timezone.now()
        row.token_estimate = (len(row.content_md) + 3) // 4
        row.save()
        return redirect("rules")
    return page(
        request,
        "rules",
        title="Rulebook library",
        form=form,
        rows=Rulebook.objects.select_related("game"),
    )
