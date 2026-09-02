---
sut_path: /Users/chrisvouga/gamezilla
commit: ddde94db466ae77df20385c54ead0c79ae20b2c8
updated: 2026-09-01
external_references: []
---

# Property evaluation synthesis

Scope answer: **"Just this directory"**. Lenses: `antithesis-fit.md`, `coverage-balance.md`, `implementability.md`, `wildcard.md`. Categorization is this file's job.

## Actions taken

| Category | Action |
|---|---|
| Refinement | Lowered topology-blocked / unit-shaped cards out of the first-pass body: `web-sync-owner-single-uploader`, `room-single-log-per-topic`, `mutation-actor-from-session-only` → deferred table. |
| Refinement | Aligned catalog SHA with analysis/topology (`ddde94db…`). |
| Refinement | MEMORY-journal, mqtt-http oracle, health-200 overlapping boot, mutation-id race rollback — already tightened during investigation; left as-is. |
| Gap | Added High liveness: `expired-token-refresh-then-drain`, `oauth-consume-orphan-no-client-session`, `api-remake-foreground-query-applies`, `upgrade-required-retry-bounded`. |
| Gap | Added High/Medium safety: `rejected-write-still-paints-optimistic`, `own-ack-optimistic-body-no-flicker`, `outbox-exhausted-park-not-delivered`; promoted `presence-online-matches-room-actor-id`. |
| Bias | Escalated to the user (below). Not resolved in the catalog. |

Chess-in-a-space / “puzzle solved then not” was **not** added: first topology’s in-process RoomServer is heap memory; api kill wipes the log (wildcard F2). A room-status monotonicity card would be misleading until setup persists room storage.

## Findings

### Refinements

| Finding | Source | Applied |
|---|---|---|
| Auth 401 classify-then-wipe is mostly a parser test; High overstated | fit F1 | Kept `upgrade-required-no-local-wipe` Medium-adjacent in the auth section (still cataloged) and added the liveness complement instead of hunting interleavings on the parser. |
| `mutation-actor-from-session-only` is unit/forged-envelope | fit F2 | Deferred. |
| `unclassified-401-defaults-expired` Always on `revoked` wipe may never be encountered | fit F4 | Product still never emits `revoked`; left Always on non-revoked bodies; revoked wipe is `AlwaysOrUnreachable` in evidence. |
| `room-single-log-per-topic` split-brain Unreachable in first topology | fit F7, coverage F6, impl | Deferred. |
| `web-sync-owner-single-uploader` not in Node topology | coverage F12, impl | Deferred (was Medium in the body). |
| Expo wipe vs Node fail-closed | fit uncertainty, impl | Catalog invariant already splits Node vs Expo. |
| Catalog SHA drift | all lenses | Fixed to `ddde94db…`. |
| Mixed-schema two-binary half not in first topology | impl | Left Medium; omitted-key merge is also `lww-merge-no-wipe-clobber`. Client-ahead extra column needs a later two-image topology. |

### Gaps (filled)

| Finding | Source | New / promoted slug |
|---|---|---|
| Expired token then drain | coverage F5 | `expired-token-refresh-then-drain` |
| OAuth consume then no client session | coverage F4, wildcard A3 | `oauth-consume-orphan-no-client-session` |
| Checkpoint freeze after api remake | coverage F1, wildcard A5 | `api-remake-foreground-query-applies` |
| `upgrade_required` retry forever | wildcard A4 | `upgrade-required-retry-bounded` |
| Painted success after permanent reject | wildcard A2 | `rejected-write-still-paints-optimistic` |
| Own-ack flicker | coverage F10, wildcard A6 | `own-ack-optimistic-body-no-flicker` |
| Presence identity (not privilege) | wildcard F3 | `presence-online-matches-room-actor-id` |
| Outbox park +365d | coverage F3 | `outbox-exhausted-park-not-delivered` |

### Gaps (not filled — with reason)

| Finding | Reason |
|---|---|
| Chess / puzzle-solved monotonicity | Requires durable room log; first topology wipes RoomServer on api kill. |
| Topic-subscribe-waits-for-drain | Second-wave; needs membership churn workload. |
| `POST /friends/search` / anon-ensure idempotency | Quiet packages; lower Antithesis uniqueness. |
| Connect/publish unbounded waiters | Assertion type invented a settle contract; left deferred as Reachable-shaped resource cards. |

### Biases (need a human)

These are orientation problems evaluation can name but not pick.

1. **Pin-port vs product-failure folio.** Discovery followed in-tree DST pins (LWW, `pushSeq`, mutation-id). SUT analysis ranks **chess-in-a-space** and “confirmed then contradicted” (puzzle solved then not). Wave 1 as written is “port the sim under real sockets,” not “the game is consistent.” Filling chess requires **persistent room storage** (not in-memory `RoomServer`).

2. **In-process ephemeral rooms vs production Durable Objects.** Production persists `room.do.v3.*`. The planned `api` container shares fate with an in-memory log. Enabling process-kill (required for lost-ack / MEMORY-journal) **erases** seats and puzzle state. Setup must either persist room storage or accept that room High cards do not survive api death.

3. **Two clients vs four identity pairings.** alice/bob cannot simultaneously be same-actor, friends, strangers, and anon→Google. Workload must re-role sequentially; paper pairings are not coverage.

4. **Headless Node vs Expo / Worker-shaped Highs.** MEMORY wipe-on-corrupt, CF boot latch, Web Locks, OPFS are not this image. Footnotes know this; a green Node run is not A11 Expo wipe.

5. **Always-after-heal is sim settle.** Oracles assume foreground + 30s tick. Product backgrounds. Treat background-during-partition as a default timeline, not a precondition you disable so Always can fire.

6. **Workload observability.** Topology draws postgres ↔ api only. Checking `mutations_applied` / IdP sessions needs a postgres punch-through, debug GETs, SDK, or impersonating `POST /api/query`. Headless clients need a command/probe surface that does not exist yet.

## Remaining human-input questions (from catalog)

- Future revoke: sync 401 `reason: 'revoked'` vs a dedicated channel (`unclassified-401-defaults-expired`).
- Device-drift host rewrite of `host_account_id` (`private-space-join-requires-acl`).
- No-bearer `anonId` UUID-only? (`room-gateway-fallback-not-host`).
- Outbox intended at-most-once vs at-least-once + idempotent handlers.
- Dual-room topology later? (deferred `room-single-log-per-topic`).
- Lost 200 after `createSession`: leave unused `idp_sessions` live?
- `upgrade_required`: park after N vs forever 2s…60s retry.
- Outbox park: shorten `maxAttempts` in the Antithesis image so park is reachable without eight backoffs?

## Setup implications (for `antithesis-setup`)

- Enable **process termination** faults.
- Workload → postgres or equivalent oracle.
- Probe API on both clients (mutate + SQLite snapshot).
- Persist room storage **or** document that room cards do not survive api kill.
- Fake Google / oauth-dev remint for expired-token and OAuth-orphan.
- Shorten `QUERY_RECONCILE_INTERVAL_MS` or size `eventually_` > 30s.
- Optional: TypeScript SDK in notify-channels, replay-mutation, attach-push-handle, consumeExchangeCode, drain, health vs boot.
