// Benchmark 5b: production bundle size. Usage: node bench/frontend/bundle_size.cjs <distDir>
// Reports raw, gzip (level 9) and brotli (quality 11) bytes for every built asset.
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const dist = process.argv[2];
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : files.push(p); } })(dist);
const rows = files.map(p => {
  const buf = fs.readFileSync(p);
  return { file: path.relative(dist, p), raw: buf.length,
           gzip: zlib.gzipSync(buf, { level: 9 }).length,
           brotli: zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length };
}).sort((a, b) => b.raw - a.raw);
const sum = (k, f) => rows.filter(f).reduce((s, r) => s + r[k], 0);
const isJs = r => r.file.endsWith(".js");
const out = { rows, js_total: { raw: sum("raw", isJs), gzip: sum("gzip", isJs), brotli: sum("brotli", isJs) } };
console.log(JSON.stringify(out, null, 1));
