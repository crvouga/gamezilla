# Sync client performance

The sync contract is in [specs](../../specs/sync-engine/). These optimizations
reduce local database work without changing row acceptance or replay order:

- Complete pushed images need no existence lookup. Only unique IDs of partial
  images are queried, in batches of at most 999 bindings. The schema lookup
  remains transaction-local; a complete sibling image does not authorize an
  incomplete new row.
- Peer-marker recovery reads pending mutation IDs once per recovery call. The
  caller's merge transaction keeps that set stable while tables are healed.

`tests/merge-validation-performance.test.ts` budgets database operations for
1–10,000 complete images, repeated partial IDs, and binding-limit boundaries.
`tests/peer-healing-performance.test.ts` budgets one pending scan for 1–100
tables and checks that pending local writes survive. These deterministic work
budgets run in the ordinary test gate; they do not use machine-dependent
latency thresholds or claim end-to-end latency improvements.

`merge.ts` is the shared sync merge instrumentation boundary:

- `sync.work.queue`: time awaiting the preceding writer.
- `sync.work.merge`: execution including database transaction acquisition.
- `sync.work.validate`: image validation, with `app.sync.batch_size` images.
- `sync.work.rebase`: optimistic replay, with `app.sync.batch_size` pending writes.

Spans close on failures and contain no row payloads. Compare queue and execution
time to distinguish serialization pressure from slow database or replay work;
use nested SQL spans to locate queries. The instrumentation test checks closure
and queue progress after failure.

The initial local `bun obs slow` and widened 24-hour search on 2026-10-30 found
no recorded activity. The optimizations therefore target code-level redundant
work; production latency improvements still require representative traces.

## Performance implementation and evidence limits

The telemetry root injects `monotonicNow`; no wall-clock fallback is used.
`sync.work.*` spans replace the earlier `sync.merge.*` names. Metrics count
operations independently of trace sampling. Pending measured operations consume
their target budget at the longest target deadline, without cancelling the
business operation; late completion cannot count the same target again.
Foreground/background is captured at the start, and server, synthetic and
unknown cohorts are separate. This is diagnostic workload classification,
not proof that each observation belongs to a human or to the reference workload.

Hashing records table/row/byte counts and sort, representation encoding, UTF-8
encoding, and digest spans. Its exact wire hash is checked against the original
algorithm by a property test. Hash contents and row payloads are not telemetry.
Browser metric export uses injected HTTP and timers; ingress admits only declared
finite labels and overwrites the claimed environment. Shutdown or loss of a page
can still lose unexported metrics; absence cannot establish success.

The target registry and alert implementation are described in
[observability](../../libs/observability-shared-ts/README.md#sync-performance-targets).
Target values are not benchmark results. Low-end device CPU/heap acceptance,
and cross-device arrival timing with bounded clock uncertainty still require
representative verification. Reconnect now waits for the original active scopes
and the bounded original backlog; ambiguous workload qualification is unknown.
Peer arrivals explicitly report unknown rather than using unsynchronized clocks. Existing operation-budget
tests do not substitute for those measurements.

Separately, the outbox now uses injected unique delivery IDs with logical-pair
deduplication, rechecks candidates under a row lock, and commits/notifies each
delivery before starting the next. Database opening has transport/schema spans,
a two-second request connection timeout, and cleanup on every failed open.
Timeouts limit exposure; they are not evidence that connection setup got faster.
No pooling, region, or indexing change is justified by the inspected spans alone.

The reference benchmark lives in `@pkgs/sync-engine-harness-ts#bench` and joins the
existing nightly performance group. The ordinary harness tests verify the same
1,000-row / 1 MiB fixture with 100 pending writes. Work-budget assertions are
regression gates; wall-clock percentiles are reported observations on the runner,
not flaky per-test deadlines. Observe `sync.work.notify` for post-commit listener
work and the existing main-thread-stall events for browser blocking.
