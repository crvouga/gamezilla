# Resource budgeting

The machine is shared: with the user, with other agents, with other
worktrees. Heavy checks therefore never run on it: they run in hosted CI.
Nothing queues locally: a check starts at once, or is refused at once with a
reason waiting cannot fix.

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
| heavy checks | 0 locally: hosted CI | |
| priority | `nice -n 10`; Linux adds `ionice -c2 -n7` | `CI_GREEN_NICE` |

The CPU and memory figures are reported by `resource-budget` for information.
They never delay a light or medium check.

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

A check slot is granted or refused at once, never waited for:

1. a heavy check is refused locally (`run-check` reports it as `hosted`):
   push, or dispatch the hosted workflow (`gh workflow run verify-nightly.yml
   --ref <branch> -f group=<group>`), and read its result;
2. a check whose id is already running is refused (never two runs of one
   check); read the running one's result instead of waiting for a turn;
3. every other check starts immediately, however many others are running.

Subagent slots are always granted; they carry a 4-hour lease (renew with
`resource-budget renew TOKEN`) only so a crashed coordinator's records expire.

## The shared ledger

- Location: `<main worktree>/.ci-green/budget/` (`slots.json` +
  `slots.lock`, `services.json` + `services.lock`), shared by every worktree
  of the repository (`git rev-parse --git-common-dir`). Override with
  `CI_GREEN_BUDGET_DIR`, for example to share one budget across several
  repositories on the same machine.
- Writes happen under a brief exclusive `flock`, only to keep the record
  consistent; no agent ever waits on another's check.
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
manually: send heavy checks to hosted CI, start light and medium checks at
once prefixed with `nice -n 10`, and never start a second copy of the same
check or service while one is running.

## Signs the budget is wrong

- Tests time out locally but not in CI: the machine is oversubscribed. Run
  that check in hosted CI before suspecting the code. Never raise the test's
  timeout.
- `Killed` / exit 137 / heap out of memory: the check is heavier than its
  class. Mark it heavy (`--weight heavy`) so it runs in hosted CI, and report
  the memory it needed.
- The user's machine is sluggish: raise `CI_GREEN_RESERVE_CORES`.

## Choosing where work runs

Choose the narrowest check that exercises the observed CI failure. Run it
locally at once when it is light or medium; send it to hosted CI when it is
heavy. Before pushing, prefer warming affected, CI-compatible Turbo tasks with
remote reads and writes enabled, as described in
[the pre-push workflow](../SKILL.md#warm-the-remote-cache-before-pushing).
Never hold work back waiting for local capacity, and never treat waiting time
as evidence that a fix works.
