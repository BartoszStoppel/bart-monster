import io
import json
import tempfile
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import httpx
from django.contrib.admin.sites import AdminSite
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import Client, SimpleTestCase, TestCase, override_settings

from . import bgg, chat, insights, ranking
from .admin import GameAdmin
from .management.commands.import_supabase import TABLES
from .models import (
    DailyScore,
    Expansion,
    ExpansionPlacement,
    Feedback,
    Game,
    Rulebook,
    RulesAnswer,
    User,
    UserGame,
)

TEST_SETTINGS = dict(
    DEBUG=True,
    SECURE_SSL_REDIRECT=False,
    SESSION_COOKIE_SECURE=False,
    CSRF_COOKIE_SECURE=False,
    STORAGES={"staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"}},
)


class AlgorithmTests(SimpleTestCase):
    def test_scores_match_legacy_boundaries_and_rounding(self):
        self.assertEqual(ranking.scores(0), [])
        self.assertEqual(ranking.scores(1), [10])
        self.assertEqual(ranking.scores(2), [10, 1])
        self.assertEqual(ranking.scores(3), [10, 5.5, 1])
        self.assertEqual(ranking.scores(5), [10, 7.8, 5.5, 3.3, 1])
        self.assertEqual(ranking.scores(21)[13], 4.1)
        self.assertEqual(ranking.scores(61)[51], 2.4)
        for count in range(2, 150):
            values = ranking.scores(count)
            self.assertEqual(values[0], 10)
            self.assertEqual(values[-1], 1)
            self.assertEqual(values, sorted(values, reverse=True))

    def test_alignment_uses_shared_order_and_missing_game_penalty(self):
        self.assertIsNone(ranking.shared_distance([1, 2], [1, 2]))
        self.assertEqual(ranking.shared_distance([1, 2, 3], [1, 2, 3, 4]), 0)
        self.assertEqual(ranking.shared_distance([1, 2, 3, 4], [1, 2, 3], True), 0.5)
        self.assertEqual(ranking.shared_distance([1, 2, 3], [3, 2, 1]), 6)

    def test_predictions_need_two_similar_raters(self):
        games = [SimpleNamespace(pk=4)]
        orders = {"a": [1, 2, 3], "b": [4, 1, 2, 3]}
        self.assertEqual(ranking.predictions("a", orders, games), [])
        orders["c"] = [4, 1, 2, 3]
        result = ranking.predictions("a", orders, games)
        self.assertEqual(result[0]["tier"], "A")
        self.assertEqual(result[0]["score"], 8.4)


