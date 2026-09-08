# PBT Audit (Phase 0)

**Date:** 2026-08-24  
**Repo:** `/Users/chrisvouga/gamezilla`  
**Test files walked:** 442 (`*.test.ts` / `*.test.tsx` / `*.spec.ts`)  
**Existing PBT library:** none (no `fast-check`)  
**Existing fuzz:** hand-rolled seeded DST (`SIM_SEED` / `SYNC_SIM_SEED`, Mulberry32 via `createSimAdapters`)

**Scope decision:** convert **Tier 1 + DST (Tier 2)**; decline the rest as Tier 3. Do not attempt to convert ~150 example files into properties.

---

## Seed policy (chosen: b)

- **Default CI / local:** pinned `FC_SEED` (default `424242`) so PBT never looks like flake.
- **Nightly / random:** `PBT_RANDOM=1` omits the pinned seed; root script `test:pbt:random`.
- **Runs:** `PBT_NUM_RUNS` else `10` local / `40` when `CI=true` (default-job extra ≤ ~2 min).
- **Replay:** `FC_SEED=<n> bun test <file>`; for `fc.commands` also capture `path` / `replayPath` from the failure.

## Layout

| Artifact | Path |
|---|---|
| Audit / findings | repo root `PBT_AUDIT.md`, `PBT_FINDINGS.md` |
| Runner + shared arbitraries | `@pkgs/sim/fast-check` (`assertProperty`, `gen`, JSON arbs) |
| Domain arbitraries | co-located under each package’s `tests/arbitraries/` or `test/arbitraries/` |
| Property tests | `*.pbt.test.ts` alongside existing example tests |

Do **not** create a root `test/pbt/` folder. Do **not** add `@fast-check/jest` (bun has no official binding).

## Hard rules

1. Never delete example tests; properties are additive.
2. Do not replace `SimClock` / timers with `fc.scheduler`.
3. Do not claim CRDT commutativity for sync merge (server-authoritative LWW).
4. Do not rebuild `@product/test` UI scripts on `fc.commands`.
5. Do not silently fix production bugs — pin `examples` + log in `PBT_FINDINGS.md`.

---

## Package inventory (counts)

| Package | Files | Dominant style | PBT stance |
|---|---:|---|---|
| `pkgs/sync-engine` | 134 | scenario DST + unit | Tier 1 + DST Tier 2 |
| `pkgs/room` | 53 | sim scenarios + kit | Tier 1 + DST Tier 2 |
| `pkgs/sql-client` | 26 | engine / e2e | mostly Tier 3 |
| `pkgs/ui` | 20 | UI / sx | Tier 3 class |
| `pkgs/matchmaking` | 20 | sim scenarios | DST Tier 2 |
| `libs/spaces` | 20 | unit + sim | Tier 1 (policy/pair) |
| `libs/chess` | 20 | unit + sim | Tier 3 / later |
| `libs/auth` | 13 | unit / integration | Tier 3 |
| `pkgs/sim-console` | 11 | UI / helpers | Tier 3 |
| `product/test` | 10 | example UI DST | Tier 3 (do not convert) |
| `pkgs/ndjson` | 6 | unit | Tier 1 |
| `pkgs/db-schema` | 8 | unit | Tier 1 (type-map) |
| `pkgs/keyword` | 1 | unit | Tier 1 |
| `pkgs/uuid` | 1 | unit | Tier 1 (seeded RNG) |
| `libs/friends` | 1+ | unit | Tier 1 (pair) |
| remaining ~40 pkgs | 1–9 each | mixed | mostly Tier 3 |

---

## Tier 1 — do now (High value, S/M, pure)

