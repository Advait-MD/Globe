"""Benchmark 6: authentication cost.

- bcrypt cost factor: read from a hash produced by the app's own hash_password().
- bcrypt alone: auth.verify_password() (checkpw) and auth.hash_password() (gensalt+hashpw).
- End to end on the local HTTP server: POST /login (valid credentials) and POST /signup.
3 runs x 30 samples each, sequential.
"""
import statistics, sys, time, uuid
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import summarize, save_raw  # noqa: E402
from backend.harness import start  # noqa: E402

RUNS, N = 3, 30
base, news, counters, srv = start()
import auth  # the app's module, loaded by start()

h = auth.hash_password("bench-pass")
cost = int(h.split("$")[2])
print(f"hash prefix {h[:7]} -> bcrypt cost factor {cost} (2^{cost} = {2**cost} rounds)")

c = httpx.Client(base_url=base, timeout=60)
c.post("/signup", json={"username": "bench_login", "password": "bench-pass"})

def timeit(fn):
    t0 = time.perf_counter(); fn(); return (time.perf_counter() - t0) * 1000

runs = []
for run in range(RUNS):
    verify = [timeit(lambda: auth.verify_password("bench-pass", h)) for _ in range(N)]
    hashing = [timeit(lambda: auth.hash_password("bench-pass")) for _ in range(N)]
    def login():
        r = c.post("/login", json={"username": "bench_login", "password": "bench-pass"}); assert r.status_code == 200
    def signup():
        r = c.post("/signup", json={"username": "u" + uuid.uuid4().hex[:12], "password": "bench-pass"}); assert r.status_code == 201
    logins = [timeit(login) for _ in range(N)]
    signups = [timeit(signup) for _ in range(N)]
    runs.append({k: summarize(v) for k, v in
                 {"bcrypt_verify": verify, "bcrypt_hash": hashing, "login_http": logins, "signup_http": signups}.items()})
    print(f"run {run+1}: " + " | ".join(f"{k} p50 {v['p50']:.1f} p95 {v['p95']:.1f}" for k, v in runs[-1].items()))

med = {k: {s: statistics.median(r[k][s] for r in runs) for s in ("p50", "p95")} for k in runs[0]}
print("MEDIAN OF 3 RUNS:", med)
save_raw("auth_local.json", {"bcrypt_cost": cost, "hash_prefix": h[:7], "runs": runs, "median_of_runs": med})
srv.should_exit = True
