#!/usr/bin/env bash
set -euo pipefail
mkdir -p .cache/pr-load
export PR_HEAD="$REVISION"
PR_BASE=$(git rev-parse HEAD^)
export PR_BASE
# The dispatch revision owns selection. The historical checkout supplies the
# real task implementations, portable package filters, toolchain and cache keys.
tasks=$(bun -e 'console.log((await import(process.env.RUNNER_TEMP + "/pr-tasks.ts")).PR_TASKS.join("\n"))')
mapfile -t gate <<< "$tasks"
TURBO_CONCURRENCY=$(bun -e 'console.log(Math.max(1, Math.min(require("node:os").availableParallelism(), Math.floor(process.availableMemory() / (2 * 1024 ** 3)) - 1)))')
export TURBO_CONCURRENCY RAYON_NUM_THREADS=1 VERIFY_LINT_THREADS=1 GOMAXPROCS=1
python3 - "${gate[@]}" <<'PY'
import json
import os
import pathlib
import re
import resource
import subprocess
import sys
import time

root = pathlib.Path('.cache/pr-load')
log = root / 'gate.log'
command = ['bun', 'run', 'libs/secrets-server-ts/scripts/secrets-run.ts',
           '--fixture', '--', 'bun', 'run',
           'libs/tools-harness-ts/scripts/turbo-ci-run.ts', *sys.argv[1:]]

def memory_fraction():
    memory = pathlib.Path('/proc/meminfo').read_text()
    total = int(re.search(r'^MemTotal:\s+(\d+)', memory, re.M)[1])
    available = int(re.search(r'^MemAvailable:\s+(\d+)', memory, re.M)[1])
    return (total - available) / total

started = time.monotonic()
peak_memory = memory_fraction()
with log.open('w') as output, subprocess.Popen(command, stdout=output, stderr=subprocess.STDOUT) as child:
    while child.poll() is None:
        try:
            child.wait(timeout=1)
        except subprocess.TimeoutExpired:
            pass
        peak_memory = max(peak_memory, memory_fraction())
elapsed = time.monotonic() - started
usage = resource.getrusage(resource.RUSAGE_CHILDREN)
text = log.read_text(errors='replace')
print(text)
# Parse before GitHub's masking can replace a digit in the textual log.
tasks = re.search(r'(\d+) tasks — (\d+) cached, (\d+) to execute', text)
phases = dict(re.findall(r'\b(plan|prefetch|turbo) ([\d.]+)s', text))
cpu = usage.ru_utime + usage.ru_stime
metrics = dict(revision=os.environ['REVISION'], exitCode=child.returncode,
               wallSeconds=elapsed, cpuSeconds=cpu, maxProcessRssKiB=usage.ru_maxrss,
               cpuFraction=cpu / (elapsed * len(os.sched_getaffinity(0))),
               peakHostMemoryFraction=peak_memory,
               slots=int(os.environ['TURBO_CONCURRENCY']),
               phases={k:float(v) for k,v in phases.items()})
if tasks:
    metrics.update(zip(('tasks','hits','misses'), map(int, tasks.groups())))
(root / 'metrics.json').write_text(json.dumps(metrics))
sys.exit(child.returncode)
PY
