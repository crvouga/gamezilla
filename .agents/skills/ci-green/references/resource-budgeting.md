# Resource budgeting

The machine is shared: with the user, with other agents, with other
worktrees. ci-green never runs more than the budget allows, and every check
and subagent draws from one ledger.

## Measurement

`resource-budget` (and every `run-check` launch) measures:

| Quantity | macOS | Linux |
| --- | --- | --- |
| logical cores | `os.cpu_count()` | `os.cpu_count()`, capped by the cgroup CPU quota (`cpu.max`, `cfs_quota_us`) |
| memory total / available | `sysctl hw.memsize`; `vm_stat` free + inactive + speculative + purgeable pages | `/proc/meminfo` `MemAvailable`, capped by the cgroup limit (`memory.max`) |
| disk free | free bytes on the repo's filesystem | same |
| load | 1- and 5-minute load average | same |
| power | `pmset -g batt` | `/sys/class/power_supply/*` |

## The budget

| Rule | Default | Override |
| --- | --- | --- |
| cores kept free | 2 | `CI_GREEN_RESERVE_CORES` |
| RAM kept free | 25% of total | `CI_GREEN_RESERVE_MEM_PCT` |
| CPU units for checks | cores − reserved (min 1), halved on battery | |
| headroom now | cores − reserved − current 1-minute load | |
| parallel checks | min(CPU units, headroom now, memory budget ÷ 512 MB), at least 1 | `CI_GREEN_MAX_CHECKS` |
| parallel heavy checks | 1 | |
| parallel subagents | min(6, CPU units ÷ 2, parallel checks), at least 1 | `CI_GREEN_MAX_AGENTS` |
| priority | `nice -n 10`; Linux adds `ionice -c2 -n7` | `CI_GREEN_NICE` |

Weight classes (what one check is assumed to take):

| Weight | CPU units | Memory | Typical |
| --- | --- | --- | --- |
| light | 1 | 512 MB | formatters, small linters, secret scans |
| medium | 2 | 1.5 GB | lint over a large tree, typecheck, unit tests, builds |
| heavy | half the CPU units (at least 2) | 4 GB | integration and end-to-end suites, anything with services, any CI job allowed 20+ minutes |

The weight starts as an estimate from the phase, services and CI timeout,
and is replaced by the observed weight after the first run (average cores
used = CPU time ÷ wall time, and peak resident memory): heavy at ≥ 3 cores
or ≥ 3 GB, medium at ≥ 1.5 cores or ≥ 1 GB.

## Admission

A check slot is granted only when all of these hold (re-measured at every
attempt, backing off from 2 s to 15 s between attempts):

1. the same check id is not already running (never two runs of one check);
2. no other heavy check is running, if this one is heavy;
3. fewer checks are running than the parallel-check limit;
4. the CPU units in use plus this check's fit in the CPU budget;
5. the load not explained by ci-green's own checks is under 75% of the
   usable cores;
6. available memory minus the reserve covers this check's class.

When nothing is running, one check is always admitted, so the queue cannot
stall; a heavily loaded machine then runs strictly one check at a time.
Subagent slots are limited only by the subagent cap; they carry a 4-hour
lease (renew with `resource-budget renew TOKEN`) so a crashed coordinator
cannot hold them forever.

## The shared ledger

- Location: `<main worktree>/.ci-green/budget/` (`slots.json` +
  `slots.lock`, `services.json` + `services.lock`), shared by every worktree
  of the repository (`git rev-parse --git-common-dir`). Override with
  `CI_GREEN_BUDGET_DIR`, for example to share one budget across several
  repositories on the same machine.
- Writes happen under an exclusive `flock`, so concurrent agents cannot
  double-book.
- A check slot records its process id and host; when that process is gone,
  the next reader reclaims the slot. Subagent slots expire with their lease.
- `run-check` releases its slot on success, failure, timeout, Ctrl-C and
  SIGTERM, and kills the check's whole process group when interrupted.

## Services

Containers from CI `services:` (GitHub), `services:` (GitLab), secondary
`docker` images (CircleCI) are started once by `run-check`, under the
services lock, named `ci-green-<repo>-<service>`, with CI's ports and
environment. Before starting, it checks whether the container is already
running (reuse), and whether the host port is taken by something else (then
it stops and says so rather than starting a second copy). It waits up to 90
seconds for the ports to accept connections. `run-check --services` lists
them, `run-check --stop-services` removes them.

If the repository documents its own way to run long-lived processes (a
`dev` or `services` script, a compose file, a process manager), use that
instead and record it as an override; never leave an unmanaged background
server running.

## Doing it by hand

When the scripts cannot run (no Python 3.9+), apply the same policy
manually: measure with `nproc` / `sysctl -n hw.ncpu`, `free -m` /
`vm_stat`, `uptime`; run at most `cores − 2` light checks or one heavy
check at a time, each prefixed with `nice -n 10`; keep a list of what is
running and never start the same check, or a second copy of a service,
while one is running.

## Signs the budget is wrong

- Tests time out locally but not in CI: the machine is oversubscribed.
  Lower `CI_GREEN_MAX_CHECKS`, or run that check alone, before suspecting
  the code. Never raise the test's timeout.
- `Killed` / exit 137 / heap out of memory: the check is heavier than its
  class. Run it alone (`--weight heavy`) and report the memory it needed.
- The user's machine is sluggish: raise `CI_GREEN_RESERVE_CORES`.

## Choosing work before waiting

Budgeting limits local resource use; it does not require a full local suite.
Choose the narrowest check that exercises the observed CI failure. Respect
shared leases and continue useful diagnosis while queued. Before pushing, prefer
warming affected, CI-compatible Turbo tasks with remote reads and writes enabled,
as described in [the pre-push workflow](../SKILL.md#warm-the-remote-cache-before-pushing).
When local capacity blocks that work, report the unwarmed scope and use hosted
validation only as repository policy permits. Never bypass a lease or treat queue
time as evidence that the fix works.
