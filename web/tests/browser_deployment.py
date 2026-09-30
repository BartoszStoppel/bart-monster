"""Exercise real built route imports across deployments, without a backend.

bun run --cwd web build
uv run --no-project --with playwright python web/tests/browser_deployment.py

All browser requests are fulfilled from web/dist or synthetic API responses.
"""
import json
import mimetypes
import re
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

DIST = Path(__file__).resolve().parents[1] / "dist"
HTML = (DIST / "index.html").read_text()
ENTRY = re.search(r'<script[^>]+src="([^"]+)"', HTML).group(1)
OLD_HTML = HTML.replace(ENTRY, ENTRY + "?previous-release")
BASE = "https://deployment-test.invalid"
PROFILE = {"id": "b67057fd-de1a-4360-b842-7d2a95fca8af", "display_name": "Synthetic Reader", "avatar_url": None, "is_admin": False}
PAGES = {"/achievements": "Hall of Trophies", "/furtch": "The Furtch Chronicles"}


def check(browser, path, mode):
    context = browser.new_context()
    if mode == "guard":
        context.add_init_script("window.blockReload = event => event.preventDefault(); window.addEventListener('bart:navigate', window.blockReload)")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    target = next("/assets/" + file.name for file in (DIST / "assets").glob("*.js") if PAGES[path] in file.read_text())
    docs = 0
    chunks = 0
    update_checks = 0
    blocked = []

    def respond(route):
        nonlocal docs, chunks, update_checks
        request = route.request
        parsed = urlsplit(request.url)
        if parsed.netloc != "deployment-test.invalid":
            blocked.append(request.url)
            route.abort()
            return
        if parsed.path.startswith("/api/"):
            assert request.method == "GET" or request.post_data_json.get("action") == "heartbeat"
            route.fulfill(json={"user": PROFILE, "csrf_token": "synthetic", "tables": {"profiles": [PROFILE]}})
            return
        if parsed.path == path:
            if request.resource_type == "document":
                docs += 1
                # An old document with working entry code, but an expired page
                # chunk; after reload, navigation receives the current entry.
                body = OLD_HTML if docs == 1 and mode != "same-build" else HTML
                if mode == "loop":
                    body = OLD_HTML  # stale edge response even after reload
                route.fulfill(content_type="text/html", body=body)
            else:
                update_checks += 1
                if mode == "offline":
                    route.abort("failed")
                else:
                    route.fulfill(content_type="text/html", body=HTML)
            return
        if parsed.path == target:
            chunks += 1
            if chunks == 1 or mode == "loop":
                # The deployed catch-all returns HTML for deleted old chunks.
                route.fulfill(content_type="text/html", body=HTML)
                return
        file = DIST / parsed.path.lstrip("/")
        assert file.is_relative_to(DIST) and file.is_file(), parsed.path
        route.fulfill(content_type=mimetypes.guess_type(file.name)[0] or "application/octet-stream", body=file.read_bytes())

    context.route("**/*", respond)
    page.goto(BASE + path, wait_until="domcontentloaded")
    if mode == "automatic":
        expect(page.get_by_role("heading", name=PAGES[path], exact=True)).to_be_visible()
        assert docs == 2 and chunks == 2 and update_checks == 1
        assert page.url == BASE + path
    else:
        button = page.get_by_role("button", name="Reload site", exact=True)
        expect(button).to_be_visible()
        assert docs == (2 if mode == "loop" else 1)
        assert update_checks == (2 if mode == "loop" else 1)
        if mode == "guard":
            assert page.evaluate("sessionStorage.getItem('bart:reloaded-deployment')") is None
            button.click()
            assert docs == 1
            page.evaluate("window.removeEventListener('bart:navigate', window.blockReload)")
        if mode != "loop":
            button.click()
            expect(page.get_by_role("heading", name=PAGES[path], exact=True)).to_be_visible()
            assert docs == 2 and chunks == 2
        else:
            page.wait_for_timeout(300)
            assert docs == 2, "A broken destination release caused a reload loop"
    assert not errors and not blocked, (errors, blocked)
    print(f"PASS {path}: {mode}", flush=True)
    context.close()


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(args=["--no-sandbox"])
    for path in PAGES:
        for mode in ("automatic", "same-build", "guard", "offline", "loop"):
            check(browser, path, mode)
    browser.close()
print("PASS: real production chunks recover, retry, preserve navigation guards and avoid reload loops.")