@override_settings(**TEST_SETTINGS)
class HubTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="alice", password="test-local-password", display_name="Alice"
        )
        cls.other = User.objects.create_user(
            username="bob", password="test-local-password", display_name="Bob"
        )
        cls.admin = User.objects.create_superuser(
            username="admin", password="test-local-password", display_name="Admin"
        )
        cls.games = [
            Game.objects.create(
                bgg_id=i,
                name=f"Game {i}",
                min_players=1,
                max_players=4,
                playing_time=30,
                bgg_rating=7,
                mechanics=["Drafting"],
            )
            for i in range(1, 5)
        ]
        cls.party = Game.objects.create(bgg_id=10, name="Party game", category="party")
        cls.expansion = Expansion.objects.create(game=cls.games[0], name="Extra cards")

    def setUp(self):
        self.client.force_login(self.user)

    def save(self, entries, user=None, cat="board", game=None, rev=None):
        user = user or self.user
        return ranking.save_ranking(
            user, entries, rev or ranking.current_revision(user, cat, game), cat, game
        )

    def test_pages_render_empty_and_populated(self):
        paths = [
            "/",
            "/tier-list",
            "/tier-list?category=party",
            "/community",
            "/profile",
            "/wishlist",
            "/wishlist?view=shared",
            "/picker",
            "/statistics",
            "/achievements",
            "/feedback",
            "/furtch",
            "/search",
            "/chat",
            "/games/1",
            f"/users/{self.other.pk}",
        ]
        for path in paths:
            with self.subTest(path=path, populated=False):
                self.assertEqual(self.client.get(path).status_code, 200)
        self.save([{"id": g.pk, "tier": "A"} for g in self.games])
        self.save([{"id": str(self.expansion.pk), "tier": "S"}], game=self.games[0])
        UserGame.objects.filter(user=self.user, game=self.games[0]).update(
            owned=True, wishlist=True
        )
        for path in paths:
            with self.subTest(path=path, populated=True):
                self.assertEqual(self.client.get(path).status_code, 200)

    def test_statistics_count_ranked_games_not_entire_catalog(self):
        self.save([{"id": 1, "tier": "A"}])
        response = self.client.get("/statistics")
        self.assertEqual(response.context["ranked_count"], 1)
        self.assertEqual(response.context["game_count"], 4)

    def test_community_hot_takes_are_always_shown_for_high_and_low_outliers(self):
        for user, ids in [
            (self.user, [1, 2, 3, 4]),
            (self.other, [2, 3, 4, 1]),
            (self.admin, [3, 4, 2, 1]),
        ]:
            self.save([{"id": pk, "tier": "A"} for pk in ids], user=user)
        response = self.client.get("/community")
        rows = response.context["rows"]
        # Alice rates game 1 above average; Bob/Admin rate it below average.
        # Equal deviations choose the lowest game ID consistently.
        self.assertEqual(
            {row["user"].pk: row["hot_take_id"] for row in rows},
            {
                self.user.pk: 1,
                self.other.pk: 1,
                self.admin.pk: 1,
            },
        )
        self.assertContains(response, 'class="hot-take"', count=3)
        self.assertContains(response, 'title="Hottest take"', count=3)
        self.assertNotContains(response, 'type="checkbox"')
        self.assertNotContains(response, "Show hot takes")
        self.assertNotContains(response, "Hide hot takes")

    def test_hot_takes_need_three_non_null_scores_in_the_same_category(self):
        for user in [self.user, self.other]:
            self.save([{"id": 1, "tier": "A"}], user=user)
        UserGame.objects.ranked().create(user=self.admin, game=self.games[0], tier="A", score=None)
        self.assertTrue(
            all(row["hot_take_id"] is None for row in insights.community_data("board")["rows"])
        )
        for user in [self.user, self.other, self.admin]:
            self.save([{"id": 10, "tier": "A"}], user=user, cat="party")
        self.assertNotContains(self.client.get("/community"), 'class="hot-take"')
        party = self.client.get("/community?category=party")
        self.assertContains(party, 'class="hot-take"', count=3)
        self.assertTrue(all(row["hot_take_id"] == 10 for row in party.context["rows"]))

    def test_noop_save_does_not_duplicate_history(self):
        entries = [{"id": 1, "tier": "S"}]
        self.save(entries)
        count = DailyScore.objects.count()
        self.save(entries)
        self.assertEqual(DailyScore.objects.count(), count)

    @override_settings(ANTHROPIC_API_KEY="test-only")
    def test_chat_rejects_invalid_payload_without_contacting_provider(self):
        with patch("hub.chat.run_agent") as run:
            for payload in [
                [],
                {"messages": []},
                {"messages": [{"role": "system", "content": "bad"}]},
            ]:
                response = self.client.post(
                    "/api/chat", json.dumps(payload), content_type="application/json"
                )
                self.assertEqual(response.status_code, 400)
            run.assert_not_called()

    def test_private_pages_require_login(self):
        self.client.logout()
        for path in [
            "/",
            "/profile",
            "/games/1",
            "/community",
            "/api/bgg/search?q=secret",
            "/chat",
            "/admin/rules",
        ]:
            self.assertEqual(self.client.get(path).status_code, 302)
        self.assertEqual(self.client.get("/login").status_code, 200)

    def test_rankings_are_scoped_and_computed_by_server(self):
        self.save([{"id": 10, "tier": "F"}], cat="party")
        self.save(
            [{"id": 1, "tier": "F", "score": 100}, {"id": 2, "tier": "S"}, {"id": 3, "tier": "A"}]
        )
        scores = dict(
            UserGame.objects.ranked().filter(user=self.user).values_list("game_id", "score")
        )
        self.assertEqual(scores, {1: 1, 2: 10, 3: 5.5, 10: 10})
        self.save([], cat="board")
        self.assertEqual(
            list(
                UserGame.objects.ranked().filter(user=self.user).values_list("game_id", flat=True)
            ),
            [10],
        )
        self.assertTrue(DailyScore.objects.filter(game_id=1, user=self.user, score=None).exists())

    def test_invalid_and_duplicate_rankings_do_not_change_data(self):
        self.save([{"id": 1, "tier": "A"}])
        before = list(UserGame.objects.ranked().values())
        for entries in [
            [{"id": 10, "tier": "S"}],
            [{"id": 1, "tier": "X"}],
            [{"id": 1, "tier": "A"}, {"id": 1, "tier": "B"}],
            [None],
            "bad",
        ]:
            with self.subTest(entries=entries), self.assertRaises(ValidationError):
                self.save(entries)
        self.assertEqual(list(UserGame.objects.ranked().values()), before)

    def test_stale_ranking_conflicts_and_other_users_are_untouched(self):
        old = ranking.current_revision(self.user)
        self.save([{"id": 1, "tier": "S"}], user=self.other)
        self.save([{"id": 2, "tier": "A"}])
        response = self.client.post(
            "/api/rankings/board",
            data=json.dumps({"entries": [], "revision": old}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(UserGame.objects.ranked().count(), 2)
        self.assertEqual(UserGame.objects.ranked().get(user=self.other).game_id, 1)

    def test_save_rolls_back_deletes_if_snapshot_write_fails(self):
        self.save([{"id": 1, "tier": "S"}])
        with patch("hub.ranking.record_daily_scores", side_effect=RuntimeError("failed")):
            with self.assertRaises(RuntimeError):
                self.save([{"id": 2, "tier": "A"}])
        self.assertEqual(UserGame.objects.ranked().get(user=self.user).game_id, 1)

    def test_expansions_share_ranking_logic_without_affecting_games(self):
        second = Expansion.objects.create(game=self.games[0], name="More cards")
        foreign = Expansion.objects.create(game=self.games[1], name="Other game's expansion")
        self.save([{"id": 1, "tier": "A"}])
        self.save(
            [{"id": str(self.expansion.pk), "tier": "S"}, {"id": str(second.pk), "tier": "F"}],
            game=self.games[0],
        )
        self.assertEqual(set(ExpansionPlacement.objects.values_list("score", flat=True)), {1, 10})
        with self.assertRaises(ValidationError):
            self.save([{"id": str(foreign.pk), "tier": "S"}], game=self.games[0])
        self.assertEqual(UserGame.objects.ranked().get().score, 10)

    def test_expansion_autosave_returns_scores_and_acknowledges_identical_retries(self):
        second = Expansion.objects.create(game=self.games[0], name="More cards")
        payload = {
            "entries": [
                {"id": str(self.expansion.pk), "tier": "B", "score": 100},
                {"id": str(second.pk), "tier": "S", "score": -10},
            ],
            "revision": ranking.current_revision(self.user, game=self.games[0]),
        }
        url = f"/api/rankings/expansions/{self.games[0].pk}"
        first = self.client.post(url, payload, content_type="application/json")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(
            first.json()["placements"],
            [
                {"id": str(second.pk), "tier": "S", "position": 0, "score": 10},
                {"id": str(self.expansion.pk), "tier": "B", "position": 0, "score": 1},
            ],
        )
        retry = self.client.post(url, payload, content_type="application/json")
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(retry.json(), first.json())
        self.assertFalse(UserGame.objects.ranked().exists())
        self.assertFalse(DailyScore.objects.exists())

    def test_regular_users_cannot_edit_or_delete_shared_data(self):
        for action in ["edit", "delete", "refresh", "expansion"]:
            self.assertEqual(
                self.client.post(
                    f"/games/1/{action}", {"category": "party", "name": "Bad"}
                ).status_code,
                403,
            )
        self.assertEqual(self.client.get("/admin/rules").status_code, 403)
        self.assertEqual(self.client.post("/api/rules/convert").status_code, 403)
        self.assertTrue(Game.objects.filter(pk=1).exists())

    def test_category_changes_and_deletes_recompute_each_category(self):
        self.save([{"id": 1, "tier": "S"}, {"id": 2, "tier": "A"}, {"id": 3, "tier": "B"}])
        self.save([{"id": 10, "tier": "S"}], cat="party")
        self.client.force_login(self.admin)
        self.client.post("/games/1/delete")
        scores = dict(
            UserGame.objects.ranked().filter(user=self.user).values_list("game_id", "score")
        )
        self.assertEqual(scores, {2: 10, 3: 1, 10: 10})
        self.client.post("/games/2/edit", {"category": "party"})
        scores = dict(
            UserGame.objects.ranked().filter(user=self.user).values_list("game_id", "score")
        )
        self.assertEqual(scores, {2: 1, 3: 10, 10: 10})

    def test_admin_bulk_deletion_also_recomputes_scores(self):
        self.save([{"id": 1, "tier": "S"}, {"id": 2, "tier": "A"}])
        GameAdmin(Game, AdminSite()).delete_queryset(None, Game.objects.filter(pk=1))
        self.assertEqual(UserGame.objects.ranked().get().score, 10)

    def test_wishlist_preserves_ownership_and_never_mutates_partner(self):
        own = UserGame.objects.create(user=self.user, game=self.games[0], owned=True)
        partner = UserGame.objects.create(user=self.other, game=self.games[0], wishlist=True)
        self.client.post("/games/1/wishlist", {"user_id": str(self.other.pk)})
        own.refresh_from_db()
        self.assertTrue(own.owned and own.wishlist)
        self.client.post("/games/1/acquire")
        own.refresh_from_db()
        partner.refresh_from_db()
        self.assertTrue(own.owned)
        self.assertFalse(own.wishlist)
        self.assertTrue(partner.wishlist)

    def test_no_open_redirect_or_cross_site_mutation(self):
        response = self.client.post("/games/1/wishlist", {"next": "https://evil.example/"})
        self.assertEqual(response.url, "/games/1")
        strict = Client(enforce_csrf_checks=True)
        strict.force_login(self.user)
        self.assertEqual(strict.post("/games/1/wishlist").status_code, 403)
        self.assertEqual(self.client.get("/games/1/delete").status_code, 405)

    def test_accessible_move_supports_empty_position_and_clear(self):
        response = self.client.post(
            "/rankings/board/move",
            {
                "id": "1",
                "tier": "S",
                "position": "",
                "revision": ranking.current_revision(self.user),
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(UserGame.objects.ranked().get().score, 10)
        response = self.client.post(
            "/rankings/board/move",
            {
                "id": "1",
                "tier": "U",
                "revision": ranking.current_revision(self.user),
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertFalse(UserGame.objects.ranked().exists())

    def test_feedback_deletion_permissions(self):
        row = Feedback.objects.create(user=self.other, title="Problem", description="Details")
        self.assertEqual(self.client.post(f"/feedback/{row.pk}/delete").status_code, 403)
        row.user = self.user
        row.status = "planned"
        row.save()
        self.assertEqual(self.client.post(f"/feedback/{row.pk}/delete").status_code, 403)

    def test_picker_filters_households_player_counts_time_and_tiers(self):
        UserGame.objects.create(user=self.other, game=self.games[0], owned=True)
        self.user.partner = self.other
        self.user.save()
        data = {
            "pick": "1",
            "players": [str(self.user.pk)],
            "max_time": 40,
            "tiers": list("SABCDF"),
        }
        response = self.client.get("/picker", data)
        self.assertEqual(response.context["chosen"].pk, 1)
        response = self.client.get("/picker", {**data, "max_time": 10})
        self.assertIsNone(response.context["chosen"])

    def test_chat_tools_compute_comparisons_with_three_rater_minimum(self):
        self.save([{"id": 1, "tier": "S"}])
        result = chat.data_tool(
            self.user, "compare_scores", {"compare_against": "bgg", "direction": "user_higher"}
        )
        self.assertEqual(result["games"][0]["difference"], 3)
        self.assertEqual(chat.data_tool(self.user, "get_community_rankings", {})["games"], [])
        for user in (self.other, self.admin):
            self.save([{"id": 1, "tier": "A"}], user=user)
        self.assertEqual(
            chat.data_tool(self.user, "get_community_rankings", {})["games"][0]["community"], 10
        )

    @override_settings(ANTHROPIC_API_KEY="test-only")
    @patch("hub.chat.run_agent", return_value=("The rule says yes.", [], []))
    def test_rulebook_content_and_deletion_invalidate_answer_cache(self, run):
        rule = Rulebook.objects.create(
            game=self.games[0], module_name="Base", content_md="Rule one"
        )
        chat.rules_answer(self.user, 1, "May I?", [])
        chat.rules_answer(self.user, 1, "May I?", [])
        self.assertEqual(run.call_count, 1)
        rule.content_md = "Rule two"
        rule.save()
        chat.rules_answer(self.user, 1, "May I?", [])
        self.assertEqual(run.call_count, 2)
        rule.delete()
        chat.rules_answer(self.user, 1, "May I?", [])
        self.assertEqual(run.call_count, 3)
        self.assertEqual(RulesAnswer.objects.count(), 3)

    @override_settings(SUPABASE_URL="https://auth.example", SUPABASE_ANON_KEY="public-key")
    @patch("hub.auth.httpx.post")
    def test_google_login_keeps_imported_identity_and_rejects_forged_callback(self, post):
        self.client.logout()
        self.assertEqual(self.client.get("/callback?code=fake&state=fake").status_code, 400)
        post.assert_not_called()
        self.client.post("/login/google")
        flow = self.client.session["oauth"]
        post.return_value = Mock(
            json=lambda: {
                "user": {
                    "id": str(self.user.pk),
                    "email": "alice@example.com",
                    "user_metadata": {"is_admin": True},
                }
            }
        )
        response = self.client.get("/callback", {"code": "valid", "state": flow["state"]})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(self.client.session["_auth_user_id"], str(self.user.pk))
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_staff)
        self.assertEqual(
            self.client.get("/callback", {"code": "valid", "state": flow["state"]}).status_code, 400
        )

    def test_personalization_escapes_html(self):
        self.user.display_name = '<script>alert("x")</script>'
        self.user.save()
        response = self.client.get("/furtch")
        self.assertNotContains(response, '<script>alert("x")</script>')
        self.assertContains(response, "&lt;script&gt;")

    def test_suggestions_and_computed_achievements_render(self):
        for user in (self.user, self.other, self.admin):
            self.save(
                [{"id": 1, "tier": "S"}, {"id": 2, "tier": "A"}, {"id": 3, "tier": "F"}], user=user
            )
            UserGame.objects.filter(user=user, game=self.games[0]).update(owned=True, wishlist=True)
        self.assertEqual(insights.suggestions(self.user)[0]["game"].pk, 4)
        awards = {award["title"] for award in insights.computed_achievements()}
        self.assertTrue(
            {"Most Liked", "Most Owned", "Most Wishlisted", "The People Pleaser"}.issubset(awards)
        )


@override_settings(**TEST_SETTINGS)
class ImportTests(TestCase):
    def snapshot(self):
        uid, partner = str(uuid.uuid4()), str(uuid.uuid4())
        data = {table: [] for table in TABLES}
        data["profiles"] = [
            {
                "id": uid,
                "display_name": "Imported",
                "avatar_url": None,
                "email": None,
                "is_admin": True,
                "partner_id": partner,
                "created_at": "2026-01-01T00:00:00Z",
                "updated_at": "2026-01-01T00:00:00Z",
            },
            {
                "id": partner,
                "display_name": "Partner",
                "partner_id": uid,
                "created_at": "2026-01-01T00:00:00Z",
            },
        ]
        data["board_games"] = [
            {"bgg_id": 42, "name": "Imported game", "category": "board", "description": None}
        ]
        data["tier_placements"] = [
            {
                "id": str(uuid.uuid4()),
                "user_id": uid,
                "bgg_id": 42,
                "tier": "S",
                "position": 0,
                "score": "10.0",
            }
        ]
        data["user_game_collection"] = [
            {
                "id": str(uuid.uuid4()),
                "user_id": uid,
                "bgg_id": 42,
                "owned": True,
                "wishlist": False,
                "wishlist_note": None,
                "added_at": "2026-01-02T00:00:00Z",
            }
        ]
        return data

    def run_import(self, data, apply=False):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / "snapshot.json"
            source.write_text(json.dumps(data))
            call_command("import_supabase", file=source, apply=apply, stdout=io.StringIO())

    def test_dry_run_preserves_database_and_apply_is_repeatable(self):
        data = self.snapshot()
        self.run_import(data)
        self.assertEqual(User.objects.count(), 0)
        self.run_import(data, True)
        self.run_import(data, True)
        self.assertEqual(User.objects.count(), 2)
        self.assertEqual(UserGame.objects.ranked().count(), 1)
        user = User.objects.get(pk=data["profiles"][0]["id"])
        self.assertTrue(user.is_staff)
        self.assertFalse(user.has_usable_password())
        self.assertEqual(user.partner.partner_id, user.pk)
        self.assertEqual(UserGame.objects.get().collection_added_at.day, 2)

    def test_bad_snapshot_rolls_back_every_table(self):
        data = self.snapshot()
        data["tier_placements"][0]["bgg_id"] = 999
        with self.assertRaises(CommandError):
            self.run_import(data, True)
        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(Game.objects.count(), 0)

    def test_every_legacy_table_and_nullable_relationship_imports(self):
        data = self.snapshot()
        uid = data["profiles"][0]["id"]
        achievement_id, expansion_id = str(uuid.uuid4()), str(uuid.uuid4())
        data["achievements"] = [
            {"id": achievement_id, "slug": "winner", "title": "Winner", "description": "Won a game"}
        ]
        data["user_achievements"] = [
            {
                "id": str(uuid.uuid4()),
                "user_id": uid,
                "achievement_id": achievement_id,
                "detail": None,
            }
        ]
        data["bounties"] = [
            {
                "id": str(uuid.uuid4()),
                "slug": "winner",
                "title": "Challenge",
                "description": "A challenge",
                "claimed_by": uid,
                "claimed_at": None,
            }
        ]
        data["game_ratings"] = [
            {"id": str(uuid.uuid4()), "user_id": uid, "bgg_id": 42, "rating": 8, "comment": None}
        ]
        data["game_expansions"] = [
            {
                "id": expansion_id,
                "game_bgg_id": 42,
                "name": "Extra",
                "thumbnail_url": None,
                "bgg_expansion_id": None,
            }
        ]
        data["expansion_tier_placements"] = [
            {
                "id": str(uuid.uuid4()),
                "expansion_id": expansion_id,
                "game_bgg_id": 42,
                "user_id": uid,
                "tier": "A",
                "position": 0,
                "score": 10,
            }
        ]
        data["feedback"] = [
            {
                "id": str(uuid.uuid4()),
                "user_id": uid,
                "title": "Please",
                "description": "An idea",
                "admin_note": None,
            }
        ]
        data["score_snapshots"] = [
            {
                "id": str(uuid.uuid4()),
                "user_id": None,
                "bgg_id": 42,
                "score": 8,
                "snapshot_at": "2026-01-02T00:00:00Z",
            }
        ]
        data["user_activity"] = [{"user_id": uid, "visit_count": 3, "total_seconds": 42}]
        data["game_rules"] = [
            {
                "id": str(uuid.uuid4()),
                "bgg_id": 42,
                "module_name": "Base",
                "content_md": "Rules",
                "created_by": uid,
                "source": None,
            }
        ]
        data["rules_answer_cache"] = [
            {
                "id": str(uuid.uuid4()),
                "bgg_id": 42,
                "modules_hash": "hash",
                "question_norm": "question",
                "answer_md": "answer",
                "citations": [],
            }
        ]
        data["rules_agent_runs"] = [
            {
                "id": str(uuid.uuid4()),
                "bgg_id": 42,
                "user_id": None,
                "question": "question",
                "answer_md": None,
                "citations": [],
                "tool_calls": [],
            }
        ]
        self.run_import(data, True)
        for table, model in TABLES.items():
            with self.subTest(table=table):
                if table == "score_snapshots":
                    self.assertEqual(
                        DailyScore.objects.count(), 3
                    )  # One old day plus today's two baselines.
                else:
                    self.assertEqual(model.objects.count(), len(data[table]))

    def test_unknown_or_missing_data_is_not_silently_dropped(self):
        data = self.snapshot()
        data["board_games"][0]["surprise_field"] = "retain me"
        with self.assertRaises(CommandError):
            self.run_import(data)
        data = self.snapshot()
        del data["score_snapshots"]
        with self.assertRaises(CommandError):
            self.run_import(data)


class ExternalClientTests(SimpleTestCase):
    def test_chat_returns_first_final_answer_without_duplicate_request(self):
        response = SimpleNamespace(
            content=[SimpleNamespace(type="text", text="Done", citations=[])],
            stop_reason="end_turn",
        )
        with patch("hub.chat.anthropic.Anthropic") as constructor:
            client = constructor.return_value
            client.messages.create.return_value = response
            answer, _, _ = chat.run_agent(
                "system", [{"role": "user", "content": "Hi"}], [], lambda *args: None
            )
            self.assertEqual(answer, "Done")
            self.assertEqual(client.messages.create.call_count, 1)

    @patch("hub.bgg.httpx.get")
    def test_bgg_queued_and_malformed_responses_are_actionable(self, get):
        from django.core.cache import cache

        cache.clear()
        get.return_value = httpx.Response(
            202, request=httpx.Request("GET", "https://boardgamegeek.com")
        )
        with self.assertRaises(bgg.BGGError):
            bgg.search("test")
        get.return_value = httpx.Response(
            200, text="bad xml", request=httpx.Request("GET", "https://boardgamegeek.com")
        )
        with self.assertRaises(bgg.BGGError):
            bgg.search("test")

    @patch("hub.bgg.fetch")
    def test_bgg_parser_keeps_extended_fields(self, fetch):
        from defusedxml import ElementTree

        fetch.return_value = ElementTree.fromstring("""<items><item id="1"><name type="primary" value="A &amp; B"/>
            <description>&lt;p&gt;Hello&lt;/p&gt;</description><minplayers value="2"/><maxplayers value="4"/>
            <link type="boardgamemechanic" value="Drafting"/><link type="boardgameexpansion" id="2" value="More"/>
            <statistics><ratings><average value="7.2"/><averageweight value="2.3"/></ratings></statistics>
            </item></items>""")
        result = bgg.details(1)
        self.assertEqual(result["name"], "A & B")
        self.assertEqual(result["description"], "Hello")
        self.assertEqual(result["mechanics"], ["Drafting"])
        self.assertEqual(result["expansions"], [{"id": 2, "name": "More"}])

    def test_reddit_reader_rejects_external_hosts(self):
        with patch("hub.chat.reddit") as request:
            with self.assertRaises(ValueError):
                chat.rules_tool(1, "reddit_read_thread", {"permalink": "http://127.0.0.1/secrets"})
            request.assert_not_called()
