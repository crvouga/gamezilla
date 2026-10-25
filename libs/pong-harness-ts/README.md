# Pong harness

Pong's product scenarios and models live in `specs/pong/`. The package binds
them through the shared game harness. Authoring rules belong in
[`specs/README.md`](../../specs/README.md).

## Performance profile

Run `bunx turbo run bench --filter=@libs/pong-harness-ts`. The same task joins
`bun verify-nightly performance`; it prints a standalone `pong-profile.v1`
JSON document and writes it to `.cache/performance/pong-profile.json` in this
package through the existing object-store adapter. It is a measurement, with
no machine-dependent pass threshold.
Timing code lives only in the benchmark entry, while the room system uses
injected virtual time and the existing deterministic network.

The profile measures:

- The registered fixed-step engine with two medium bots and its result check,
  plus a saturated 256-input mailbox including restore, enqueue and one tick.
  Twenty batches warm each case; 200 measured batches report median/p95/p99
  of the **batch mean** per operation. These are not individual-tick tail
  percentiles. An ended bot game restores its playing opening.
- A real custom-session room and its clients, with two controlled paddles and
  0, 2 or 20 admitted spectators. Four virtual seconds warm the opening, then
  ten virtual seconds supply the sample. `publishedTickDelta` comes from the
  received authoritative snapshots. Each virtual step drains room I/O before
  advancing again. No browser, database or socket is launched.
- UTF8 bytes of the actual room JSON envelopes, including IDs/timestamps and
  excluding the harness routing wrapper. Every delivery counts; the shared
  wire object also counts once in `snapshotPublications`, allowing exact
  fanout checks. Joins, welcome history and warm-up traffic are excluded.
- Durable events added during the window and the final bounded live recovery
  value's serialized size. Integrated elapsed wall/process CPU time includes
  virtual scheduling, room/client execution and profiling's JSON accounting.

The profile does not measure socket/TLS framing, production storage latency,
hosted Worker limits, browser rendering, device performance or fleet capacity.
Process CPU time sums all process threads, so it can exceed elapsed wall time.
Results need their runtime/machine/load context; they never substitute for the
full verification gate or hosted/browser evidence.

`pong-room-profile.test.ts` checks actual controls, identical mechanics across
fanouts and each publication's delivered bytes. `pong-room-traffic.test.ts`
uses properties for Unicode bytes, repeated deliveries and reset boundaries.
The shared admitted-session fixture also drives the framework's existing
counting-race network campaign, including its pinned playback regression.
