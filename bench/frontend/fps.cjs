// Benchmark 5a: frames per second while the user drags (rotates) the globe, at N markers.
// Frames = distinct requestAnimationFrame timestamps (one per rendered frame), counted in
// the page over a 10 s window while Playwright drags the mouse back and forth across the globe.
// Needs: stub_backend.py on :8765 and the frontend built with VITE_API_URL=http://127.0.0.1:8765,
// served at <appUrl>. Usage: node fps.cjs <appUrl> [runs=3] [markers=100,500,1000]
const { chromium } = require("playwright");
const [appUrl, runsArg, nArg] = process.argv.slice(2);
const RUNS = Number(runsArg || 3), COUNTS = (nArg || "100,500,1000").split(",").map(Number);
const STUB = "http://127.0.0.1:8765", WINDOW_MS = 10000;
(async () => {
  const browser = await chromium.launch();   // headless; WebGL via SwiftShader (no GPU here)
  const results = [];
  for (const n of COUNTS) {
    await fetch(`${STUB}/__markers`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ n }) });
    for (let run = 0; run < RUNS; run++) {
      const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      await ctx.addInitScript(() => {
        window.__frames = [];
        const raf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = cb => raf(ts => { const f = window.__frames; if (f[f.length - 1] !== ts) f.push(ts); cb(ts); });
      });
      const page = await ctx.newPage();
      await page.goto(appUrl);
      await page.getByPlaceholder("Username").fill("bench");
      await page.getByPlaceholder("Password").fill("bench-pass");
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "bench" }).waitFor();
      await page.getByText("Fetching the latest news").waitFor({ state: "detached", timeout: 60000 });
      await page.waitForTimeout(2000);                       // settle
      const w = page.viewportSize(), cx = w.width / 2, cy = w.height / 2;
      const t0 = await page.evaluate(() => performance.now());
      await page.mouse.move(cx - 150, cy); await page.mouse.down();
      const end = Date.now() + WINDOW_MS; let dir = 1, x = cx - 150;
      while (Date.now() < end) {                              // continuous drag, back and forth
        x += dir * 15; if (x > cx + 150 || x < cx - 150) dir = -dir;
        await page.mouse.move(x, cy + Math.sin(x / 40) * 20);
        await page.waitForTimeout(16);
      }
      await page.mouse.up();
      const r = await page.evaluate(t0 => {
        const f = window.__frames.filter(ts => ts >= t0);
        const dt = f.slice(1).map((t, i) => t - f[i]).sort((a, b) => a - b);
        const secs = (f[f.length - 1] - f[0]) / 1000;
        return { frames: f.length, seconds: secs, fps: (f.length - 1) / secs,
                 frame_ms_p50: dt[Math.floor(dt.length * 0.5)], frame_ms_p95: dt[Math.floor(dt.length * 0.95)] };
      }, t0);
      results.push({ markers: n, run: run + 1, ...r });
      console.error(`markers=${n} run=${run + 1}: fps=${r.fps.toFixed(1)} p50=${r.frame_ms_p50.toFixed(1)}ms p95=${r.frame_ms_p95.toFixed(1)}ms`);
      await ctx.close();
    }
  }
  await browser.close();
  console.log(JSON.stringify(results));
})();