| # | File + symbol | Archetype | Property (English) | Current vs gap | Arbitraries | Effort | Value | Risks |
|---|---|---|---|---|---|---|---|---|
| 1 | `pkgs/room/src/hash-room-state.ts` — `hashRoomState`, `canonicalRoomJson` | invariant / metamorphic | Same logical object with different key insertion order hashes equal; arrays remain order-significant; `undefined` → omitted/`null` | Example unit tests; no generative key-order / nested unicode | `jsonValue`, key-permuted objects | S | High | Integer-like string keys sort numerically in JS |
| 2 | `pkgs/sync-engine/src/queries/shared/canonical.ts` — `canonicalJson`, `scopeHash`, `hashQueryTables` | invariant | Key-order independence; rows sorted by `id`; table names sorted | Scenario for scope hash; no unit generative suite | `jsonValue`, `queryTables` | S | High | Align with room sort rules |
| 3 | `pkgs/sync-engine/src/client/push-applied.ts` — `compareCheckpoint`, `isContiguousNext` | invariant | `compare` is a total order on bigint strings; contiguous iff `next === last + 1`; legacy ≥1e15 baseline treated as unknown | Scenario coverage only | `checkpoint`, `legacyCheckpoint` | S | High | Mixed string/bigint fallbacks |
| 4 | `pkgs/keyword/src/keyword.ts` — `isNamespacedKeyword`, `joinKeywordSegments`, `asKeyword` | round-trip / invariant | Valid kebab segments ⇒ join accepted; invalid rejected; `asKeyword` succeeds iff `isNamespacedKeyword` | Example tests | `kebabSegment`, `namespacedKeyword` | S | High | Length / segment-count bounds |
| 5 | `pkgs/ndjson/src/shared/{encode,decode}.ts` — `encodeNdjsonFrame`, `NdjsonStreamDecoder` | round-trip | Encode → arbitrary chunk splits → decode recovers frames | Chunk-split generation thin | `ndjsonFrame`, `chunkSplits` | S | High | SSE `data:` framing |
| 6 | `libs/spaces/.../space-participation-policy.ts` — `decideJoin` | oracle / invariant | Decision table over visibility × host × ACL × friendship; host always allowed | Example table tests; generative holes | `spaceAccessInput` | S | High | Pure — best product ABAC target |
| 7 | `libs/friends/.../canonical-pair.ts` (+ spaces duplicate) — `canonicalUserPair` | commutativity | `pair(a,b)=pair(b,a)`; `otherUserInPair` inverse | Tiny examples | `userId`, distinct pairs | S | High | Drift between friends/spaces copies |
| 8 | `pkgs/uuid/src/seeded-rng.ts` — `createSeededRng` | metamorphic | Same seed ⇒ same `int`/`random` sequence; distinct `fork` labels diverge | Covered via `createSimIds`; no direct suite | `seed` | S | High | Foundation for DST |
| 9 | `pkgs/db-schema/src/core/type-map.ts` — `pgTypeToToken`, `sqlitePhysicalOf` | oracle | Known `ColumnType` maps; unknown UDT → null | Unit examples | `columnType`, adversarial type strings | S | Med | Compat surface |
| 10 | `pkgs/sync-engine/src/shared/topic-map.ts` — `topicsFromWriteCapture` | invariant / idempotence | Topics deduped + code-unit sorted; re-run same capture ⇒ same list | Wake unit tests; no generative multi-table | `writeCapture` | S | High | Deterministic sort required |

---

## Tier 2 — DST (after infra + arbitraries)

| Stack | What it does today | Seed / shrink | Convert to |
|---|---|---|---|
| **sync-engine notes** | `runNotesSeed` + `pickWorkloadAction` / `generateWorkload`; `checkInvariants` per step | `SYNC_SIM_SEED` replay; **no shrink** | `fc.commands` + `asyncModelRun`; reuse invariants as postcondition |
| **room chaos / kit** | `long-chaos-determinism.sim.test.ts` (RNG steps); `runModuleConformance` + `generateCommand` | `SIM_SEED`; no shrink | Add `fc.commands` chaos beside existing; keep same-seed-twice test |
| **matchmaking** | `seeded-workload.sim.test.ts` joins/ticks fingerprint | `SIM_SEED`; no shrink | Short command sequences; fingerprint + no double-match |
| **product/test UI** | Fixed UI driver flows; `openSim` seed often frozen | N/A | **Decline** — keep as example regression scripts |

### DST findings (detail)

