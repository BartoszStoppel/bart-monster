"""Read-only Table Monsters branding and interaction browser smoke.

uv run --with playwright python web/tests/browser_theme.py \
  --fixture backups/brand-restoration/local-test.json

Works with Vite, a built local server, or a deployed --base-url. An optional
--bypass-file contains {"bypass": "..."}; its header is sent only to the exact
base origin. All mutations are blocked except the application's heartbeat on
https://bart.monster. Local and preview heartbeats are fulfilled without writes.
The fixture must be a staff account to exercise the visible card edit control.
"""

import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--base-url", default="http://127.0.0.1:5173")
parser.add_argument("--fixture", type=Path, required=True)
parser.add_argument("--bypass-file", type=Path)
args = parser.parse_args()
base = args.base_url.rstrip("/")
origin = urlsplit(base)
assert origin.scheme in ("http", "https") and not origin.path
fixture = json.loads(args.fixture.read_text())
bypass = json.loads(args.bypass_file.read_text())["bypass"] if args.bypass_file else None
canonical = base == "https://bart.monster"
failures = []
heartbeats = []
font_responses = {}
expect.set_options(timeout=30000)


def same_origin(url):
    parsed = urlsplit(url)
    return (parsed.scheme, parsed.netloc) == (origin.scheme, origin.netloc)


def request_route(route):
    request = route.request
    parsed = urlsplit(request.url)
    local = same_origin(request.url)
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        is_heartbeat = (
            local
            and parsed.path == "/api/actions"
            and request.post_data_json.get("action") == "heartbeat"
        )
        if not is_heartbeat:
            failures.append(f"Blocked unexpected mutation: {request.method} {parsed.path}")
            route.abort()
            return
        if not canonical:
            route.fulfill(json={"ok": True})
            return
    if local and bypass:
        route.continue_(headers={**request.headers, "x-vercel-protection-bypass": bypass})
    else:
        route.continue_()


def response_check(response):
    if not same_origin(response.url):
        return
    path = urlsplit(response.url).path
    if path.startswith("/fonts/"):
        font_responses[path] = response.status
    if path.startswith(("/api/", "/fonts/")) and response.status >= 400:
        failures.append(f"HTTP {response.status}: {path}")
    if path == "/api/actions":
        heartbeats.append(response.status)


def open_page(context, path="/"):
    page = context.new_page()
    page.on("pageerror", lambda error: failures.append(str(error)))
    page.on("response", response_check)
    page.goto(base + path, wait_until="domcontentloaded")
    return page


def assert_bounds(page):
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Page overflows viewport"


