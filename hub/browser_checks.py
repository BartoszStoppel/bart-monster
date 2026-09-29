"""Optional browser suite: uv run --with playwright manage.py test hub.browser_checks."""

import os
from unittest.mock import patch

from django.contrib.staticfiles.testing import StaticLiveServerTestCase
from django.test import override_settings
from playwright.sync_api import expect, sync_playwright

from . import ranking
from .models import DailyScore, Expansion, ExpansionPlacement, Game, User, UserGame
from .tests import TEST_SETTINGS


@override_settings(**TEST_SETTINGS)
class AutosaveBrowserChecks(StaticLiveServerTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # Playwright's synchronous driver runs an event loop on this test thread.
        # ORM calls remain sequential; scope this exception to the test process.
        orm_access = patch.dict(os.environ, {"DJANGO_ALLOW_ASYNC_UNSAFE": "true"})
        orm_access.start()
        cls.addClassCleanup(orm_access.stop)
        driver = sync_playwright().start()
        cls.addClassCleanup(driver.stop)
        cls.browser = driver.chromium.launch(
            executable_path=os.getenv("CHROMIUM_EXECUTABLE"), args=["--no-sandbox"]
        )
        cls.addClassCleanup(cls.browser.close)

    def setUp(self):
        self.user = User.objects.create_user(username="alice", password="local-test-password")
        self.games = [Game.objects.create(bgg_id=i, name=f"Game {i}") for i in range(1, 4)]
        self.context = self.browser.new_context(viewport={"width": 1280, "height": 1800})
        self.addCleanup(self.context.close)
        self.page = self.context.new_page()
        self.page.set_default_timeout(10000)
        self.errors = []
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        self.page.route("**/api/heartbeat", lambda route: route.fulfill(json={"ok": True}))
        self.login(self.page)
        self.assertFalse(self.errors)

    def login(self, page):
        page.goto(f"{self.live_server_url}/login?next=/tier-list")
        page.get_by_text("Sign in with a local account").click()
        page.locator('[name="username"]').fill("alice")
        page.locator('[name="password"]').fill("local-test-password")
        page.get_by_role("button", name="Sign in", exact=True).click()
        page.wait_for_url("**/tier-list")

    def move(self, pk, tier):
        tile = self.page.locator(f'.tier-tile[data-id="{pk}"]')
        self.page.locator(".tier-board").scroll_into_view_if_needed()
        tile.drag_to(
            self.page.locator(f'[data-tier="{tier}"] .tier-items'),
            source_position={"x": 50, "y": 5},
            target_position={"x": 10, "y": 10},
        )

    def saved(self):
        expect(self.page.locator(".tier-board")).to_have_attribute("data-save-state", "saved")
        self.assertFalse(self.errors)

    def test_collection_filters_are_selectable_and_preserved(self):
        Game.objects.filter(pk=3).update(category="party")
        UserGame.objects.create(user=self.user, game_id=1, owned=True)
        self.page.goto(self.live_server_url)
        self.page.locator('[name="category"]').select_option("board")
        self.page.locator('[name="filter"]').select_option("owned")
        self.page.get_by_role("button", name="Apply", exact=True).click()
        expect(self.page.locator('[name="category"]')).to_have_value("board")
        expect(self.page.locator('[name="filter"]')).to_have_value("owned")
        expect(self.page.locator(".game-card h3")).to_have_text(["Game 1"])
        self.assertFalse(self.errors)

    @override_settings(ANTHROPIC_API_KEY="test-only")
    def test_long_chat_discards_old_exchanges_without_rejecting_new_messages(self):
        requests = []

        def reply(route):
            requests.append(route.request.post_data_json["messages"])
            route.fulfill(json={"answer": "A" * 12000, "citations": []})

        self.page.route("**/api/chat", reply)
        self.page.goto(f"{self.live_server_url}/chat")
        for i in range(6):
            self.page.locator("#chat-input").fill(str(i) + "Q" * 7999)
            self.page.get_by_role("button", name="Send", exact=True).click()
            expect(self.page.locator(".chat-message.assistant")).to_have_count(i + 1)
        for messages in requests:
            self.assertLessEqual(sum(len(m["content"]) for m in messages), 60000)
            self.assertEqual(
                [m["role"] for m in messages],
                ["user" if i % 2 == 0 else "assistant" for i in range(len(messages))],
            )
        self.assertTrue(requests[-1][-1]["content"].startswith("5"))
        self.assertFalse(self.errors)

    def test_drag_saves_without_button_or_reload_and_updates_scores(self):
        self.page.evaluate("window.autosavePageMarker = 'same page'")
        expect(self.page.get_by_role("button", name="Save ranking")).to_have_count(0)
        self.move(1, "S")
        self.saved()
        self.move(2, "A")
        self.saved()
        self.assertEqual(self.page.evaluate("window.autosavePageMarker"), "same page")
        expect(self.page.locator('[data-id="1"] .tier-score')).to_have_text("10.0")
        expect(self.page.locator('[data-id="2"] .tier-score')).to_have_text("1.0")
        self.assertEqual(UserGame.objects.ranked().get(user=self.user, game_id=2).score, 1)
        self.page.reload()
        expect(self.page.locator('[data-tier="A"] [data-id="2"]')).to_have_count(1)

    def test_fast_moves_queue_in_order_and_update_one_daily_score(self):
        requests, held = [], []

        def intercept(route):
            requests.append(route.request.post_data_json)
            if len(requests) == 1:
                held.append(route)
            else:
                route.continue_()

        self.page.route("**/api/rankings/board", intercept)
        self.move(1, "S")
        expect(self.page.locator(".save-status")).to_have_text("Saving…")
        self.move(2, "A")
        self.move(1, "F")
        self.move(2, "U")
        self.assertEqual(len(requests), 1)
        held[0].continue_()
        self.saved()
        self.assertEqual(len(requests), 4)
        self.assertEqual(len({request["revision"] for request in requests}), 4)
        self.assertEqual(
            list(
                DailyScore.objects.filter(user=self.user, game_id=1)
                .order_by("day")
                .values_list("score", flat=True)
            ),
            [10],
        )
        self.assertEqual(
            list(
                DailyScore.objects.filter(user=self.user, game_id=2)
                .order_by("day")
                .values_list("score", flat=True)
            ),
            [None],
        )
        expect(self.page.locator('[data-id="2"] .tier-score')).to_be_hidden()

    def test_failures_retry_even_if_the_server_saved_but_the_response_was_lost(self):
        attempts = []

        def intercept(route):
            attempts.append(route.request.post_data_json)
            if len(attempts) == 1:
                route.fulfill(status=503, json={"error": "Temporarily unavailable"})
            elif len(attempts) == 2:
                self.assertEqual(route.fetch().status, 200)
                route.abort("failed")
            else:
                route.continue_()

        self.page.route("**/api/rankings/board", intercept)
        self.move(1, "S")
        expect(self.page.locator(".save-status")).to_contain_text("Retrying automatically")
        self.saved()
        self.assertEqual(len(attempts), 3)
        self.assertEqual(attempts[0], attempts[2])
        self.assertEqual(DailyScore.objects.filter(game_id=1).count(), 2)
        self.assertEqual(UserGame.objects.ranked().get(user=self.user).game_id, 1)

    def test_conflict_stops_autosaving_and_preserves_the_other_edit(self):
        ranking.save_ranking(
            self.user, [{"id": 3, "tier": "S"}], ranking.current_revision(self.user)
        )
        self.move(1, "S")
        expect(self.page.locator(".tier-board")).to_have_attribute("data-save-state", "error")
        expect(self.page.locator(".save-status")).to_contain_text("another tab")
        expect(self.page.locator(".reload-ranking")).to_be_visible()
        self.assertEqual(UserGame.objects.ranked().get(user=self.user).game_id, 3)
        self.assertEqual(DailyScore.objects.count(), 2)

    def test_expansion_and_keyboard_moves_autosave(self):
        expansion = Expansion.objects.create(game=self.games[0], name="Expansion")
        self.page.goto(f"{self.live_server_url}/games/1")
        tile = self.page.locator(f'[data-id="{expansion.pk}"]')
        tile.locator("summary").click()
        tile.locator('[name="tier"]').select_option("B")
        tile.get_by_role("button", name="Move", exact=True).click()
        self.saved()
        self.assertEqual(ExpansionPlacement.objects.get(expansion=expansion).tier, "B")
        self.move(expansion.pk, "U")
        self.saved()
        self.assertFalse(ExpansionPlacement.objects.exists())
        self.assertFalse(DailyScore.objects.exists())

    def test_move_forms_still_work_without_javascript(self):
        context = self.browser.new_context(java_script_enabled=False)
        self.addCleanup(context.close)
        page = context.new_page()
        self.login(page)
        tile = page.locator('[data-id="1"]')
        tile.locator("summary").click()
        tile.locator('[name="tier"]').select_option("S")
        tile.get_by_role("button", name="Move", exact=True).click()
        expect(page.locator('[data-tier="S"] [data-id="1"]')).to_have_count(1)
        self.assertEqual(UserGame.objects.ranked().get(user=self.user).score, 10)

    def test_difficulty_autosave_cross_mode_banks_and_mobile_charts(self):
        self.move(1, "S")
        self.saved()
        self.page.get_by_role("link", name="Difficulty", exact=True).click()
        expect(self.page.locator('[data-tier="U"] [data-id="1"]')).to_have_count(1)
        self.move(1, "1")
        self.saved()
        self.move(2, "6")
        self.saved()
        expect(self.page.locator('[data-id="1"] .tier-score')).to_have_text("1.0")
        self.page.get_by_role("link", name="Enjoyment", exact=True).click()
        expect(self.page.locator('[data-tier="S"] [data-id="1"]')).to_have_count(1)
        expect(self.page.locator('[data-tier="U"] [data-id="2"]')).to_have_count(1)
        self.page.set_viewport_size({"width": 390, "height": 844})
        self.page.goto(f"{self.live_server_url}/tier-list?metric=difficulty")
        expect(self.page.get_by_role("heading", name="Cuddly", exact=False)).to_be_visible()
        self.assertLessEqual(self.page.evaluate("document.documentElement.scrollWidth"), 390)
        self.page.goto(f"{self.live_server_url}/community?metric=difficulty")
        self.page.get_by_role("link", name="Party games", exact=True).click()
        self.assertIn("metric=difficulty", self.page.url)
        self.page.go_back()
        self.page.goto(f"{self.live_server_url}/statistics?metric=difficulty")
        expect(self.page.locator("#complexity-chart svg circle")).to_have_count(2)
        expect(self.page.locator(".history-chart svg circle")).to_have_count(1)
        self.assertFalse(self.errors)

    def test_difficulty_retry_and_no_javascript_move(self):
        self.page.goto(f"{self.live_server_url}/tier-list?metric=difficulty")
        attempts = []

        def intercept(route):
            attempts.append(route.request.post_data_json)
            if len(attempts) == 1:
                self.assertEqual(route.fetch().status, 200)
                route.abort("failed")
            else:
                route.continue_()

        self.page.route("**/api/rankings/difficulty/board", intercept)
        self.move(1, "3")
        self.saved()
        self.assertEqual(len(attempts), 2)
        self.assertEqual(DailyScore.objects.filter(metric="difficulty").count(), 2)
        context = self.browser.new_context(java_script_enabled=False)
        self.addCleanup(context.close)
        page = context.new_page()
        self.login(page)
        page.goto(f"{self.live_server_url}/tier-list?metric=difficulty")
        tile = page.locator('[data-id="1"]')
        tile.locator("summary").click()
        tile.locator('[name="tier"]').select_option("2")
        tile.get_by_role("button", name="Move", exact=True).click()
        expect(page.locator('[data-tier="2"] [data-id="1"]')).to_have_count(1)
        self.assertEqual(UserGame.objects.get(game_id=1).difficulty_tier, 2)
