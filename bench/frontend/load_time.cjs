// Benchmark 5c: initial load of the first screen (the login page) in headless Chromium.
// Each run uses a fresh browser context (empty cache). Metrics from the page's own
// Performance API: TTFB, First Contentful Paint, DOMContentLoaded, load, Largest Contentful Paint.
// Usage: node load_time.cjs <url> <label> [runs=5] [--proxy]
const { chromium } = require("playwright");
const [url, label, runsArg] = process.argv.slice(2);
const RUNS = Number(runsArg || 5), useProxy = process.argv.includes("--proxy");
(async () => {
  const browser = await chromium.launch(useProxy ? { proxy: { server: process.env.HTTPS_PROXY } } : {});
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, ignoreHTTPSErrors: useProxy });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__lcp = 0;
      new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; })
        .observe({ type: "largest-contentful-paint", buffered: true });
    });
    await page.goto(url, { waitUntil: "load" });
    await page.getByRole("heading", { name: "Log In" }).waitFor();
    await page.waitForTimeout(1500);   // let LCP settle
    const m = await page.evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0];
      const fcp = performance.getEntriesByName("first-contentful-paint")[0];
      const bytes = performance.getEntriesByType("resource").reduce((s, r) => s + (r.transferSize || 0), n.transferSize || 0);
      return { ttfb: n.responseStart, fcp: fcp ? fcp.startTime : null, dcl: n.domContentLoadedEventEnd,
               load: n.loadEventEnd, lcp: window.__lcp, transferred_bytes: bytes };
    });
    runs.push(m);
    console.error(`${label} run ${i + 1}: ` + Object.entries(m).map(([k, v]) => `${k}=${Math.round(v)}`).join(" "));
    await ctx.close();
  }
  await browser.close();
  const med = k => { const xs = runs.map(r => r[k]).sort((a, b) => a - b); return xs[Math.floor(xs.length / 2)]; };
  console.log(JSON.stringify({ label, url, runs, median: Object.fromEntries(Object.keys(runs[0]).map(k => [k, med(k)])) }));
})();
