from datetime import date, datetime, timedelta
from unittest.mock import patch

from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.utils import timezone

from . import insights, ranking
from .models import DailyScore, Game, User, UserGame
from .tests import TEST_SETTINGS


@override_settings(**TEST_SETTINGS)
class ScoreHistoryTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.users = [
            User.objects.create_user(username=f"player{i}", display_name="Same name")
            for i in range(3)
        ]
        cls.games = [Game.objects.create(bgg_id=i, name="Same game") for i in range(1, 4)]

    def setUp(self):
        self.client.force_login(self.users[0])

    def snapshot(self, score, timestamp, user=None, game=None):
        return DailyScore.objects.update_or_create(
            game=game or self.games[0],
            user=user or self.users[0],
            day=timezone.localdate(datetime.fromisoformat(timestamp)),
            defaults={"score": score},
        )[0]

    def save(self, user, ids, timestamp):
        with patch("hub.ranking.timezone.now", return_value=datetime.fromisoformat(timestamp)):
            ranking.save_ranking(
                user,
                [{"id": pk, "tier": "A"} for pk in ids],
                ranking.current_revision(user),
            )

    def test_lower_vote_preserves_yesterday_and_lowers_personal_and_community_scores(self):
        for i, user in enumerate(self.users):
            self.save(user, [1, 2, 3], f"2026-09-27T12:0{i}:00-04:00")
        self.save(self.users[0], [2, 1, 3], "2026-09-28T12:00:00-04:00")

        personal = insights.score_history(1, self.users[0].pk)
        community = insights.score_history(1, None)
        self.assertEqual([row["score"] for row in personal], [10, 5.5])
        self.assertEqual([row["change"] for row in personal], [None, -4.5])
        self.assertEqual([row["score"] for row in community], [10, 8.5])
        self.assertEqual([row["change"] for row in community], [None, -1.5])
        self.assertEqual(UserGame.objects.ranked().filter(game_id=1).count(), 3)
        self.assertEqual(DailyScore.objects.filter(game_id=1, user=None).count(), 2)

        for path in [
            f"/statistics?history_game=1&history_user={self.users[0].pk}",
            f"/games/1?history_user={self.users[0].pk}",
        ]:
            response = self.client.get(path)
            self.assertEqual(response.context["history"]["points"], personal)
            self.assertContains(response, "-4.5")
            self.assertContains(response, "Change vs previous day")
        response = self.client.get("/statistics?history_game=1&history_user=community")
        self.assertEqual(response.context["history"]["points"], community)
        self.assertEqual(response.context["charts"][0]["community"], 8.5)

    def test_day_boundary_uses_indiana_time_and_only_one_value_per_day(self):
        self.save(self.users[0], [1, 2, 3], "2026-09-27T23:00:00+00:00")
        self.save(self.users[0], [2, 1, 3], "2026-09-28T01:00:00+00:00")
        self.save(self.users[0], [2, 3, 1], "2026-09-28T04:30:00+00:00")
        self.assertEqual(
            insights.score_history(1, self.users[0].pk),
            [
                {"date": date(2026, 9, 27), "score": 5.5, "change": None},
                {"date": date(2026, 9, 28), "score": 1, "change": -4.5},
            ],
        )
        self.assertEqual(DailyScore.objects.filter(game_id=1, user=self.users[0]).count(), 2)

    def test_frequent_edits_do_not_give_a_player_extra_weight(self):
        self.save(self.users[0], [1, 2], "2026-09-28T12:00:00-04:00")
        self.save(self.users[1], [2, 1], "2026-09-28T12:01:00-04:00")
        for i in range(10):
            self.save(
                self.users[0], [2, 1] if i % 2 == 0 else [1, 2], f"2026-09-28T13:{i:02}:00-04:00"
            )
        daily = DailyScore.objects.get(game_id=1, user=None)
        self.assertEqual(daily.score, 5.5)
        self.assertEqual(DailyScore.objects.count(), 6)
        self.assertEqual(self.client.get("/games/1").context["history_user"], "community")

    def test_database_enforces_one_personal_and_community_score_per_day(self):
        for user in [self.users[0], None]:
            with self.subTest(user=user):
                DailyScore.objects.create(user=user, game_id=1, day=date(2026, 9, 28), score=8)
                with self.assertRaises(IntegrityError), transaction.atomic():
                    DailyScore.objects.create(user=user, game_id=1, day=date(2026, 9, 28), score=3)

    def test_repeated_edits_accept_revision_and_only_update_todays_score(self):
        revision = ranking.current_revision(self.users[0])
        for ids in [[1, 2, 3], [2, 1, 3], [2, 1], [2, 1], []]:
            response = self.client.post(
                "/api/rankings/board",
                {"entries": [{"id": pk, "tier": "A"} for pk in ids], "revision": revision},
                content_type="application/json",
            )
            self.assertEqual(response.status_code, 200)
            revision = response.json()["revision"]
            self.assertEqual(revision, ranking.current_revision(self.users[0]))
        self.assertEqual(
            list(
                DailyScore.objects.filter(game_id=1, user=self.users[0])
                .order_by("day")
                .values_list("score", flat=True)
            ),
            [None],
        )

    def test_lost_autosave_response_can_be_retried_without_duplicate_history(self):
        payload = {
            "entries": [{"id": 1, "tier": "S"}, {"id": 2, "tier": "A"}],
            "revision": ranking.current_revision(self.users[0]),
        }
        first = self.client.post("/api/rankings/board", payload, content_type="application/json")
        self.assertEqual(first.status_code, 200)
        snapshots = list(DailyScore.objects.values_list("pk", flat=True))
        retry = self.client.post("/api/rankings/board", payload, content_type="application/json")
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(retry.json(), first.json())
        self.assertEqual(list(DailyScore.objects.values_list("pk", flat=True)), snapshots)
        self.assertEqual(
            first.json()["placements"],
            [
                {"id": "1", "tier": "S", "position": 0, "score": 10},
                {"id": "2", "tier": "A", "position": 0, "score": 1},
            ],
        )

        self.save(self.users[0], [2, 1], "2026-09-28T13:00:00-04:00")
        before = list(UserGame.objects.ranked().values())
        conflict = self.client.post("/api/rankings/board", payload, content_type="application/json")
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(list(UserGame.objects.ranked().values()), before)

    def test_quiet_days_carry_forward_but_unranked_days_reset_comparison(self):
        for day, score in [(20, 8), (23, 6), (24, None), (26, 4), (27, 5)]:
            self.snapshot(score, f"2026-09-{day}T12:00:00-04:00")
        points = insights.score_history(1, self.users[0].pk)
        self.assertEqual([row["change"] for row in points], [None, -2, None, None, 1])
        response = self.client.get("/games/1")
        self.assertContains(response, "Unranked")
        self.assertContains(response, "+1.0")

    def test_first_vote_has_no_invented_previous_day_score(self):
        self.snapshot(6, "2026-09-28T12:00:00-04:00")
        self.assertEqual(
            insights.score_history(1, self.users[0].pk),
            [{"date": date(2026, 9, 28), "score": 6, "change": None}],
        )

    def test_busy_daily_history_has_no_global_limit(self):
        start = date(2000, 1, 1)
        DailyScore.objects.bulk_create(
            DailyScore(game=game, user=self.users[0], score=7, day=start + timedelta(days=i))
            for game in self.games[:2]
            for i in range(2001)
        )
        self.snapshot(4, "2026-09-28T12:00:00-04:00")
        response = self.client.get("/statistics?history_game=1")
        points = response.context["history"]["points"]
        self.assertEqual(len(points), 2002)
        self.assertEqual(points[0]["date"], start)
        self.assertEqual(points[-1]["score"], 4)
        self.assertEqual(points[-1]["change"], -3)

    def test_filters_use_ids_even_when_games_and_players_share_names(self):
        self.snapshot(8, "2026-09-27T12:00:00-04:00")
        self.snapshot(3, "2026-09-27T12:00:00-04:00", user=self.users[1])
        self.snapshot(1, "2026-09-27T12:00:00-04:00", game=self.games[1])
        response = self.client.get(f"/statistics?history_game=1&history_user={self.users[1].pk}")
        self.assertEqual([row["score"] for row in response.context["history"]["points"]], [3])
        response = self.client.get("/statistics?history_game=2")
        self.assertEqual([row["score"] for row in response.context["history"]["points"]], [1])

    def test_invalid_filters_fall_back_and_categories_stay_separate(self):
        self.snapshot(8, "2026-09-27T12:00:00-04:00")
        party = Game.objects.create(bgg_id=10, name="Party", category="party")
        self.snapshot(2, "2026-09-27T12:00:00-04:00", game=party)
        response = self.client.get("/statistics?history_game=10&history_user=invalid")
        self.assertEqual(response.context["history_game"].pk, 1)
        self.assertEqual(response.context["history_user"], str(self.users[0].pk))
        response = self.client.get("/statistics?category=party&history_game=1")
        self.assertEqual(response.context["history_game"].pk, 10)
        self.assertEqual([row["score"] for row in response.context["history"]["points"]], [2])
