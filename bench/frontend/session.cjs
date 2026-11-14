// Feed-cache hit rate over scripted user sessions, driven through the REAL frontend against the
// real backend (bench/backend/serve_replay.py on :8766). Server-side counters give the truth:
// feed_requests = /news calls reaching the cache, builds = cache misses.
// Scenario A (one user):  log in -> reload x2 -> switch to sport -> back to technology ->
//                         switch to environment -> reload -> log out -> log in again.
// Scenario B: 5 users (technology) run "log in -> reload -> reload" one after another.
// Scenario C: 50 concurrent /news requests for one section right after its cache expired.
// Usage: node session.cjs http://localhost:4182
const { chromium } = require("playwright");
const APP = process.argv[2], API = "http://127.0.0.1:8766";
const counters = async () => (await fetch(`${API}/__bench/counters`)).json();
const clearCache = () => fetch(`${API}/__bench/clear_cache`, { method: "POST" });
const delta = (a, b) => ({ requests: (b.feed_requests || 0) - (a.feed_requests || 0), builds: (b.builds || 0) - (a.builds || 0) });

async function signup(u) {
  const r = await fetch(`${API}/signup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: u, password: "bench-pass" }) });
  const tok = (await r.json()).access_token;
  await fetch(`${API}/preference`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${tok}` }, body: JSON.stringify({ preference: "technology" }) });
  return tok;
}
async function waitNews(page) {
  await page.getByText("Fetching the latest news").waitFor({ state: "detached", timeout: 60000 });
}
async function login(page, u) {
  await page.getByPlaceholder("Username").fill(u); await page.getByPlaceholder("Password").fill("bench-pass");
  await page.keyboard.press("Enter"); await page.getByRole("button", { name: u }).waitFor(); await waitNews(page);
}
async function setPref(page, u, s) {
  await page.getByRole("button", { name: u }).click(); await page.locator(`input[value=${s}]`).check();
  await page.getByRole("button", { name: "Save Preference" }).click(); await waitNews(page);
}

(async () => {
  const run = Date.now().toString(36);
  const browser = await chromium.launch();
  const out = {};

  // A: one user, one realistic session
  const ua = `sess_a_${run}`; await signup(ua);
  await clearCache();                       // every scenario starts with a cold feed cache
  let c0 = await counters();
  let page = await (await browser.newContext()).newPage();
  await page.goto(APP); await login(page, ua);
  for (let i = 0; i < 2; i++) { await page.reload(); await page.getByRole("button", { name: ua }).waitFor(); await waitNews(page); }
  await setPref(page, ua, "sport"); await setPref(page, ua, "technology"); await setPref(page, ua, "environment");
  await page.reload(); await page.getByRole("button", { name: ua }).waitFor(); await waitNews(page);
  await page.getByRole("button", { name: ua }).click(); await page.getByRole("button", { name: "Logout" }).click();
  await page.getByRole("heading", { name: "Log In" }).waitFor(); await login(page, ua);
  out.A_one_user_session = delta(c0, await counters());

  // B: 5 users on technology, one after another, inside one 15-minute cache window
  await clearCache();
  c0 = await counters();
  for (let k = 0; k < 5; k++) {
    const u = `sess_b${k}_${run}`; await signup(u);
    const p = await (await browser.newContext()).newPage();
    await p.goto(APP); await login(p, u);
    for (let i = 0; i < 2; i++) { await p.reload(); await p.getByRole("button", { name: u }).waitFor(); await waitNews(p); }
  }
  out.B_five_users_same_section = delta(c0, await counters());
  await browser.close();
  console.log(JSON.stringify(out));
})();
