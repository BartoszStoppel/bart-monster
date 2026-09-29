import os
import tempfile
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import patch

import httpx
from django.core.management.base import CommandError
from django.db import connections
from django.db.migrations.executor import MigrationExecutor
from django.test import SimpleTestCase, TestCase, override_settings

from . import insights, ranking
from .management.commands.import_supabase import TABLES, export_tables, import_daily_history
from .models import DailyScore, Game, User, UserGame
from .tests import TEST_SETTINGS


@override_settings(**TEST_SETTINGS)
class ConsolidationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="daily-player")
        self.game = Game.objects.create(bgg_id=1, name="Game")
        self.client.force_login(self.user)

    def save_ranking(self, entries):
        ranking.save_ranking(self.user, entries, ranking.current_revision(self.user))

    def test_ownership_rating_and_tier_edit_share_one_row_without_overwriting(self):
        self.client.post("/games/1/collection", {"owned": "on", "wishlist_note": "Keep this note"})
        self.client.post("/games/1/rating", {"rating": "8", "comment": "A review"})
        self.save_ranking([{"id": 1, "tier": "S"}])
        row = UserGame.objects.get()
        self.assertEqual((row.owned, row.rating, row.comment, row.score), (True, 8, "A review", 10))
        self.save_ranking([])
        row.refresh_from_db()
        self.assertEqual((row.owned, row.rating, row.comment, row.tier), (True, 8, "A review", ""))
        self.assertIsNone(row.score)
        self.assertEqual(row.wishlist_note, "Keep this note")
        self.assertEqual(UserGame.objects.count(), 1)
        # Ownership-only rows must not count as ratings or hide games from the unranked filter.
        self.assertContains(self.client.get("/?filter=unranked"), "Game")
        self.assertEqual(self.client.get("/statistics").context["ranked_count"], 0)

    def test_empty_associations_are_removed_but_notes_and_priorities_survive(self):
        self.client.post("/games/1/collection", {"owned": "on"})
        self.client.post("/games/1/collection", {})
        self.assertFalse(UserGame.objects.exists())
        self.client.post(
            "/games/1/collection", {"wishlist_note": "Buy later", "wishlist_priority": "2"}
        )
        self.client.post("/games/1/remove-wishlist")
        row = UserGame.objects.get()
        self.assertFalse(row.wishlist)
        self.assertEqual((row.wishlist_note, row.wishlist_priority), ("Buy later", 2))
        self.assertIsNotNone(row.collection_added_at)

    def test_invalid_rating_does_not_leave_an_empty_association(self):
        self.client.post("/games/1/rating", {"rating": "100", "comment": "Invalid"})
        self.assertFalse(UserGame.objects.exists())

    def test_game_averages_ignore_unranked_owners_and_explicit_ratings(self):
        for i, score in enumerate([10, 7, 4]):
            user = User.objects.create_user(username=f"ranker{i}")
            UserGame.objects.create(user=user, game=self.game, tier="A", score=score)
        UserGame.objects.create(user=self.user, game=self.game, owned=True, rating=1)
        response = self.client.get("/")
        self.assertEqual(response.context["games"][0].community_score, 7)

    def test_daily_import_keeps_the_last_lower_score_and_unranked_state(self):
        rows = [
            {
                "id": str(uuid.uuid4()),
                "user_id": str(self.user.pk),
                "bgg_id": 1,
                "score": score,
                "snapshot_at": timestamp,
            }
            for score, timestamp in [
                (8, "2026-09-27T22:00:00Z"),
                (3, "2026-09-28T01:00:00Z"),
                (None, "2026-09-28T15:00:00Z"),
            ]
        ]
        self.assertEqual(import_daily_history(list(reversed(rows))), 2)
        self.assertEqual(
            list(DailyScore.objects.values_list("day", "score")),
            [
                (date(2026, 9, 27), 3),
                (date(2026, 9, 28), None),
            ],
        )
        import_daily_history(rows)
        self.assertEqual(DailyScore.objects.count(), 2)
        rows[1]["snapshot_at"] = rows[0]["snapshot_at"]
        with self.assertRaises(CommandError):
            import_daily_history(rows)

    def test_missing_legacy_community_days_are_unknown_instead_of_carried_forward(self):
        DailyScore.objects.create(game=self.game, day=date(2026, 4, 4), score=8, imported=True)
        DailyScore.objects.create(game=self.game, day=date(2026, 9, 28), score=5)
        points = insights.score_history(self.game.pk, None)
        self.assertEqual([point["score"] for point in points], [8, None, 5])
        self.assertTrue(points[1]["missing"])
        self.assertIsNone(points[-1]["change"])
        self.assertContains(self.client.get("/games/1"), "Unknown")


