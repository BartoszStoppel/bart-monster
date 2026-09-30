"""Same-page navigation regression; uses a disposable local authenticated fixture.

uv run --no-project --with playwright python web/tests/browser_navigation.py \
  --base-url http://127.0.0.1:5173 --fixture backups/interaction-audit/local-test.json

All non-read API requests are intercepted; the fixture database is not mutated.
"""
import argparse
import asyncio
import json
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright, expect


async def check(base, fixture):
    if urlparse(base).hostname not in {"localhost", "127.0.0.1"}:
        raise ValueError("This regression check requires a local disposable application")
    config = json.loads(Path(fixture).read_text())
    requests = []
    errors = []
    release = asyncio.Event()
    delayed = asyncio.Event()
    hold_bootstrap = False
    fresh_profile = False
    target_game = None
    collection_flags = None
    expansion_bank = None
    expansion_revision = "navigation-fixture-revision"

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(args=["--no-sandbox"])
        context = await browser.new_context(
            viewport={"width": 1280, "height": 1000},
            color_scheme="dark", reduced_motion="no-preference",
        )
        await context.add_cookies([
            {"name": "bart_session", "value": config["session"], "url": base,
             "httpOnly": True}
        ])
        page = await context.new_page()
        page.set_default_timeout(15000)
        page.on("pageerror", lambda error: errors.append(str(error)))

        async def api(route):
            request = route.request
            path = urlparse(request.url).path
            if request.method not in {"GET", "HEAD"}:
                await route.fulfill(status=200, json={})
                return
            requests.append(path)
            if path == "/api/bootstrap":
                if hold_bootstrap:
                    delayed.set()
                    await release.wait()
                response = await route.fetch()
                data = await response.json()
                if fresh_profile:
                    for profile in data["tables"]["profiles"]:
                        profile["display_name"] = "Fresh navigation profile"
                if target_game is not None:
                    for game in data["tables"]["board_games"]:
                        if game["bgg_id"] == target_game:
                            game["name"] = "Fresh navigation game"
                    if collection_flags is not None:
                        rows = data["tables"]["user_game_collection"]
                        data["tables"]["user_game_collection"] = [
                            row for row in rows if row["bgg_id"] != target_game
                        ] + [{
                            "user_id": config["user_id"], "bgg_id": target_game,
                            "owned": collection_flags[0], "wishlist": collection_flags[1],
                            "wishlist_priority": 1, "wishlist_note": "Fresh wishlist note",
                        }]
                    if expansion_bank is not None:
                        data["tables"]["game_expansions"] = [
                            row for row in data["tables"]["game_expansions"]
                            if row["game_bgg_id"] != target_game
                        ] + expansion_bank
                await route.fulfill(response=response, json=data)
            elif path == f"/api/expansion-rankings/{target_game}" and expansion_bank is not None:
                await route.fulfill(status=200, json={
                    "revision": expansion_revision, "placements": [],
                })
            else:
                await route.continue_()

        await page.route("**/api/**", api)
        await page.goto(base + "/community?category=board")
        await expect(page.get_by_role("heading", name="Community", exact=True)).to_be_visible()
        await page.wait_for_function('document.querySelector("main [aria-busy]")?.getAttribute("aria-busy") === "false"')
        await page.evaluate('''() => {
            const button = [...document.querySelectorAll('main button')].find(e => e.textContent === 'Party Games');
            window.audit = {button, pill: button.parentElement.querySelector('[style]'), heading: document.querySelector('main h1'), transitions: [], animations: []};
            document.addEventListener('transitionrun', e => {if(e.target === audit.pill) audit.transitions.push(e.propertyName)});
            document.addEventListener('animationstart', e => audit.animations.push(e.animationName));
        }''')
        hold_bootstrap = True
        category_button = page.get_by_role("button", name="Party Games", exact=True)
        await category_button.focus()
        await category_button.press("Enter")
        await asyncio.wait_for(delayed.wait(), 10)
        assert await page.evaluate('audit.button.isConnected && audit.pill.isConnected && audit.heading.isConnected')
        assert await page.locator("main [inert]").count() == 1, "stale query controls remained interactive"
        release.set()
        await page.wait_for_function('document.querySelector("main [aria-busy]")?.getAttribute("aria-busy") === "false"')
        await page.wait_for_timeout(250)
        assert await page.evaluate('audit.button.isConnected && audit.pill.isConnected'), "category query remounted controls"
        assert await page.evaluate('audit.transitions.includes("left")'), "category selection did not animate between positions"
        await expect(category_button).to_be_focused()

        # A refresh supplies visibly new server data while preserving the page DOM.
        hold_bootstrap = False
        fresh_profile = True
        before = requests.count("/api/bootstrap")
        await page.evaluate('audit.animations = []; window.dispatchEvent(new Event("bart:refresh"))')
        await expect(page.get_by_text("Fresh navigation profile", exact=True).first).to_be_visible()
        assert requests.count("/api/bootstrap") > before, "refresh reused stale bootstrap data"
        assert await page.evaluate('audit.button.isConnected && audit.heading.isConnected'), "refresh remounted the page"
        assert not await page.evaluate('audit.animations.includes("fade-in")'), "refresh replayed page entry animation"

        # The same cancelable event used by pending autosaves must block refresh
        # and query navigation before requests or URL changes occur.
        await page.evaluate('window.blockNavigation = e => e.preventDefault(); window.addEventListener("bart:navigate", blockNavigation)')
        before = len(requests)
        previous_url = page.url
        await page.evaluate('window.dispatchEvent(new Event("bart:refresh"))')
        await page.get_by_role("button", name="Board Games", exact=True).click()
        await page.wait_for_timeout(200)
        assert len(requests) == before and page.url == previous_url, "pending-save guard was bypassed"
        await page.evaluate('window.removeEventListener("bart:navigate", blockNavigation)')

        # Metric data still changes scope and resets the stateful ranking board.
        fresh_profile = False
        await page.goto(base + "/tier-list?category=board&metric=enjoyment")
        await expect(page.get_by_role("heading", name="Tier List", exact=True)).to_be_visible()
        tiles = page.locator('[aria-roledescription="sortable"]')
        await expect(tiles.first).to_be_visible()
        original_tile = await tiles.first.element_handle()
        await tiles.first.click()
        await expect(tiles.first).to_have_attribute("aria-pressed", "true")
        await page.get_by_role("link", name="Difficulty", exact=True).click()
        await page.wait_for_function('document.querySelector("main [aria-busy]")?.getAttribute("aria-busy") === "false"')
        assert "/api/rankings/difficulty/board" in requests
        assert not await original_tile.evaluate('(el) => el.isConnected'), "metric change retained the old ranking scope"
        assert await page.locator('[aria-roledescription="sortable"][aria-pressed="true"]').count() == 0
        await expect(page.get_by_text("Tame", exact=True)).to_be_visible()

        # Response-only changes model updates from another page/tab. Collection
        # props must refresh without losing its current sort/filter controls.
        await page.goto(base + "/")
        cards = page.locator("main .glass-card").filter(has=page.locator('a[href^="/games/"]'))
        await expect(cards.first).to_be_visible()
        href = await cards.first.locator('a[href^="/games/"]').first.get_attribute("href")
        target_game = int(href.rsplit("/", 1)[1])
        card = page.locator("main .glass-card").filter(has=page.locator(f'a[href="{href}"]'))
        original_card = await card.element_handle()
        name_sort = page.get_by_role("button", name="Name", exact=True)
        await name_sort.click()
        original_sort = await name_sort.element_handle()
        collection_flags = (True, False)
        await page.evaluate('window.dispatchEvent(new Event("bart:refresh"))')
        await expect(card.get_by_text("Fresh navigation game", exact=True)).to_be_visible()
        await expect(card.locator('[title="You own this"]')).to_have_count(1)
        assert await original_card.evaluate('(el) => el.isConnected')
        assert await original_sort.evaluate('(el) => el.isConnected')
        assert "dark:text-zinc-50" in await name_sort.get_attribute("class")
        collection_flags = (False, True)
        await page.evaluate('window.dispatchEvent(new Event("bart:refresh"))')
        await expect(card.locator('[title="On your wishlist"]')).to_have_count(1)
        await expect(card.locator('[title="You own this"]')).to_have_count(0)

        await page.goto(base + "/wishlist")
        await expect(page.get_by_text("Fresh wishlist note", exact=True)).to_be_visible()
        wishlist_sort = page.get_by_role("button", name="Name", exact=True)
        await wishlist_sort.click()
        original_wishlist_sort = await wishlist_sort.element_handle()
        collection_flags = (True, False)
        await page.evaluate('window.dispatchEvent(new Event("bart:refresh"))')
        await expect(page.get_by_text("Fresh wishlist note", exact=True)).to_have_count(0)
        assert await original_wishlist_sort.evaluate('(el) => el.isConnected')
        assert "dark:text-zinc-50" in await wishlist_sort.get_attribute("class")

        # New/deleted expansion IDs reset only the ranking board; a revision
        # change must also reset its retained selection and save revision.
        expansion_bank = [{
            "id": "00000000-0000-4000-8000-000000000001", "game_bgg_id": target_game,
            "name": "Navigation expansion one", "thumbnail_url": None,
            "created_at": "2026-01-01T00:00:00Z", "bgg_expansion_id": None,
        }]
        await page.goto(base + href)
        expansion_tiles = page.locator('[aria-roledescription="sortable"]')
        await expect(expansion_tiles).to_have_count(1)
        first_expansion = await expansion_tiles.first.element_handle()
        expansion_bank = expansion_bank + [{
            **expansion_bank[0], "id": "00000000-0000-4000-8000-000000000002",
            "name": "Navigation expansion two",
        }]
        await page.evaluate('window.dispatchEvent(new Event("bart:refresh"))')
        await expect(expansion_tiles).to_have_count(2)
        assert not await first_expansion.evaluate('(el) => el.isConnected')
        expansion_bank = expansion_bank[1:]
        await page.evaluate('window.dispatchEvent(new Event("bart:refresh"))')
        await expect(expansion_tiles).to_have_count(1)
        await expect(expansion_tiles.first).to_have_attribute("title", "Navigation expansion two")
        await expansion_tiles.first.click()
        await expect(expansion_tiles.first).to_have_attribute("aria-pressed", "true")
        old_revision_tile = await expansion_tiles.first.element_handle()
        expansion_revision += "-updated"
        await page.evaluate('window.dispatchEvent(new Event("bart:refresh"))')
        await expect(expansion_tiles.first).to_have_attribute("aria-pressed", "false")
        assert not await old_revision_tile.evaluate('(el) => el.isConnected')

        # Form drafts are intentionally local state, unlike server-owned lists.
        await page.goto(base + "/profile")
        display_name = page.get_by_label("Display Name", exact=True)
        await display_name.fill("Unsaved navigation draft")
        fresh_profile = True
        await page.evaluate('window.dispatchEvent(new Event("bart:refresh"))')
        await page.wait_for_function('document.querySelector("main [aria-busy]")?.getAttribute("aria-busy") === "false"')
        await expect(display_name).to_have_value("Unsaved navigation draft")
        await expect(display_name).to_be_focused()
        assert not errors, errors
        print(json.dumps({"result": "PASS", "checks": [
            "same-page category DOM identity and animated pill",
            "pending scope controls inert and keyboard focus restored", "fresh-data refresh preserves DOM",
            "refresh does not replay entry animation", "autosave guard blocks query and refresh",
            "metric change fetches new scope and resets ranking board",
            "collection and wishlist props refresh without losing sort state",
            "expansion additions/deletions and revision changes reset ranking scope",
            "profile draft and focus survive unrelated refresh",
        ]}))
        await browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--fixture", required=True)
    args = parser.parse_args()
    asyncio.run(check(args.base_url.rstrip("/"), args.fixture))
