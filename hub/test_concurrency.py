from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless

from django.contrib.admin.sites import AdminSite
from django.db import close_old_connections, connection
from django.test import Client, TransactionTestCase, override_settings

from .admin import HubUserAdmin
from .models import DailyScore, Game, User, UserGame
from .ranking import StaleRanking, current_revision, save_ranking
from .tests import TEST_SETTINGS


@skipUnless(connection.vendor == "postgresql", "Row-lock behavior requires PostgreSQL")
@override_settings(**TEST_SETTINGS)
class RankingConcurrencyTests(TransactionTestCase):
    def test_player_deletion_and_another_players_vote_keep_current_history(self):
        removed = User.objects.create_user(username="removed")
        voter = User.objects.create_user(username="voter")
        Game.objects.create(bgg_id=1, name="Shared")
        save_ranking(
            removed,
            [{"id": 1, "tier": "6"}],
            current_revision(removed, metric="difficulty"),
            metric="difficulty",
        )
        barrier = Barrier(2)

        def change(action):
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                if action == "delete":
                    HubUserAdmin(User, AdminSite()).delete_queryset(
                        None, User.objects.filter(pk=removed.pk)
                    )
                else:
                    save_ranking(
                        voter,
                        [{"id": 1, "tier": "2"}],
                        current_revision(voter, metric="difficulty"),
                        metric="difficulty",
                    )
            finally:
                connection.close()

        with ThreadPoolExecutor(max_workers=2) as executor:
            list(executor.map(change, ["delete", "vote"]))
        self.assertEqual(DailyScore.objects.get(metric="difficulty", user=None).score, 2)
        self.assertEqual(UserGame.objects.get().difficulty_tier, 2)

    def test_collection_and_ranking_saves_preserve_both_states(self):
        user = User.objects.create_user(username="combined")
        Game.objects.create(bgg_id=1, name="Combined")
        barrier = Barrier(2)

        def save(kind):
            close_old_connections()
            try:
                local_user = User.objects.get(pk=user.pk)
                client = Client()
                client.force_login(local_user)
                barrier.wait(timeout=10)
                if kind == "ranking":
                    save_ranking(local_user, [{"id": 1, "tier": "S"}], current_revision(user))
                else:
                    self.assertEqual(
                        client.post("/games/1/collection", {"owned": "on"}).status_code, 302
                    )
            finally:
                connection.close()

        with ThreadPoolExecutor(max_workers=2) as executor:
            list(executor.map(save, ["ranking", "collection"]))
        row = UserGame.objects.get()
        self.assertEqual((row.owned, row.tier, row.score), (True, "S", 10))

    def test_simultaneous_saves_accept_only_one_revision(self):
        user = User.objects.create_user(username="concurrent", display_name="Concurrent")
        Game.objects.create(bgg_id=1, name="First")
        Game.objects.create(bgg_id=2, name="Second")
        barrier = Barrier(2)
        initial = current_revision(user)

        def save(game_id):
            close_old_connections()
            try:
                local_user = User.objects.get(pk=user.pk)
                barrier.wait(timeout=10)
                try:
                    save_ranking(local_user, [{"id": game_id, "tier": "S"}], initial)
                    return "saved"
                except StaleRanking:
                    return "conflict"
            finally:
                connection.close()

        with ThreadPoolExecutor(max_workers=2) as executor:
            outcomes = list(executor.map(save, [1, 2]))
        self.assertEqual(sorted(outcomes), ["conflict", "saved"])
        self.assertEqual(UserGame.objects.ranked().count(), 1)
        self.assertEqual(UserGame.objects.ranked().get().score, 10)

    def test_different_users_leave_a_current_community_snapshot(self):
        users = [User.objects.create_user(username=f"player-{i}") for i in range(2)]
        for game_id in [1, 2]:
            Game.objects.create(bgg_id=game_id, name=f"Game {game_id}")
        barrier = Barrier(2)

        def save(index):
            close_old_connections()
            try:
                user = User.objects.get(pk=users[index].pk)
                entries = [
                    {"id": game_id, "tier": "S"} for game_id in ([1, 2] if index == 0 else [2, 1])
                ]
                barrier.wait(timeout=10)
                save_ranking(user, entries, current_revision(user))
            finally:
                connection.close()

        with ThreadPoolExecutor(max_workers=2) as executor:
            list(executor.map(save, [0, 1]))
        for game_id in [1, 2]:
            snapshot = DailyScore.objects.filter(game_id=game_id, user=None).latest("day")
            self.assertEqual(snapshot.score, 5.5)

    def test_concurrent_metrics_preserve_both_placements(self):
        user = User.objects.create_user(username="both-metrics")
        Game.objects.create(bgg_id=1, name="Both")
        initial = {
            metric: current_revision(user, metric=metric) for metric in ["enjoyment", "difficulty"]
        }
        barrier = Barrier(2)

        def save(metric):
            close_old_connections()
            try:
                local_user = User.objects.get(pk=user.pk)
                barrier.wait(timeout=10)
                save_ranking(
                    local_user,
                    [{"id": 1, "tier": "2" if metric == "difficulty" else "S"}],
                    initial[metric],
                    metric=metric,
                )
            finally:
                connection.close()

        with ThreadPoolExecutor(max_workers=2) as executor:
            list(executor.map(save, ["enjoyment", "difficulty"]))
        row = UserGame.objects.get()
        self.assertEqual((row.tier, row.score, row.difficulty_tier), ("S", 10, 2))
        self.assertEqual(DailyScore.objects.count(), 4)

    def test_concurrent_difficulty_votes_average_each_player_once(self):
        users = [User.objects.create_user(username=f"difficulty-{i}") for i in range(2)]
        Game.objects.create(bgg_id=1, name="Difficulty")
        initial = [current_revision(user, metric="difficulty") for user in users]
        barrier = Barrier(2)

        def save(index):
            close_old_connections()
            try:
                user = User.objects.get(pk=users[index].pk)
                barrier.wait(timeout=10)
                save_ranking(
                    user,
                    [{"id": 1, "tier": "2" if index == 0 else "6"}],
                    initial[index],
                    metric="difficulty",
                )
            finally:
                connection.close()

        with ThreadPoolExecutor(max_workers=2) as executor:
            list(executor.map(save, [0, 1]))
        self.assertEqual(DailyScore.objects.get(metric="difficulty", user=None).score, 4)
        self.assertEqual(DailyScore.objects.count(), 3)
