---
sut_path: /Users/chrisvouga/gamezilla
commit: ddde94db466ae77df20385c54ead0c79ae20b2c8
updated: 2026-09-01
external_references: []
---

# Existing Antithesis SDK Assertions

## Summary

The Gamezilla product and framework code has **no Antithesis SDK instrumentation**.

Searched for:

- Package imports: `@antithesis`, `antithesis-sdk`, `github.com/antithesishq/antithesis-sdk-*`
- Assertion APIs: `assertAlways`, `assertSometimes`, `assertReachable`, `assertUnreachable`, `assert_always`, `assert_sometimes`, `assert_reachable`, `assert_unreachable`, `assert_always!`, `assert_sometimes!`
- `package.json` / lockfile mentions of Antithesis SDKs

No matches in `apps/`, `libs/`, `pkgs/`, or `sim/` product or test code.

## False positives (not Antithesis)

| Location | What it is |
|---|---|
| `sim/console/src/sim/sim-net.ts` `assertReachable` | In-process sim network helper: asserts a mesh edge exists between two node ids. Not an Antithesis SDK call. |
| `sim/console/src/sim/create-sim.ts` `net.assertReachable(id, 'server')` | Call site of that helper. |
| `.agents/skills/antithesis-*` | In-tree Antithesis *research/setup/workload skills*, not SUT instrumentation. |

## In-house substitutes (not portable to Antithesis)

The repo already encodes many of the same *ideas* as Antithesis properties, but they live in `@pkgs/determinism` system worlds and named `*.sim.test.ts` pins:

- Sync-engine DST invariants: `seq-monotonicity`, `permanent-vs-transient-verdicts`, `push-seq-monotonic-per-topic`, `checkpoint-monotonic-per-scope` (`pkgs/sync-engine/src/sim/invariants.ts`, `invariant-tracker.ts`).
- Room DST invariants: `log-seq-contiguity`, `live-vs-log`, `command-id-dedup-stable`, `durable-queue-matches-memory` (`pkgs/room/src/sim/invariants.ts`).
- Auth system invariants: live sessions have `externalUserId` (`pkgs/auth/src/tests/system/invariants.ts`).
- `until` / `never` / `assertConverged` in the determinism harness.

These run in-process against a virtual clock and in-memory mesh. They are **oracles to port**, not existing Antithesis assertions. All suggested SUT-side or workload assertions in property evidence files should be treated as **missing**.

## Assumptions

- HEAD at analysis time is `ddde94db466ae77df20385c54ead0c79ae20b2c8`. The working tree also has uncommitted changes (auth, db-indexes, sync notify paths). None of those introduce an Antithesis SDK.
- A Hegel skill exists under `.agents/skills/hegel/` and claims Hegel tests can emit Antithesis assertions. Product tests use `@pkgs/determinism` / `@pkgs/pbt`, not Hegel.

## Open Questions

- None for the scan itself. Whether to instrument the SUT (TypeScript SDK in sync-engine / room / auth) vs workload-only is a topology/workload decision.