def actual_fonts(context, page, selector):
    client = context.new_cdp_session(page)
    client.send("DOM.enable")
    client.send("CSS.enable")
    document = client.send("DOM.getDocument")
    node = client.send("DOM.querySelector", {"nodeId": document["root"]["nodeId"], "selector": selector})
    assert node["nodeId"], f"Missing font sample: {selector}"
    fonts = client.send("CSS.getPlatformFontsForNode", {"nodeId": node["nodeId"]})["fonts"]
    client.detach()
    return {font["familyName"] for font in fonts if font["isCustomFont"] and font["glyphCount"]}


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(args=["--no-sandbox"])

    def context(authenticated=True, **options):
        ctx = browser.new_context(color_scheme="light", **options)
        ctx.route("**/*", request_route)
        if authenticated:
            ctx.add_cookies([{"name": "bart_session", "value": fixture["session"], "url": base}])
        return ctx

    desktop = context(viewport={"width": 1280, "height": 1000})
    page = open_page(desktop)
    expect(page.get_by_role("heading", name="The Codex", exact=True)).to_be_visible()
    brand = page.get_by_role("link", name="TABLE MONSTERS", exact=True)
    expect(brand).to_be_visible()
    page.evaluate("document.fonts.ready")
    expected_fonts = {
        "nav a.font-display": "EB Garamond",
        "h1": "EB Garamond",
        "main p": "Hanken Grotesk",
        ".font-stat": "Geist",
        ".material-symbols-outlined": "Material Symbols Outlined",
    }
    for selector, family in expected_fonts.items():
        assert family in actual_fonts(desktop, page, selector), (selector, family)
    expect(page.locator("body")).to_have_css("background-color", "rgb(19, 19, 19)")
    expect(brand).to_have_css("color", "rgb(255, 215, 169)")
    assert page.locator("html").get_attribute("class") == "dark"
    assert_bounds(page)
    print("Original wordmark, actual EB Garamond/Hanken Grotesk/Geist/icon fonts, and dark theme: PASS", flush=True)

    card = page.locator("article.monster-card").first
    art = card.locator("img").first
    edit = card.get_by_role("button", name="Edit ", exact=False)
    page.mouse.move(0, 200)
    expect(edit).to_have_css("opacity", "0")
    before = card.evaluate("e => ({border: getComputedStyle(e).borderColor, shadow: getComputedStyle(e).boxShadow})")
    card.hover()
    expect(art).to_have_css("scale", "1.05")
    expect(edit).to_have_css("opacity", "1")
    after = card.evaluate("e => ({border: getComputedStyle(e).borderColor, shadow: getComputedStyle(e).boxShadow})")
    assert before["border"] != after["border"] and before["shadow"] != after["shadow"], (before, after)
    page.mouse.move(0, 200)
    card.locator("a").first.focus()
    expect(edit).to_have_css("opacity", "1")
    torch = page.locator(".torch-glow")
    expect(torch).to_be_visible()
    page.mouse.move(400, 300)
    expect(torch).to_have_attribute("style", "transform: translate(250px, 150px);")
    expect(torch).to_have_css("pointer-events", "none")
    print("Card zoom, amber border/glow, keyboard action reveal, and cursor torch: PASS", flush=True)

    games = page.get_by_role("button", name="Games", exact=True)
    games.hover()
    expect(games).to_have_attribute("aria-expanded", "true")
    games.click()
    expect(games).to_have_attribute("aria-expanded", "true")
    games.press("Escape")
    expect(games).to_have_attribute("aria-expanded", "false")
    expect(games).to_be_focused()
    games.press("Enter")
    games.press("Tab")
    expect(page.get_by_role("link", name="Collection", exact=True)).to_be_focused()
    page.keyboard.press("Escape")
    expect(games).to_be_focused()
    rankings = page.get_by_role("button", name="Rankings", exact=True)
    rankings.hover()
    expect(rankings).to_have_attribute("aria-expanded", "true")
    page.get_by_role("link", name="Community", exact=True).click()
    expect(page.get_by_role("heading", name="The Guild Hall", exact=True)).to_be_visible()
    expect(rankings).to_have_attribute("aria-expanded", "false")
    rankings.hover()
    rankings.press("Escape")
    expect(rankings).to_be_focused()
    games.hover()
    page.get_by_role("link", name="Collection", exact=True).click()
    expect(page.get_by_role("heading", name="The Codex", exact=True)).to_be_visible()
    print("Nav hover/click, keyboard Enter/Tab/Escape, and cross-menu navigation: PASS", flush=True)

    touch = context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
    mobile = open_page(touch)
    expect(mobile.get_by_role("heading", name="The Codex", exact=True)).to_be_visible()
    expect(mobile.get_by_role("link", name="TABLE MONSTERS", exact=True)).to_be_visible()
    assert_bounds(mobile)
    for button in mobile.locator("article.monster-card").first.locator("button").all():
        expect(button).to_have_css("opacity", "1")
    mobile_games = mobile.get_by_role("button", name="Games", exact=True)
    mobile_games.tap()
    expect(mobile_games).to_have_attribute("aria-expanded", "true")
    mobile_games.tap()
    expect(mobile_games).to_have_attribute("aria-expanded", "false")
    account = mobile.get_by_role("button", name="Account menu", exact=True)
    account.tap()
    profile = mobile.get_by_role("link", name="Profile", exact=True)
    expect(profile).to_be_visible()
    assert profile.evaluate("e => {const r=e.parentElement.getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth;}")
    account.tap()
    expect(account).to_have_attribute("aria-expanded", "false")
    print("Genuine touch controls/menu toggles and mobile header/profile-menu bounds: PASS", flush=True)

    reduced = context(viewport={"width": 1280, "height": 1000}, reduced_motion="reduce")
    still = open_page(reduced)
    expect(still.get_by_role("heading", name="The Codex", exact=True)).to_be_visible()
    expect(still.locator(".torch-glow")).to_be_hidden()
    durations = still.locator("article.monster-card img").first.evaluate("e => getComputedStyle(e).transitionDuration.split(',').map(parseFloat)")
    assert all(duration <= 0.001 for duration in durations), durations
    print("Reduced-motion torch suppression and short transitions: PASS", flush=True)

    anonymous = context(authenticated=False, viewport={"width": 1280, "height": 1000})
    login = open_page(anonymous, "/login")
    expect(login.get_by_role("heading", name="TABLE MONSTERS", exact=True)).to_be_visible()
    sign_in = login.get_by_role("button", name="Sign in with Google")
    before_shadow = sign_in.evaluate("e => getComputedStyle(e).boxShadow")
    sign_in.hover()
    login.wait_for_timeout(400)
    after_shadow = sign_in.evaluate("e => getComputedStyle(e).boxShadow")
    assert before_shadow != after_shadow
    print("Original login typography and amber button hover glow: PASS", flush=True)

    expected_assets = {f"/fonts/{name}.woff2" for name in ("eb-garamond-latin", "hanken-grotesk-latin", "geist-latin", "material-symbols-outlined")}
    assert expected_assets <= font_responses.keys(), font_responses
    assert all(font_responses[path] == 200 for path in expected_assets), font_responses
    if canonical:
        assert heartbeats and all(status == 200 for status in heartbeats), heartbeats
    assert not failures, failures
    browser.close()
    print("PASS: fonts served locally; no JavaScript/API errors or unexpected mutations.", flush=True)
