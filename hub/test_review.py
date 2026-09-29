"""Regressions from the complete-site logic review."""

from datetime import timedelta
from unittest.mock import patch

from django.contrib.admin.sites import AdminSite
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from . import chat, insights, ranking
from .admin import HubUserAdmin
from .models import DailyScore, Expansion, Game, Rulebook, User, UserGame
from .tests import TEST_SETTINGS


@override_settings(**TEST_SETTINGS)
class SiteReviewTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alice = User.objects.create_user(username="alice", display_name="Alice")
        cls.bob = User.objects.create_user(username="bob", display_name="Bob")
        cls.carol = User.objects.create_user(username="carol", display_name="Carol")
        cls.games = [Game.objects.create(bgg_id=i, name=f"Game {i}") for i in range(1, 5)]

    def setUp(self):
        self.client.force_login(self.alice)

    def save(self, user, entries, metric="enjoyment"):
        return ranking.save_ranking(
            user, entries, ranking.current_revision(user, metric=metric), metric=metric
        )

    def test_household_membership_is_symmetric_and_independent_of_name_order(self):
        self.alice.partner = self.bob
        self.alice.save()
        users = [self.alice, self.bob, self.carol]
        self.assertEqual(insights.households(users), insights.households(users[::-1]))
        self.assertEqual(set(self.alice.household_ids), {self.alice.pk, self.bob.pk})
        self.assertEqual(self.alice.household_ids, self.bob.household_ids)
        UserGame.objects.create(user=self.alice, game=self.games[0], owned=True)
        self.client.force_login(self.bob)
        self.assertEqual([g.pk for g in self.client.get("/?filter=owned").context["games"]], [1])
        self.assertEqual([p["game"].pk for p in self.client.get("/picker").context["pool"]], [1])

    def test_connected_partner_links_and_self_links_have_one_membership(self):
        self.alice.partner = self.bob
        self.alice.save()
        self.bob.partner = self.carol
        self.bob.save()
        self.carol.partner = self.carol
        self.carol.save()
        expected = {self.alice.pk, self.bob.pk, self.carol.pk}
        for user in (self.alice, self.bob, self.carol):
            self.assertEqual(set(user.household_ids), expected)

    def test_shelf_of_shame_counts_household_games_once_and_partner_rankings_count(self):
        self.alice.partner = self.bob
        self.alice.save()
        for user in (self.alice, self.bob):
            for game in self.games[:2]:
                UserGame.objects.create(user=user, game=game, owned=True)
        self.save(self.bob, [{"id": 1, "tier": "S"}])
        awards = {award["title"]: award for award in insights.computed_achievements()}
        self.assertEqual(awards["Shelf of Shame"]["holders"][0]["detail"], "1 unranked games")

    def test_picker_tiers_and_weights_only_use_attending_players(self):
        for game in self.games[:2]:
            UserGame.objects.create(user=self.alice, game=game, owned=True)
        self.save(self.alice, [{"id": 1, "tier": "F"}, {"id": 2, "tier": "F"}])
        self.save(self.bob, [{"id": 1, "tier": "S"}, {"id": 2, "tier": "S"}])
        params = {"pick": 1, "players": [str(self.alice.pk)], "tiers": ["S"]}
        self.assertEqual(self.client.get("/picker", params).context["pool"], [])
        params["players"] = [str(self.carol.pk)]
        self.assertEqual(len(self.client.get("/picker", params).context["pool"]), 2)
        params.update(players=[], mode="player-ranked")
        response = self.client.get("/picker", params)
        self.assertEqual([p["chance"] for p in response.context["pool"]], [50, 50])

    def test_identical_rankings_do_not_write_or_change_timestamps(self):
        for metric, tier in (("enjoyment", "S"), ("difficulty", "3")):
            with self.subTest(metric=metric):
                entries = [{"id": 1, "tier": tier}]
                current = self.save(self.alice, entries, metric)
                for revision in (current, "lost response"):
                    with CaptureQueriesContext(connection) as queries:
                        result = ranking.save_ranking(self.alice, entries, revision, metric=metric)
                    self.assertEqual(result, current)
                    writes = [
                        q["sql"]
                        for q in queries
                        if q["sql"].split()[0] in ("INSERT", "UPDATE", "DELETE")
                    ]
                    self.assertEqual(writes, [])

    def test_shared_score_queries_preserve_thresholds_across_pages_and_joins(self):
        for user, order, level in (
            (self.alice, [1, 2], "1"),
            (self.bob, [2, 1], "3"),
            (self.carol, [1], "6"),
        ):
            self.save(user, [{"id": gid, "tier": "S"} for gid in order])
            self.save(user, [{"id": 1, "tier": level}], "difficulty")
        UserGame.objects.create(user=self.carol, game_id=2, rating=9, owned=True)
        for name in ("First expansion", "Second expansion"):
            Expansion.objects.create(game_id=1, name=name)
        joined = (
            Game.objects.with_enjoyment()
            .with_difficulty()
            .filter(rankable_expansions__isnull=False)
        )
        self.assertEqual(
            list(joined.values_list("community_score", "rankers", "difficulty_votes")),
            [(7, 3, 3), (7, 3, 3)],
        )
        games = {g.pk: g for g in Game.objects.with_enjoyment().with_difficulty()}
        self.assertEqual(
            (games[2].community_score, games[2].rankers, games[2].difficulty), (None, 2, None)
        )
        self.assertEqual(
            (games[3].community_score, games[3].rankers, games[3].difficulty_votes), (None, 0, 0)
        )
        collection = {g.pk: g.community_score for g in self.client.get("/").context["games"]}
        statistics = {
            g["id"]: g["community"] for g in self.client.get("/statistics").context["charts"]
        }
        assistant = {
            g["bgg_id"]: g["community"]
            for g in chat.data_tool(self.alice, "get_collection", {})["games"]
        }
        self.assertEqual(collection, statistics)
        self.assertEqual(collection, assistant)
        self.assertAlmostEqual(games[1].difficulty, 10 / 3)

    @patch(
        "hub.insights.alignments", side_effect=AssertionError("Stats do not need taste comparisons")
    )
    def test_statistics_only_builds_chart_data(self, _alignments):
        self.save(self.alice, [{"id": 1, "tier": "S"}])
        self.save(self.bob, [{"id": 2, "tier": "1"}], "difficulty")
        for metric in ("enjoyment", "difficulty"):
            response = self.client.get("/statistics", {"metric": metric})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.context["ranked_count"], 1)
            self.assertEqual(response.context["ranker_count"], 1)

    def test_inactive_players_do_not_displace_visible_taste_matches(self):
        for user, order in (
            (self.alice, [1, 2, 3, 4]),
            (self.bob, [4, 3, 2, 1]),
            (self.carol, [3, 2, 1, 4]),
        ):
            self.save(user, [{"id": gid, "tier": "S"} for gid in order])
        for i in range(3):
            inactive = User.objects.create_user(username=f"inactive-{i}", is_active=False)
            self.save(inactive, [{"id": gid, "tier": "S"} for gid in [1, 2, 3, 4]])
        row = next(
            row for row in insights.community_data("board")["rows"] if row["user"] == self.alice
        )
        self.assertEqual(
            {match["user"].pk for match in row["allies"]}, {self.bob.pk, self.carol.pk}
        )

    def test_deleting_players_updates_both_community_histories_without_changing_yesterday(self):
        yesterday = timezone.localdate() - timedelta(days=1)
        for user, entries, level in (
            (self.alice, [{"id": 1, "tier": "S"}], "6"),
            (self.bob, [{"id": 2, "tier": "S"}, {"id": 1, "tier": "F"}], "2"),
        ):
            self.save(user, entries)
            self.save(user, [{"id": 1, "tier": level}], "difficulty")
        for metric, score in (("enjoyment", 5.5), ("difficulty", 4)):
            DailyScore.objects.create(metric=metric, game_id=1, day=yesterday, score=score)
        admin = HubUserAdmin(User, AdminSite())
        admin.delete_model(None, self.alice)
        for metric, current, previous in (("enjoyment", 1, 5.5), ("difficulty", 2, 4)):
            rows = DailyScore.objects.filter(game_id=1, user=None, metric=metric)
            self.assertEqual(rows.get(day=timezone.localdate()).score, current)
            self.assertEqual(rows.get(day=yesterday).score, previous)
        admin.delete_queryset(None, User.objects.filter(pk=self.bob.pk))
        self.assertEqual(
            list(
                DailyScore.objects.filter(
                    game_id=1, user=None, day=timezone.localdate()
                ).values_list("score", flat=True)
            ),
            [None, None],
        )

    @patch("hub.chat.run_agent", return_value=("The rule says yes.", [], []))
    def test_rules_cache_ignores_expansion_order_but_distinguishes_the_selection(self, run):
        Rulebook.objects.create(game=self.games[0], module_name="Base", content_md="Base rules")
        Rulebook.objects.create(
            game=self.games[0],
            module_name="Extra",
            module_type="expansion",
            content_md="Extra rules",
        )
        chat.rules_answer(self.alice, 1, "May I?", ["Extra", "Missing"])
        chat.rules_answer(self.alice, 1, "May I?", [" missing ", "EXTRA", "Extra"])
        self.assertEqual(run.call_count, 1)
        chat.rules_answer(self.alice, 1, "May I?", [])
        self.assertEqual(run.call_count, 2)
        with self.assertRaises(ValueError):
            chat.rules_answer(self.alice, 1, "May I?", "Extra")