1. **Product UI (`product/test`)** — example-based; not a conversion target.  
2. **Sync-engine** — real randomized workload; biggest shrink win via `fc.commands`. Model = tiny safety spec (seq monotonicity, heal-before-assert-converge), not a reimplementation of merge.  
3. **Room** — kit already does seeded fuzz; chaos loop is hand-rolled. Add shrinking commands; do not replace kit in v1.  
4. **Matchmaking** — smaller surface; same pattern.

`fc.scheduler` is **out of scope** unless a specific test has unscheduled Promise races (rare by design).

---

## Tier 3 — declined (as a class)

| Class | Why |
|---|---|
| `@pkgs/ui` / UI driver / snapshots / Solid hooks | Noisy, flaky, not pure correctness |
| `product/test` product UI scenarios | Fixed drivers; seed=1; not action generators |
| Named bug-scenario files in sync-engine/room | Regression documentation — keep; optionally add properties later |
| Hono / Wrangler / live Neon / Bun WebView e2e | I/O / env; not isolated |
| Tautological `defineMutation` wiring | Typechecker already covers |
| Sync merge as CRDT commute | Wrong property (server LWW by arrival) |
| Float room payloads | Forbidden by DETERMINISM.md |
| Glicko raw floats without rounding oracle | Float gotcha; only rounded vectors |

A codebase-wide audit that declines nothing is not an audit — declining UI/e2e/tautology classes is intentional.

---

## Generator inventory (by dependency count)

1. **jsonValue** (acyclic JSON) — room hash, canonicalJson, ndjson payloads  
2. **userId / distinctUserPair** — canonical pair, space access, topics  
3. **kebabSegment / namespacedKeyword** — keyword grammar  
4. **checkpoint / legacyCheckpoint** — push-applied  
5. **queryTables / writeCapture** — hashQueryTables, topic map  
6. **spaceAccessInput** — decideJoin  
7. **ndjsonFrame + chunkSplits** — ndjson round-trip  
8. **WorkloadAction commands** — DST Phase 3  
9. **room chaos commands** — DST Phase 3  
10. **matchmaking join/leave/tick commands** — DST Phase 3  

Zod 4: hand-write from domain types (no maintained Zod-4→fast-check bridge assumed).

---

## Existing test smells

- Hand-rolled DST does not shrink (seed replay only).  
- `product/test` fuzz-across-seeds is weak if `openSim` seed is hardcoded.  
- Many sync scenarios assert “converged / didn’t crash” without a reference model.  
- Some scripts use wall `Math.random` for seed picks (`@io-wall-ok`) — fine for scripts, but nightly PBT must log the seed.  
- Snapshot / UI tests that would pass against a stubbed implementation.

---

## Phase completion log

| Phase | Status | Notes |
|---|---|---|
| 0 Audit | done | this file |
| 1 Infra | done | `@pkgs/sim/fast-check` + catalog `fast-check@^4.9.0` |
| 2 Arbitraries | done | shared in `@pkgs/sim/fast-check`; co-located under room/sync/spaces/friends |
| 3 DST | done | stateful fuzz via `system.explore` / `s.walk` (no `fc.commands`); room chaos; matchmaking workload |
| 4 Tier 1 | done | 13 `*.pbt.test.ts` files, 31 properties, all green |

### Generator statistics (spot-check)

Shared arbitraries construct valid values (no heavy `.filter()`). Spot checks via
property runs show non-trivial coverage for:

- `arbJsonValue` — nested objects/arrays, integer-like keys, unicode
- `arbNamespacedKeyword` — multi-segment prefixes + kebab locals
- `arbNdjsonFrame` — result/error/end mix
- `arbDistinctUserPair` — unequal ids
- Workload `fc.commands` — mutate/offline/online/partition/heal/idle

### Closing summary

- **Candidates found:** ~10 Tier 1 + 3 DST harnesses + large Tier 3 decline set  
- **Converted:** 10 Tier 1 domains + 3 DST suites (31 properties / 13 files)  
- **Declined:** UI / e2e / tautology / CRDT-merge / `@product/test` UI scripts  
- **Bugs found:** none (see `PBT_FINDINGS.md`)  
- **CI time delta:** full PBT suite ~0.5–2s locally; DST subset ~1.6s — well under the ~2 min budget. Default `numRuns` is 10 local / 40 CI; nightly via `bun run test:pbt:random`.
