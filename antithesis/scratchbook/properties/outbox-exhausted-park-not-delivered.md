# outbox-exhausted-park-not-delivered

Focus: Failure Recovery + liveness non-guarantee. Confidence: high.

Existing Antithesis SDK: **missing**. All suggested assertions are new.

Fills coverage-balance F3. Distinct from `outbox-handler-at-most-once` (successful process runs once) and `outbox-processed-without-notify` (handler **succeeded**, `processed_at` set, MQTT skipped — snapshot must still heal). This card is the **failed** path: after `maxAttempts` (default 8) or a permanent parse/validate error, the delivery is parked `available_at ≈ now + 365d` and `processed_at` stays NULL. It must not be treated as eventually delivered.

## Why this property

SUT `[liveness]`: “Outbox: 8 attempts, then park `available_at` + 1 year. Not unbounded eventual delivery.” `[failure]`: “Exhausted outbox parked +365d — silent.”

`failDelivery` (`pkgs/outbox/src/drain.ts`): if `permanent` (JSON parse fail, `validatePayload` fail) **or** `attempts >= policy.maxAttempts` after a thrown handler, UPDATE `attempts`, `last_error`, `available_at = now + 365d`. No `processed_at`. `claimDueDeliveries` only selects `processed_at IS NULL AND available_at <= now`. Until wall clock (or a clock jump) reaches the park time, cron and post-`/mutations` drain skip the row.

`DEFAULT_OUTBOX_RETRY_POLICY.maxAttempts = 8`. Product friends consumers use the default unless overridden.

`outbox-processed-without-notify` evidence already flagged this as “a *failed* handler is a different silent hole.” Catalog had no card, so a synthesizer could treat park as covered by the processed-heal liveness.

## Code paths

| File | Role |
|---|---|
| `pkgs/outbox/src/types.ts` | `DEFAULT_OUTBOX_RETRY_POLICY` `{ maxAttempts: 8, backoffMs: [...] }`. |
| `pkgs/outbox/src/drain.ts` `claimDueDeliveries` | Due = `available_at <= now` and not processed. |
| same file `runDelivery` / `failDelivery` | Parse/validate → `permanent: true` (park immediately). Handler throw → increment; park at maxAttempts. |
| `apps/server/src/sync/outbox-drain.ts` | Drain then maybe `notifyChannels`. Parked rows never reach notify. |
| `libs/friends/src/root/server/friends-outbox-consumers.ts` | Handlers that can throw (SQL / notify-id assembly). |

`existing-assertions.md`: no Antithesis SDK.

## Failure scenario

1. Friend-request (or other) mutation commits; outbox event + delivery exist.
2. Handler throws (paused Postgres mid-handler, constraint, injected error) seven times with backoff, or payload fails validate once.
3. Eighth failure (or permanent) parks `available_at` ~365d ahead. `processed_at` NULL. Log `outbox delivery exhausted`.
4. **Violation (safety):** a later drain marks `processed_at` or runs the handler again **without** `available_at` having become due (no clock jump past park). Or a liveness check treats the recipient notification / side effect as “must eventually appear” the way `outbox-processed-without-notify` does.
5. Clock-jump variant: Antithesis jumps +365d → row becomes due again. That is a **new** attempt window, not “park failed.” Record it as `Sometimes(outbox.park_reclaimed_after_clock_jump)` if it happens; do not call it unbounded delivery of the original eight.

## Invariant

- `Always` after a park UPDATE: `processed_at IS NULL`, `attempts >= maxAttempts` (or permanent), `available_at` is ≥ ~365d from the park `clock.now()`, and handler success count for that `(event_id, consumer_id)` is still 0.
- `Sometimes(outbox.exhausted_park)`: a delivery reaches the park branch (search hint; the interesting state).
- `Unreachable`: `processed_at` set on a row whose last fail was park **and** whose handler never succeeded (would mean drain treated park as success).
- **Do not** write `Always`/`Unreachable` that the recipient’s domain/notification row eventually appears. Park is an accepted miss. HTTP snapshot heal applies only to **processed** deliveries (`outbox-processed-without-notify`).

