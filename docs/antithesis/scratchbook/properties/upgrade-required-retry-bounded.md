# upgrade-required-retry-bounded

Focus: Resource Boundaries / Version Compatibility. Complement of `upgrade-required-no-local-wipe` (that card is “do not delete the file”). Adjacent to `health-ok-db-down-opens-gate` (same origin-gate + backoff, different 401 reason).

## Claim to test (not a fact)

While `POST /api/query` or `/api/mutations` returns HTTP 401 `{ error: 'auth', reason: 'upgrade_required' }`, the identity SQLite and `sync_engine_mutations` stay (wipe is the other card), uploads **must not** tight-loop, and pending ids must not be acked as applied. After the client again sends `x-sync-protocol: 3` and the gate accepts, the durable queue drains.

SUT `[failure]`: “`upgrade_required` — local DB intact, uploads retry forever, no upgrade UI found.” Wildcard A4: livelock next to a health-200 origin gate. Product always sends protocol 3; first topology forges header `2` / strips it (same as the wipe card).

`existing-assertions.md`: no Antithesis SDK. All suggested instrumentation is **missing**.

## Why this property

`assertSyncProtocol` is header-only: missing / non-numeric / ≠ 3 → 401 `upgrade_required` before auth (`sync-protocol-gate.ts`). Client `postAuthedJson` maps that reason to `SyncApiAuthError('upgrade_required')`. `handleError` does not wipe (`isAuthRevoked` is `reason === 'revoked'` only) and sets `online: false`. `apps/` / `libs/` have **no** upgrade screen.

Upload `runLoop`: `SyncApiAuthError` is not `HttpNetworkError`, so it does **not** `waitUntilAvailable`. It increments `errorAttempts` and waits `ERROR_DELAY_MS * 2^n` capped at `MAX_ERROR_DELAY_MS` (2s … 60s + jitter). A completed 401 is still `fetchAndNote` → `noteSuccess()` — the health gate stays **available**. If a future host classified `upgrade_required` as a network error, `waitUntilAvailable` would resolve immediately on health 200 and tight-loop (the `health-ok-db-down-opens-gate` storm with a protocol-cut trigger).

DST `restoreSettleAuth` flips `upgrade_required` back to `valid` so queues drain. Antithesis must not assume that heal while the workload keeps sending `2`.

## Code paths

| Path | Role |
|---|---|
| `pkgs/sync-engine/src/server/sync-protocol-gate.ts` | Header ≠ 3 → `{ error: 'auth', reason: 'upgrade_required' }`. |
| `pkgs/sync-engine/src/client/sync-http-client.ts` | Exact `reason === 'upgrade_required'`; else expired/revoked. |
| `pkgs/sync-engine/src/client/create-local-sync-engine.ts` `handleError` | Not revoked → `online: false`, `lastError`; no `deleteDatabase`. |
| `pkgs/sync-engine/src/client/mutation-upload-queue.ts` `ERROR_DELAY_MS` / `MAX_ERROR_DELAY_MS` / `runLoop` | Generic error backoff; 401 is not `HttpNetworkError`. |
| `pkgs/http-client/src/gate-fetch-until-available.ts` `fetchAndNote` | Any completed Response → `noteSuccess()`. |
| `pkgs/sync-engine/src/sim/system/replay-step.ts` | Settle restores auth so queued mutations can drain. |
| Topology config | One workload command sends `x-sync-protocol: 2`. |

## Failure scenario

1. Alice has a non-empty `sync_engine_mutations` queue (offline mutate, then cut).
2. Workload (or a sidecar) sends `x-sync-protocol: 2` / strips the header on `/mutations` and `/query`. Gate returns 401 `upgrade_required`. Origin `/api/health` stays 200.
3. **Bug if** two failed POSTs of the same pending batch occur < `ERROR_DELAY_MS` apart with no 2xx in between (tight loop via health-ok + `waitUntilAvailable`).
4. **Bug if** a 2xx `applied` ack lands for those ids while the cut is still in effect (false drain).
5. Restore header `3` (or stop forging). **Bug if** after a foreground upload window the pending ids are still un-acked and Postgres never applied them.

Wipe during the cut is `upgrade-required-no-local-wipe` — do not re-assert `deleteDatabase` here except as a pointer.

First topology: same headless image; synthetic header fault; no old-binary, no OPFS. Clock/process faults optional. Two clients unused except as a peer oracle after the cut lifts.

## What goes wrong if violated

No upgrade UI: the user keeps a full local DB and an “offline” status while the client hammers a request that will never succeed (resource) **or** marks the queue applied and drops local-only work (correctness). When the binary is actually upgraded (header 3), a livelocked or false-acked queue never converges. Health-ok makes the storm worse if backoff is skipped.

## SUT instrumentation (all missing)

- `Always` while consecutive mutations responses are `upgrade_required`: pending ids still in local `sync_engine_mutations`; those ids are not newly inserted into `mutations_applied` in that window.
- `Always` — failed mutation POSTs for the same pending batch are ≥ `ERROR_DELAY_MS` apart unless a 2xx ack landed.
- `Unreachable` — `upgrade_required` → `waitUntilAvailable` resolves in tens of ms → POST again while health is 200.
- `Sometimes(sync.upgrade_required.bounded_retry)` — at least two POSTs of the same pending id received `upgrade_required`.
- `Always` after header 3 is restored and HTTP is up: those pending ids are applied (queue empty or `mutations_applied` contains them) and writer domain matches Postgres.
- `Reachable` — protocol gate returned `upgrade_required` (header `2` or missing).

## Open questions

- Should a permanent cut stop retrying after N attempts (park like outbox +365d), or is bounded-forever retry the intended contract until the binary is upgraded? `(needs human input)`

SDK (`existing-assertions.md`): **missing**. Suggested assertions remain new.

### Investigation Log

#### Should a permanent cut stop retrying after N attempts (park like outbox +365d), or is bounded-forever retry the intended contract until the binary is upgraded?

- Examined: `mutation-upload-queue.ts` `ERROR_DELAY_MS` / `MAX_ERROR_DELAY_MS` / `errorAttempts`; `create-local-sync-engine.ts` `handleError`; outbox `failDelivery` park; grep of `upgrade_required` under `apps/` / `libs/` (no upgrade UI, no attempt cap).
- Found: `upgrade_required` is `SyncApiAuthError`, not `HttpNetworkError`. Upload increments `errorAttempts` and waits `2s * 2^n` capped at 60s + jitter, **forever** — no max-attempt park, no `available_at`. SUT `[failure]` already names “uploads retry forever.” Outbox +365d is a different component.
- Not found: an N-attempt stop, a protocol-cut park, or a product comment that the loop should die.
- Conclusion: tagged `(needs human input)` — **code** is bounded-forever retry until header 3. Whether the owner wants an outbox-style park is not in this tree. Property Always stays “≥ `ERROR_DELAY_MS` apart, then drain after header 3,” not “stop after N.”

#### Is header forge on the workload’s client HTTP the only cut, or will setup add a server-side “reject v3” switch?

- Examined: `sync-protocol-gate.ts`; `apps/` / `libs/` for a reject-v3 / protocol override; `deployment-topology.md` config notes; sibling `upgrade-required-no-local-wipe` investigation.
- Found: gate is header-only (`≠ 3` → `upgrade_required`). Topology already says one workload command sends `x-sync-protocol: 2`. No server-side “reject v3” switch in this tree. Alice/bob are the same headless image.
- Not found: an env flag or setup hook that makes the api refuse protocol 3.
- Conclusion: resolved — the only in-tree cut is workload header forge / strip. Property Reachable does not need a server switch.
