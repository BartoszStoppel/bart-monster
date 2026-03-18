/**
 * Smoke tests for bart-monster deployment.
 * Usage: node scripts/smoke-test.mjs [base-url]
 * Default: http://localhost:3000
 *
 * Authenticated tests:
 *   SMOKE_TEST_COOKIE="sb-xxx=..." node scripts/smoke-test.mjs https://bart.monster
 */

const BASE_URL = process.argv[2] ?? "http://localhost:3000";
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  + ${name}`);
    passed++;
  } catch (err) {
    console.error(`  x ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function get(path, options = {}) {
  return fetch(`${BASE_URL}${path}`, { redirect: "manual", ...options });
}

console.log(`\nSmoke tests -> ${BASE_URL}\n`);

console.log("Auth & routing");

await test("/ redirects unauthenticated users to /login", async () => {
  const res = await get("/");
  assert([302, 307, 308].includes(res.status), `Expected redirect, got ${res.status}`);
  const location = res.headers.get("location") ?? "";
  assert(location.includes("login"), `Expected redirect to /login, got ${location}`);
});

await test("/login returns 200", async () => {
  const res = await get("/login");
  assert(res.status === 200, `Expected 200, got ${res.status}`);
});

await test("/login contains sign-in button", async () => {
  const res = await get("/login");
  const html = await res.text();
  assert(html.includes("Sign in with Google"), "Missing sign-in button");
});

console.log("\nBGG API proxy (unauthenticated)");

await test("/api/bgg/search returns 401 without session", async () => {
  const res = await get("/api/bgg/search?q=catan");
  assert(res.status === 401, `Expected 401, got ${res.status}`);
  const data = await res.json();
  assert(data.error === "Unauthorized", `Expected {error:"Unauthorized"}, got ${JSON.stringify(data)}`);
});

await test("/api/bgg/game/[id] returns 401 without session", async () => {
  const res = await get("/api/bgg/game/174430");
  assert(res.status === 401, `Expected 401, got ${res.status}`);
});

const sessionCookie = process.env.SMOKE_TEST_COOKIE;
if (sessionCookie) {
  console.log("\nBGG API proxy (authenticated)");
  const h = { Cookie: sessionCookie };

  await test("/api/bgg/search?q=catan returns results", async () => {
    const res = await get("/api/bgg/search?q=catan", { headers: h });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data) && data.length > 0, "Expected non-empty array");
    assert(data[0].id && data[0].name, "Result missing id or name");
  });

  await test("/api/bgg/search?q= returns 400", async () => {
    const res = await get("/api/bgg/search?q=", { headers: h });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test("/api/bgg/game/174430 returns Gloomhaven", async () => {
    const res = await get("/api/bgg/game/174430", { headers: h });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.id === 174430, `Expected 174430, got ${data.id}`);
    assert(data.name.toLowerCase().includes("gloomhaven"), `Got ${data.name}`);
    assert(typeof data.bggRating === "number", "Missing bggRating");
    assert(Array.isArray(data.categories), "Missing categories");
    assert(Array.isArray(data.mechanics), "Missing mechanics");
  });

  await test("/api/bgg/game/0 returns 404", async () => {
    const res = await get("/api/bgg/game/0", { headers: h });
    assert(res.status === 404, `Expected 404, got ${res.status}`);
  });
} else {
  console.log("\n  (Skipping authenticated tests -- set SMOKE_TEST_COOKIE to enable)");
}

console.log("\nStatic assets");

await test("/favicon.ico is served", async () => {
  const res = await get("/favicon.ico");
  assert(res.status === 200, `Expected 200, got ${res.status}`);
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
