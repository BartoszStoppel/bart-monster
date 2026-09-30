"""Local Vite interaction regression harness; requires a disposable staff fixture.

uv run --with playwright python web/tests/browser_interactions.py \
  --fixture backups/brand-restoration/local-test.json
"""
import argparse
import json
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--base-url', default='http://127.0.0.1:5173')
parser.add_argument('--fixture', type=Path, required=True)
args = parser.parse_args()
base = args.base_url.rstrip('/')
assert urlparse(base).hostname in ('localhost', '127.0.0.1'), 'Use a local disposable application.'
fixture = json.loads(args.fixture.read_text())
root = Path(__file__).resolve().parents[2]
errors = []
expect.set_options(timeout=20000)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(args=['--no-sandbox'])

    def context(**options):
        ctx = browser.new_context(color_scheme='dark', **options)
        ctx.add_cookies([{'name': 'bart_session', 'value': fixture['session'], 'url': base}])
        # Deterministic artwork isolates visual interactions from image-service failures.
        ctx.route('**/_next/image?*', lambda route: route.fulfill(
            content_type='image/png', body=(root / 'web/public/icon.png').read_bytes()))
        ctx.route('**/api/actions', lambda route: route.fulfill(json={'ok': True})
                  if route.request.post_data_json.get('action') == 'heartbeat' else route.abort())
        return ctx

    desktop = context(viewport={'width': 1280, 'height': 1000})
    page = desktop.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base + '/', wait_until='domcontentloaded')
    expect(page.get_by_role('heading', name='The Codex', exact=True)).to_be_visible()
    card = page.locator('article.monster-card').first
    edit = card.get_by_role('button', name='Edit ', exact=False)
    initial_border = card.evaluate('(element) => getComputedStyle(element).borderColor')
    initial_shadow = card.evaluate('(element) => getComputedStyle(element).boxShadow')
    page.mouse.move(0, 0)
    expect(edit).to_have_css('opacity', '0')
    card.hover()
    expect(card).not_to_have_css('border-color', initial_border)
    expect(card).not_to_have_css('box-shadow', initial_shadow)
    expect(card.locator('img')).to_have_css('scale', '1.05')
    expect(edit).to_have_css('opacity', '1')
    page.mouse.move(0, 0)
    card.locator('a').first.focus()
    expect(edit).to_have_css('opacity', '1')
    edit.focus()
    edit.press('Enter')
    expect(card.get_by_role('heading', level=4)).to_be_visible()
    page.keyboard.press('Escape')
    expect(card.get_by_role('heading', level=4)).to_have_count(0)
    print('Mouse stone glow/art zoom, keyboard action reveal, and editor Escape: PASS', flush=True)

    games = page.get_by_role('button', name='Games', exact=True)
    games.hover()
    expect(games).to_have_attribute('aria-expanded', 'true')
    games.click()
    expect(games).to_have_attribute('aria-expanded', 'true')
    page.get_by_role('link', name='Picker', exact=True).click()
    expect(page.get_by_role('heading', name='The Summoning Wheel', exact=True)).to_be_visible()
    games.hover()
    page.get_by_role('link', name='Collection', exact=True).click()
    expect(page.get_by_role('heading', name='The Codex', exact=True)).to_be_visible()
    expect(page.locator('article.monster-card').first.locator('[class*="from-surface-container-low"]')).to_be_visible()
    page.mouse.move(0, 0)
    games.focus()
    games.press('Enter')
    expect(games).to_have_attribute('aria-expanded', 'true')
    page.keyboard.press('Tab')
    expect(page.get_by_role('link', name='Collection', exact=True)).to_be_focused()
    page.keyboard.press('Escape')
    expect(games).to_have_attribute('aria-expanded', 'false')
    expect(games).to_be_focused()
    page.evaluate('document.activeElement.blur()')
    games.hover()
    # Focus before the close timer expires without depending on CDP round-trip speed.
    games.evaluate('(button) => button.parentElement.addEventListener("pointerleave", () => button.focus(), {once: true})')
    page.mouse.move(0, 0)
    page.wait_for_timeout(250)
    expect(games).to_have_attribute('aria-expanded', 'true')
    games.press('Escape')
    rankings = page.get_by_role('button', name='Rankings', exact=True)
    rankings.hover()
    page.get_by_role('link', name='Tier List', exact=True).click()
    expect(page.get_by_role('heading', name='The Tier Forge', exact=True)).to_be_visible()
    print('Restored art-to-stone fade, keyboard/hover timers, and cross-menu focus navigation: PASS', flush=True)

    page.goto(base + '/users/' + fixture['user_id'], wait_until='domcontentloaded')
    trigger = page.locator('main button[aria-expanded]').first
    expect(trigger).to_be_visible()
    trigger.focus()
    expect(trigger).to_have_attribute('aria-expanded', 'true')
    expect(page.get_by_text('Holdings', exact=True)).to_be_visible()
    trigger.press('Escape')
    expect(trigger).to_have_attribute('aria-expanded', 'false')
    trigger.press('Enter')
    expect(trigger).to_have_attribute('aria-expanded', 'true')
    trigger.press('Tab')
    expect(trigger).to_have_attribute('aria-expanded', 'false')
    print('Title popovers support focus, Enter, Escape, and leaving focus: PASS', flush=True)

    # RankBadge is retained as a shared component but currently has no route consumer.
    page.evaluate("""async () => {
      const [ReactDOM, React, { RankBadge }] = await Promise.all([
        import('/node_modules/.vite/deps/react-dom_client.js'),
        import('/node_modules/.vite/deps/react.js'),
        import('/src/components/rank-badge.tsx')
      ]);
      const host = document.createElement('section');
      host.id = 'rank-badge-check'; document.body.append(host);
      (ReactDOM.default ?? ReactDOM).createRoot(host).render((React.default ?? React).createElement(RankBadge, { gamesRanked: 12 }));
    }""")
    badge = page.locator('#rank-badge-check button')
    badge.focus()
    badge.press('Enter')
    expect(badge).to_have_attribute('aria-expanded', 'true')
    badge.press('Escape')
    expect(badge).to_have_attribute('aria-expanded', 'false')
    print('Rank badge keyboard open/Escape: PASS', flush=True)

    touch = context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
    mobile = touch.new_page()
    mobile.on('pageerror', lambda error: errors.append(str(error)))
    mobile.goto(base + '/', wait_until='domcontentloaded')
    expect(mobile.get_by_role('heading', name='The Codex', exact=True)).to_be_visible()
    touch_card = mobile.locator('article.monster-card').first
    for button in touch_card.locator('button').all():
        expect(button).to_have_css('opacity', '1')
    mobile_games = mobile.get_by_role('button', name='Games', exact=True)
    mobile_games.tap()
    expect(mobile_games).to_have_attribute('aria-expanded', 'true')
    mobile_games.tap()
    expect(mobile_games).to_have_attribute('aria-expanded', 'false')
    mobile_games.tap()
    expect(mobile.get_by_role('link', name='Picker', exact=True)).to_be_visible()
    mobile.get_by_role('link', name='Picker', exact=True).tap()
    expect(mobile.get_by_role('heading', name='The Summoning Wheel', exact=True)).to_be_visible()
    avatar = mobile.locator('nav button[aria-expanded]').last
    avatar.tap()
    profile_link = mobile.get_by_role('link', name='Profile', exact=True)
    expect(profile_link).to_be_visible()
    assert profile_link.evaluate('(element) => element.parentElement.getBoundingClientRect().right <= innerWidth')
    profile_link.tap()
    touch_title = mobile.locator('main button[aria-expanded]').first
    expect(touch_title).to_be_visible()
    touch_title.tap()
    expect(touch_title).to_have_attribute('aria-expanded', 'true')
    touch_title.tap()
    expect(touch_title).to_have_attribute('aria-expanded', 'false')
    print('Touch actions, first/second tap toggles, and mobile profile menu bounds: PASS', flush=True)

    anonymous = browser.new_context(color_scheme='dark')
    anonymous.route('**/api/session', lambda route: route.fulfill(json={'user': None, 'csrf_token': 'fixture'}))
    login = anonymous.new_page()
    login.goto(base + '/login', wait_until='domcontentloaded')
    sign_in = login.get_by_role('button', name='Sign in with Google')
    expect(sign_in).to_be_visible()
    before = sign_in.evaluate('(element) => ({background: getComputedStyle(element).backgroundColor, shadow: getComputedStyle(element).boxShadow})')
    sign_in.hover()
    login.wait_for_timeout(400)
    after = sign_in.evaluate('(element) => ({background: getComputedStyle(element).backgroundColor, shadow: getComputedStyle(element).boxShadow})')
    assert before['shadow'] != after['shadow'], (before, after)
    print('Restored stone login hover changes glow:', before, '->', after, flush=True)
    assert not errors, errors
    browser.close()
