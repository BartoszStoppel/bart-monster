from datetime import date, datetime
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.core.management.base import CommandError
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings

from . import chat, insights, ranking
from .management.commands.import_supabase import (
    TABLES,
    capture_current_day,
    import_daily_history,
    import_rows,
)
from .models import DailyScore, Game, User, UserGame
from .tests import TEST_SETTINGS


@override_settings(**TEST_SETTINGS)
class DifficultyTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username="zulu", display_name="Zulu")
        cls.other = User.objects.create_user(username="alpha", display_name="Alpha")
        cls.games = [Game.objects.create(bgg_id=i, name=f"Game {i}") for i in range(1, 4)]
        cls.party = Game.objects.create(bgg_id=10, name="Party", category="party")

    def setUp(self):
        self.client.force_login(self.user)

    def save(self, entries, metric="difficulty", user=None, category="board", revision=None):
        user = user or self.user
        return ranking.save_ranking(
            user,
            [{"id": pk, "tier": tier} for pk, tier in entries],
            revision or ranking.current_revision(user, category, metric=metric),
            category,
            metric=metric,
        )

    def test_fixed_tiers_and_visual_order_do_not_rescale_other_games(self):
        self.save([(1, "1")])
        before = list(DailyScore.objects.filter(game_id=1).values())
        self.save([(1, "1"), (2, "6")])
        self.assertEqual(list(DailyScore.objects.filter(game_id=1).values()), before)
        self.save([(1, "1"), (2, "1")])
        before = list(DailyScore.objects.values())
        revision = self.save([(2, "1"), (1, "1")])
        self.assertEqual(list(DailyScore.objects.values()), before)
        self.assertEqual(UserGame.objects.get(game_id=1).difficulty_tier, 1)
        self.assertEqual(UserGame.objects.get(game_id=1).difficulty_position, 1)
        self.assertEqual(self.save([(2, "1"), (1, "1")]), revision)

    def test_cross_mode_unranked_banks_and_independent_state(self):
        self.save([(1, "S")], "enjoyment")
        self.save([(2, "4")])
        for metric, unranked in [("difficulty", 1), ("enjoyment", 2)]:
            response = self.client.get("/tier-list", {"metric": metric})
            bank = next(b for b in response.context["buckets"] if b["value"] == "U")
            self.assertIn(unranked, [g.pk for g in bank["items"]])
        self.assertFalse(DailyScore.objects.filter(game_id=1, metric="difficulty").exists())
        self.assertFalse(DailyScore.objects.filter(game_id=2, metric="enjoyment").exists())
        enjoyment_revision = ranking.current_revision(self.user)
        self.save([(1, "1"), (2, "4")])
        self.assertEqual(ranking.current_revision(self.user), enjoyment_revision)
        self.save([(1, "A"), (2, "F")], "enjoyment", revision=enjoyment_revision)
        self.client.post("/games/1/collection", {"wishlist_note": "keep"})
        self.client.post("/games/1/rating", {"rating": "8", "comment": "review"})
        self.save([], "enjoyment")
        self.assertEqual(UserGame.objects.get(game_id=2).difficulty_tier, 4)
        self.save([])
        self.assertFalse(UserGame.objects.filter(game_id=2).exists())
        row = UserGame.objects.get(game_id=1)
        self.assertEqual((row.wishlist_note, row.rating, row.comment), ("keep", 8, "review"))

    def test_history_is_daily_independent_and_preserves_decreases_and_unranking(self):
        for time, tier in [
            ("2026-09-27T23:30:00-04:00", "6"),
            ("2026-09-28T00:30:00-04:00", "4"),
            ("2026-09-28T12:30:00-04:00", "2"),
        ]:
            with patch("hub.ranking.timezone.now", return_value=datetime.fromisoformat(time)):
                self.save([(1, tier)])
                self.save([(1, "S")], "enjoyment")
        points = insights.score_history(1, self.user.pk, "difficulty")
        self.assertEqual(
            [(p["date"], p["score"], p["change"]) for p in points],
            [(date(2026, 9, 27), 6, None), (date(2026, 9, 28), 2, -4)],
        )
        self.assertEqual(insights.score_history(1, self.user.pk)[0]["score"], 10)
        with patch(
            "hub.ranking.timezone.now",
            return_value=datetime.fromisoformat("2026-09-28T13:30:00-04:00"),
        ):
            self.save([(1, "6")], user=self.other)
            for tier in ["1", "2", "3", "2"]:
                self.save([(1, tier)])
            self.assertEqual(
                DailyScore.objects.get(
                    metric="difficulty", user=None, game_id=1, day=date(2026, 9, 28)
                ).score,
                4,
            )
            self.save([])
            self.save([], user=self.other)
        self.assertIsNone(insights.score_history(1, None, "difficulty")[-1]["score"])
        self.assertEqual(Game.objects.with_difficulty().get(pk=1).difficulty_votes, 0)
        for path in ["/games/1", "/statistics"]:
            response = self.client.get(path, {"metric": "difficulty", "history_game": 1})
            self.assertEqual(response.context["history"]["metric"], "difficulty")
            self.assertEqual(response.context["history"]["score_max"], 6)

    def test_api_retries_conflicts_and_server_owned_values(self):
        payload = {
            "entries": [{"id": 1, "tier": "2", "score": 999}],
            "revision": ranking.current_revision(self.user, metric="difficulty"),
        }
        url = "/api/rankings/difficulty/board"
        first = self.client.post(url, payload, content_type="application/json")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()["placements"][0]["score"], 2)
        before = list(DailyScore.objects.values())
        self.assertEqual(
            self.client.post(url, payload, content_type="application/json").json(), first.json()
        )
        self.assertEqual(list(DailyScore.objects.values()), before)
        self.save([(1, "5")])
        self.assertEqual(
            self.client.post(url, payload, content_type="application/json").status_code, 409
        )
        payload["revision"] = ranking.current_revision(self.user)  # Wrong metric.
        self.assertEqual(
            self.client.post(url, payload, content_type="application/json").status_code, 409
        )
        for entries in [[(1, "S")], [(1, "0")], [(1, "7")], [(10, "1")], [(1, "1"), (1, "2")]]:
            with self.subTest(entries=entries), self.assertRaises(ValidationError):
                self.save(entries)
        response = self.client.post(
            "/rankings/difficulty/board/move",
            {
                "id": 1,
                "tier": "U",
                "revision": ranking.current_revision(self.user, metric="difficulty"),
            },
        )
        self.assertEqual(response.url, "/tier-list?category=board&metric=difficulty")
        self.assertFalse(UserGame.objects.ranked("difficulty").exists())

    def test_metric_scope_and_database_constraints(self):
        revisions = [
            ranking.current_revision(self.user),
            ranking.current_revision(self.other),
            ranking.current_revision(self.user, "party"),
            ranking.current_revision(self.user, metric="difficulty"),
        ]
        self.assertEqual(len(set(revisions)), 4)
        for user in [self.user, None]:
            for metric in ["difficulty", "enjoyment"]:
                DailyScore.objects.create(user=user, game_id=1, metric=metric, score=2)
                with self.assertRaises(IntegrityError), transaction.atomic():
                    DailyScore.objects.create(user=user, game_id=1, metric=metric, score=4)
        for fields in [{"difficulty_tier": 7}, {"difficulty_tier": 0}, {"difficulty_position": 1}]:
            with self.assertRaises(IntegrityError), transaction.atomic():
                UserGame.objects.create(user=self.user, game_id=1, **fields)
        self.assertEqual(self.client.get("/community?metric=unknown").status_code, 400)

    def test_community_level_order_and_filters_are_independent_of_metric(self):
        self.save([(1, "S"), (2, "A")], "enjoyment")
        self.save([(1, "S")], "enjoyment", user=self.other)
        self.save([(1, "6")], user=self.other)
        for metric in ["enjoyment", "difficulty"]:
            response = self.client.get("/community", {"metric": metric})
            self.assertEqual(
                [r["user"].pk for r in response.context["rows"]], [self.user.pk, self.other.pk]
            )
            self.assertEqual(response.context["users"][0], self.user)
            self.assertContains(response, f"category=party&amp;metric={metric}")
            self.assertEqual(response.context["rows"][0]["rank"]["name"], "Cannon Fodder")
        self.assertNotContains(response, "Your predicted favorites")
        self.assertContains(response, "No difficulty rankings yet")
        response = self.client.get("/community?metric=difficulty&category=party")
        self.assertContains(response, "metric=enjoyment&amp;category=party")
        tied = insights.community_data("party", "difficulty")["users"]
        self.assertEqual([u.pk for u in tied], sorted([self.user.pk, self.other.pk], key=str))
        for game_id in range(4, 7):
            Game.objects.create(bgg_id=game_id, name=f"Game {game_id}")
        self.save([(game_id, "S") for game_id in range(1, 7)], "enjoyment")
        rows = insights.community_data("board", "difficulty")["rows"]
        self.assertEqual([row["rank"]["name"] for row in rows], ["Initiate", "Cannon Fodder"])
        self.assertEqual(rows[0]["user"], self.user)

    def test_sitewide_community_mean_replaces_bgg_and_unknowns_stay_unknown(self):
        self.save([(1, "1"), (2, "6")])
        self.save([(1, "3")], user=self.other)
        for game in self.games:
            UserGame.objects.get_or_create(user=self.user, game=game)
        UserGame.objects.filter(user=self.user).update(owned=True)
        games = list(Game.objects.with_difficulty().filter(pk__in=[1, 2, 3]).order_by("pk"))
        self.assertEqual(
            [(g.difficulty, g.difficulty_votes) for g in games], [(2, 2), (6, 1), (None, 0)]
        )
        # Joining owners must not inflate the two real difficulty votes.
        self.assertEqual(
            Game.objects.with_difficulty()
            .filter(user_games__user__in=[self.user, self.other])
            .get(pk=2)
            .difficulty_votes,
            1,
        )
        self.assertContains(self.client.get("/games/1"), "2.0 / 6")
        self.assertContains(self.client.get("/games/3"), "Unrated")
        for sort in ["weight", "difficulty"]:
            self.assertEqual(
                [g.pk for g in self.client.get("/", {"sort": sort}).context["games"]], [2, 1, 3, 10]
            )
        for metric in ["enjoyment", "difficulty"]:
            response = self.client.get("/statistics", {"metric": metric})
            self.assertEqual(response.context["charts"][0]["difficulty"], 2)
            self.assertNotContains(response, "BGG complexity")
        for mode, expected in [("favor-easy", {1: 5, 2: 1}), ("favor-hard", {1: 2, 2: 6})]:
            response = self.client.get("/picker", {"mode": mode, "aggression": 0})
            self.assertEqual(response.context["missing_difficulty"], 1)
            self.assertEqual(
                {g["id"]: round(g["weight"] ** 10) for g in response.context["wheel"]["games"]},
                expected,
            )
        self.assertEqual(len(self.client.get("/picker").context["pool"]), 3)
        result = chat.data_tool(self.user, "get_collection", {"max_difficulty": 3})
        self.assertEqual([g["bgg_id"] for g in result["games"]], [1])
        self.assertEqual(result["games"][0]["difficulty_source"], "community")
        self.assertEqual(result["games"][0]["difficulty_votes"], 2)
        for args in [
            {"min_weight": 2},
            {"min_difficulty": 0},
            {"max_difficulty": 7},
            {"min_difficulty": 5, "max_difficulty": 2},
        ]:
            self.assertIn("error", chat.data_tool(self.user, "get_collection", args))

    def test_hot_take_uses_difficulty_votes_only(self):
        third = User.objects.create_user(username="third")
        for user, tier in [(self.user, "1"), (self.other, "6"), (third, "6")]:
            self.save([(1, tier)], user=user)
        response = self.client.get("/community?metric=difficulty")
        self.assertContains(response, 'class="hot-take"')
        self.assertTrue(all(row["hot_take_id"] == 1 for row in response.context["rows"]))
        self.assertFalse(
            any(row["hot_take_id"] for row in insights.community_data("board")["rows"])
        )

    def test_import_baseline_and_old_snapshots_cannot_overwrite_difficulty_history(self):
        self.save([(1, "2")])
        before = list(DailyScore.objects.filter(metric="difficulty").values())
        capture_current_day()
        import_daily_history(
            [
                {
                    "id": "old",
                    "user_id": str(self.user.pk),
                    "bgg_id": 1,
                    "score": 9,
                    "snapshot_at": "2020-01-01T12:00:00Z",
                }
            ]
        )
        self.assertEqual(list(DailyScore.objects.filter(metric="difficulty").values()), before)
        self.assertEqual(DailyScore.objects.get(metric="enjoyment").score, 9)

    def test_category_change_preserves_difficulty_and_normalizes_positions(self):
        self.save([(1, "2"), (2, "2")])
        before = list(DailyScore.objects.values())
        with transaction.atomic():
            Game.objects.filter(pk=1).update(category="party")
            ranking.recompute_all()
        self.assertEqual(UserGame.objects.get(game_id=2).difficulty_position, 0)
        self.assertEqual(UserGame.objects.get(game_id=1).difficulty_tier, 2)
        self.assertEqual(list(DailyScore.objects.values()), before)

    def test_retired_bgg_fields_import_without_becoming_difficulty_votes(self):
        self.save([(1, "2")])
        snapshot = {table: [] for table in TABLES}
        snapshot["board_games"] = [
            {"bgg_id": 1, "name": "Game 1", "bgg_weight": 4.9, "bgg_num_weights": 10000}
        ]
        import_rows(snapshot)
        game = Game.objects.with_difficulty().get(pk=1)
        self.assertEqual((game.difficulty, game.difficulty_votes), (2, 1))
        snapshot["board_games"][0]["unexpected"] = "must reject"
        with self.assertRaises(CommandError), transaction.atomic():
            import_rows(snapshot)
