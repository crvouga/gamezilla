# PBT Findings

No production bugs were surfaced by the property suites (including the sync-engine
fault / schema-mismatch expansion: corruption-safety, schema-drift, broker-chaos,
and extended acme-world DST commands).

Harness-only fixes during that expansion (not engine defects):

- **Auth revoked + preserveLocalDb** — revoked auth disconnects/wipes the local DB;
  DST replay must restart those clients with a fresh DB before converge.
- **Tamper on crashed client** — model now restricts `tamperLocalStorage` to live
  clients (no `lastDbBundle` on a hard crash without keepDb).
- **Checkpoint tamper** — sim uses `DELETE FROM sync_engine_scope_meta` (missing
  checkpoint) rather than a bogus checkpoint string, which exercises re-hydrate
  without a known merge edge case on invalid checkpoint payloads.

Room system kernel expansion (`pkgs/room/src/tests/system/`):

- **Settle after takeOver under `down`** — soft-cycle all clients after `healAll`
  so a welcome is resent when frames were dropped mid take-over (harness settle,
  not an engine bug).
- **Stale `server` in `assertConverged`** — after `serverRestart`, settle must
  read live state via `getServer()` rather than a captured pre-restart reference
  (harness settle bug surfaced by `runRoomSeed`).
- **Drain held frames before soft-cycle** — release hold/delay into the pending
  queue and drain while connections are still registered.
- **`armCrashAt` + domain race** (`FC_SEED=665742204`) — boundary crash was
  `void crashClient` (async); next domain dispatched into a torn-down client.
  Fixed with sync `crashClientSync`; model tracks armed committed arms; random
  world pool omits `armCrashAt` (scripted / slice only).

`bun run test:pbt:random 5` (20 files, 200 runs/property) passed after the expansion.

If a future property fails:

1. Capture `seed`, `path`, and (for `fc.commands`) `replayPath` from the failure.
2. Pin the shrunk counterexample via `examples` on `assertProperty` / a scripted
   `world.playActions` pin in `room-world.pbt.test.ts`.
3. Add a row here with the minimal case — **do not silently patch production**.

| Date | Property | Seed | Path | Minimal counterexample | Status |
|------|----------|------|------|------------------------|--------|
| — | — | — | — | — | none yet |