@override_settings(SUPABASE_URL="https://example.supabase.co")
class ExportTests(SimpleTestCase):
    @patch.dict(os.environ, {"SUPABASE_SERVICE_ROLE_KEY": "fake-test-key"})
    def test_explicit_absent_rules_tables_and_pagination_are_supported(self):
        offsets = []

        def respond(request):
            table = request.url.path.split("/")[-1]
            offset = int(request.url.params["offset"])
            if table == "game_rules":
                return httpx.Response(404, json={"code": "PGRST205"})
            if table == "score_snapshots":
                offsets.append(offset)
                return httpx.Response(200, json=[{"id": offset}] if offset < 3 else [])
            return httpx.Response(200, json=[])

        client = httpx.Client(
            transport=httpx.MockTransport(respond), base_url="https://example.supabase.co/rest/v1/"
        )
        with patch("hub.management.commands.import_supabase.httpx.Client", return_value=client):
            result = export_tables(["game_rules"])
        self.assertEqual(offsets, [0, 1, 2, 3])
        self.assertEqual(len(result["score_snapshots"]), 3)
        self.assertEqual(result["game_rules"], [])
        self.assertEqual(set(result), set(TABLES) | {"user_alignments"})

    @patch.dict(os.environ, {"SUPABASE_SERVICE_ROLE_KEY": "fake-test-key"})
    def test_missing_table_permission_does_not_mask_other_failures(self):
        for status, code, allowed in [
            (404, "PGRST205", []),
            (403, "42501", ["game_rules"]),
            (500, "server_error", ["game_rules"]),
        ]:
            with self.subTest(status=status):

                def respond(request):
                    if request.url.path.endswith("/game_rules"):
                        return httpx.Response(status, json={"code": code})
                    return httpx.Response(200, json=[])

                client = httpx.Client(
                    transport=httpx.MockTransport(respond),
                    base_url="https://example.supabase.co/rest/v1/",
                )
                with (
                    patch(
                        "hub.management.commands.import_supabase.httpx.Client", return_value=client
                    ),
                    self.assertRaises(CommandError),
                ):
                    export_tables(allowed)
        with self.assertRaises(CommandError):
            export_tables(["score_snapshots"])


class CleanupMigrationTests(SimpleTestCase):
    # An isolated database exercises the irreversible compaction without rewinding the suite's DB.
    databases = "__all__"

    def test_existing_django_data_migrates_without_losing_independent_fields(self):
        with tempfile.TemporaryDirectory() as directory:
            alias = "cleanup_migration"
            connections.databases[alias] = {
                **connections.databases["default"],
                "ENGINE": "django.db.backends.sqlite3",
                "NAME": str(Path(directory) / "migration.sqlite3"),
                "OPTIONS": {},
            }
            connection = connections[alias]
            allowed = type(self).databases
            type(self).databases = {*allowed, alias}
            try:
                executor = MigrationExecutor(connection)
                executor.migrate([("hub", "0001_initial")])
                old = executor.loader.project_state([("hub", "0001_initial")]).apps

                def model(name):
                    return old.get_model("hub", name).objects.using(alias)

                user = model("User").create(username="migration")
                game = model("Game").create(bgg_id=1, name="Game")
                model("Game").create(bgg_id=2, name="Empty")
                collection = model("Collection").create(
                    user_id=user.pk, game_id=game.pk, owned=True
                )
                model("Collection").create(user_id=user.pk, game_id=2)
                model("Rating").create(
                    user_id=user.pk, game_id=game.pk, rating=7, comment="Keep my review"
                )
                placement = model("Placement").create(
                    user_id=user.pk, game_id=game.pk, tier="S", score=5
                )
                for hour, score in [(12, 8), (14, 3)]:
                    model("Snapshot").create(
                        user_id=user.pk,
                        game_id=game.pk,
                        score=score,
                        snapshot_at=datetime(2020, 1, 2, hour, tzinfo=timezone.utc),
                    )
                executor = MigrationExecutor(connection)
                executor.migrate([("hub", "0002_daily_scores_user_games")])
                new = executor.loader.project_state([("hub", "0002_daily_scores_user_games")]).apps
                row = new.get_model("hub", "UserGame").objects.using(alias).get()
                self.assertEqual(
                    (row.owned, row.rating, row.comment, row.score), (True, 7, "Keep my review", 10)
                )
                self.assertEqual(row.collection_added_at, collection.created_at)
                self.assertEqual(row.legacy_ids["tier_placements"], str(placement.pk))
                daily = new.get_model("hub", "DailyScore").objects.using(alias)
                self.assertEqual(daily.get(user_id=user.pk, day=date(2020, 1, 2)).score, 3)
                self.assertNotIn("hub_snapshot", connection.introspection.table_names())
                self.assertNotIn("hub_collection", connection.introspection.table_names())
                before_rows = list(new.get_model("hub", "UserGame").objects.using(alias).values())
                before_history = list(daily.order_by("pk").values())
                executor = MigrationExecutor(connection)
                executor.migrate([("hub", "0004_retire_bgg_difficulty")])
                latest = executor.loader.project_state([("hub", "0004_retire_bgg_difficulty")]).apps
                upgraded = latest.get_model("hub", "UserGame").objects.using(alias).get()
                for field, value in before_rows[0].items():
                    self.assertEqual(getattr(upgraded, field), value)
                self.assertIsNone(upgraded.difficulty_tier)
                upgraded_history = list(
                    latest.get_model("hub", "DailyScore")
                    .objects.using(alias)
                    .order_by("pk")
                    .values()
                )
                self.assertEqual(
                    upgraded_history, [{**row, "metric": "enjoyment"} for row in before_history]
                )
                self.assertNotIn(
                    "bgg_weight", [f.name for f in latest.get_model("hub", "Game")._meta.fields]
                )

            finally:
                type(self).databases = allowed
                connection.close()
                del connections[alias]
                del connections.databases[alias]
