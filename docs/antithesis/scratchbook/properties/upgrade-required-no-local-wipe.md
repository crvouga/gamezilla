# upgrade-required-no-local-wipe

Focus: Version Compatibility (protocol negotiation).

## Why this property

Sync HTTP is a hard cut at `x-sync-protocol: 3` (`SYNC_PROTOCOL_VERSION` in `pkgs/sync-engine/src/protocol/v2.ts`; file still named `v2.ts`). The server gate (`assertSyncProtocol`) treats any missing, non-numeric, or non-3 header as `{ error: 'auth', reason: 'upgrade_required' }` on **401**. Comments, CONTRACTS cutover runbook, and AGENTS.md all claim this is **not** a revoke: local SQLite must stay intact so a later binary upgrade can preserve-and-drain `sync_engine_mutations`.

SUT analysis A5: clients that treat every `error: 'auth'` as revoked would violate the claim. Protocol mismatch is classified as auth — that is the footgun.

No Antithesis SDK exists (`existing-assertions.md`). In-sim substitutes: `old-client-rejected-at-cut.test.ts`, `auth-revoked-wipes-db-expired-refreshes.sim.test.ts` (`upgrade_required rejects without wiping local rows`), `schema-drift.pbt.test.ts` (`protocolCut rejects without wiping then heal converges`). Those run on a virtual auth knob, not a real old binary speaking v1/v2 on the wire.

## Code paths

| Path | Role |
|---|---|
| `pkgs/sync-engine/src/protocol/v2.ts` L10–12, L95–113 | `SYNC_PROTOCOL_VERSION = 3`, `SYNC_PROTOCOL_HEADER = 'x-sync-protocol'`, `AuthErrorBody.reason` includes `upgrade_required` |
| `pkgs/sync-engine/src/server/sync-protocol-gate.ts` L8–13 | `Number(header) === 3` else `{ error: 'auth', reason: 'upgrade_required' }` |
| `pkgs/sync-engine/src/server/sync-app-query-routes.ts` L52–53 | Gate before auth; `c.json(protocolErr, 401)` |
| `pkgs/sync-engine/src/server/sync-app-mutations-route.ts` L246–247 | Same gate on `POST /mutations` |
| `pkgs/sync-engine/src/client/sync-http-client.ts` L180, L227–237 | Client always sends current version; 401 with `reason === 'upgrade_required'` → `SyncApiAuthError('upgrade_required')`; other 401s → `revoked` only if `reason === 'revoked'`, else `expired` |
| `pkgs/sync-engine/src/client/create-local-sync-engine.ts` L164–174, L351–361 | `handleError` calls `revokeDatabase` → `deleteDatabase()` **only** when `isAuthRevoked(error)` |
| `apps/client/src/sync/create-local-sync-engine.ts` L220–221 | Product host: `isAuthRevoked` is `error.reason === 'revoked'` only |
| `pkgs/sync-engine/src/sim/system/dispatch.ts` L160–162 | DST `protocolCut` sets sim auth to `upgrade_required` (does not send a stale header) |
| `pkgs/sync-engine/CONTRACTS.md` §8 | Cutover runbook: header ≠ current → `upgrade_required`, no local wipe; pending queue preserve-and-drain |

## Failure scenario

A lagging binary (missing header, `1`, or `2`) or a forged/truncated header hits `/api/query` or `/api/mutations` while the device still has unsynced domain rows and a non-empty `sync_engine_mutations` queue. If the client maps that 401 onto the revoke wipe (`clearLocalData({ reason: 'revoked' })` / `deleteDatabase`), the install loses local-only work. Antithesis value is mixed-version processes plus kill/partition during the 401 → error-classify → optional wipe window — not the unit gate itself.

## Key observations

- Gate is header-only. There is no body `protocol` field check on the query batch; a current header with a v2-shaped body would not trip this property.
- `Number('')` / missing header is `NaN`, which is not `3` → upgrade_required. That matches the unit pin.
- Wipe is host-injected (`isAuthRevoked` + `deleteDatabase`). Product and sim both treat only `reason === 'revoked'` as wipe. A third host that checks `error: 'auth'` or any 401 would break the claim without changing the engine.
- `apps/` and `libs/` have **no** `upgrade_required` UI. After the 401, `handleError` sets `online: false` and `lastError`; uploads keep retrying (sut-analysis: “uploads retry forever”). That is a liveness/UX issue, not this safety property.
- DST settle (`restoreSettleAuth`) flips `upgrade_required` back to `valid` so queued mutations drain. Antithesis must not rely on that heal if the check is “DB still there after the 401.”
- Suggested SUT instrumentation: **missing**. A `Reachable` on the gate returning upgrade_required, and an `Always` immediately before `revokeDatabase` that the triggering error’s reason is `revoked` (never `upgrade_required`), would catch a host wiring bug.

## Open questions

None. SDK missing (`existing-assertions.md`).

### Investigation Log

#### Does the product client wipe on upgrade_required?

- Examined: `apps/client/src/sync/create-local-sync-engine.ts` `isAuthRevoked`; `create-local-sync-engine.ts` `handleError` / `revokeDatabase`; grep of `upgrade_required` under `apps/` and `libs/` (zero UI matches).
- Found: wipe predicate is `reason === 'revoked'` only. `upgrade_required` is a distinct `SyncApiAuthError` reason and does not enter `revokeDatabase`. No product upgrade screen.
- Not found: a second product host that remaps 401s.
- Conclusion: product wiring matches the claimed no-wipe path. Property still tests the claim under faults / alternate hosts.

#### Does a malformed 401 get classified as revoked?

- Examined: `sync-http-client.ts` L227–237.
- Found: `upgrade_required` is an exact string match; anything else including missing `reason` becomes `expired`, which does not wipe.
- Conclusion: the A5 “every auth is revoked” failure needs a host bug, not the stock HTTP client.

#### Other isAuthRevoked hosts besides apps/client and the sim?

- Examined: grep of `isAuthRevoked` / `SyncApiAuthError` under `apps/`, `libs/`, `pkgs/sync-engine`, `product/`.
- Found: product wiring in `apps/client/src/sync/create-local-sync-engine.ts`; sim in `client-factory-parts.ts`. Both require `reason === 'revoked'`.
- Not found: a third host that remaps all `SyncApiAuthError` to wipe.
- Conclusion: resolved for this tree. Topology question about an old-protocol *binary* remains.

#### Can the topology run a second client image that sends protocol 2, or only header faults?

- Examined: `antithesis/scratchbook/deployment-topology.md` containers + config notes; no other client Dockerfile / mixed-version image in this tree.
- Found: alice/bob are the **same** headless client image. Topology config already says one workload command should send `x-sync-protocol: 2`. No third client, no old-binary image.
- Not found: a plan for a second image that omits the header or speaks v1/v2 as a real lagging process.
- Conclusion: resolved — Reachable “old client” is synthetic (workload header `2` / strip/rewrite). Property still holds; does not require a mixed-version binary.

## Synthesis merge (orchestrator)

Also covers: `protocol-cut-not-revoked`, `protocol-v3-cut-no-local-wipe`.

Same gate, same product `isAuthRevoked === reason === 'revoked'`. Protocol archaeology (wire v3 in `protocol/v2.ts`) is context, not a second invariant.
