#!/usr/bin/env bash
set -euo pipefail
mkdir -p .cache/pr-load
export PR_HEAD="$REVISION"
PR_BASE=$(git rev-parse HEAD^)
export PR_BASE
# Use the dispatch revision's selection with the measured tree's toolchain and
# package graph. Scalar task arguments leave portable package filtering to Turbo's driver.
tasks=$(bun -e 'console.log((await import(process.env.RUNNER_TEMP + "/pr-tasks.ts")).PR_TASKS.join("\n"))')
mapfile -t gate <<< "$tasks"
TURBO_CONCURRENCY=$(bun -e 'console.log(Math.max(1, Math.min(require("node:os").availableParallelism(), Math.floor(process.availableMemory() / (2 * 1024 ** 3)) - 1)))')
export TURBO_CONCURRENCY RAYON_NUM_THREADS=1 VERIFY_LINT_THREADS=1 GOMAXPROCS=1
status=0
/usr/bin/time -f '%e %U %S %M' -o .cache/pr-load/time \
  bun run libs/secrets-server-ts/scripts/secrets-run.ts --fixture -- \
  bun run libs/tools-harness-ts/scripts/turbo-ci-run.ts "${gate[@]}" \
  >.cache/pr-load/gate.log 2>&1 || status=$?
cat .cache/pr-load/gate.log
# Detailed logs can contain redacted digits on GitHub. Capture numeric fields
# before log transport, retaining only aggregate measurements.
python3 - "$status" <<'PY'
import json, os, pathlib, re, sys
root = pathlib.Path('.cache/pr-load')
text = (root / 'gate.log').read_text(errors='replace')
wall, user, system, rss = map(float, (root / 'time').read_text().splitlines()[-1].split())
tasks = re.search(r'(\d+) tasks — (\d+) cached, (\d+) to execute', text)
phases = dict(re.findall(r'\b(plan|prefetch|turbo) ([\d.]+)s', text))
metrics = dict(revision=os.environ['REVISION'], exitCode=int(sys.argv[1]),
               wallSeconds=wall, cpuSeconds=user+system, maxProcessRssKiB=rss,
               slots=int(os.environ['TURBO_CONCURRENCY']),
               phases={k:float(v) for k,v in phases.items()})
if tasks:
    metrics.update(zip(('tasks','hits','misses'), map(int, tasks.groups())))
(root / 'metrics.json').write_text(json.dumps(metrics))
PY
exit "$status"