Type is **Safety** (must not pretend park is delivery) plus a `Sometimes` for reachability of the park state. It is not a Liveness “eventually delivered” card — that would contradict the code.

## Antithesis angle

Pause/kill Postgres during the handler txn so the throw path retries; or feed an invalid payload (permanent park on first attempt). Overlap cron + post-mutations drain (`outbox-handler-at-most-once`) so attempts increment from two sessions. Clock jump is in-topology — size it so a +minutes jump does **not** unpark, and treat +365d as a separate reclaim scenario.

First topology: Node API + Postgres + cron-equivalent drain. No room/DO storage involved.

## What goes wrong if the property is mis-specified

If the campaign copies the processed-without-notify Unreachable (“recipient permanently missing after reconcile”) onto exhausted rows, Antithesis will “fail” a designed park. If the campaign never asserts park, exhausted deliveries look like a missed notify that should have healed — silent product hole (sender thinks the mutation applied; inbox action never ran).

## Suggested SUT instrumentation (all missing)

- `Sometimes("outbox.delivery.exhausted_park")` at the park UPDATE.
- `Always("outbox.park.not_processed")` after that UPDATE: `processed_at` still null.
- `Unreachable("outbox.park.handler_ok")` if `markProcessed` runs for a claim that just exhausted.
- `Reachable("outbox.delivery.permanent_invalid_payload")` vs `Reachable("outbox.delivery.max_attempts")`.

## Open questions

- Should the workload shorten `maxAttempts` in the Antithesis image so park is reachable without eight real backoffs (last backoff step is 300s)? `(needs human input)`

SDK (`existing-assertions.md`): **missing**. Suggested assertions remain new.

### Investigation Log

#### Do product consumers override `retryPolicy`, or does everything in the first topology use `maxAttempts: 8`?

- Examined: `defineOutboxConsumer` / `resolveRetryPolicy`; grep `retryPolicy` under `libs/` and `apps/`; `libs/friends/src/root/server/friends-outbox-consumers.ts`; `DEFAULT_OUTBOX_RETRY_POLICY` (`maxAttempts: 8`, backoff `[1s, 5s, 15s, 60s, 300s]`).
- Found: the only product `defineOutboxConsumer` calls are the three friends notify consumers. None pass `retryPolicy`. Tests in `pkgs/outbox` may override; first topology does not run those.
- Not found: a billing/TTS/other consumer in the first-topology mount that sets a different cap.
- Conclusion: resolved — first topology uses `maxAttempts: 8` for all product consumers.

#### After a +365d clock jump, is reclaim-and-retry intended, or should drain refuse already-exhausted rows even if `available_at` is due?

- Examined: `claimDueDeliveries` (`processed_at IS NULL AND available_at <= now` — no `attempts` predicate); `failDelivery` / `runDelivery`.
- Found: after a jump past park, the row is due again. Drain **runs the handler**. Success → `processed_at`. Throw → `attempts+1` still `>= maxAttempts` → park +365d again. There is no exhausted / dead-letter flag.
- Not found: a comment or guard that exhausted rows must stay parked across clock jumps.
- Conclusion: resolved — **code treats park as delay, not dead-letter.** Property already records +365d as a new attempt window (`Sometimes(outbox.park_reclaimed_after_clock_jump)`). Do not Always-fail reclaim. Type unchanged.

#### Should the workload shorten `maxAttempts` so park is reachable without eight backoffs?

- Examined: `failDelivery` `permanent` (JSON parse / `validatePayload` fail) parks on the **first** attempt; throw path needs 8 failures; last backoff step 300s.
- Found: `Sometimes(outbox.exhausted_park)` is reachable via an invalid payload **without** shortening or waiting eight backoffs. Shortening only helps the handler-throw path.
- Not found: an Antithesis image override of `DEFAULT_OUTBOX_RETRY_POLICY`.
- Conclusion: tagged `(needs human input)` — not required for park reachability (use permanent-invalid). Optional convenience for the throw path. Property does not depend on shortening.

## Assumptions

- Park math is `365 * 24 * 60 * 60 * 1000` ms from `clock.now()` at fail time (`drain.ts`).
- Friends/notification side effects are the user-visible miss; billing/TTS outbox is out of first topology.
- SDK missing.
