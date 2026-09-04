# mixed-schema-column-intersect-merge

Focus: Version Compatibility (serialization / missing columns / mixed app versions).

## Why this property

The sync-engine README claims mixed app versions are safe for **reads** via column-intersect merge: extra server columns are ignored; local-only columns are not clobbered. Clients that **write** a new column before server DDL fail upload (infra retry) and must **not** wipe the engine. Pins: `client-ahead-column-mutation-no-wipe`, `client-column-missing-from-server-snapshot-not-clobbered`, `server-snapshot-with-unknown-column-merges-cleanly`, plus unit `merge-snapshot-and-row-images.unit.test.ts` (“color omitted — must not clobber”).

This is the live-fleet version of schema skew: two clients (or client vs server) disagree on `PRAGMA table_info` / snapshot keys for the same table. The merge contract is the only thing that keeps a newer column from being NULLed and a newer server key from crashing an older SQLite.

SUT analysis lists “client-ahead columns overwritten” in the wipe/clobber hotspot. No Antithesis SDK (`existing-assertions.md`: none in the tree). Suggested assertions below are **missing**.

## Code paths

| Path | Role |
|---|---|
| `pkgs/sync-engine/src/client/merge-upsert.ts` L85–93 | `intersectCols`: local schema ∩ **keys present on the row**; “never invent missing keys as NULL” |
| `pkgs/sync-engine/src/client/merge-upsert.ts` L138–187 | `upsertRowsIntersect` groups by column signature; `ON CONFLICT DO UPDATE SET` only those cols |
| `pkgs/sync-engine/src/client/merge-upsert.ts` L45–64, L196–197 | `tableColumns` via `PRAGMA table_info`; empty (unknown table) → skip, no cache of empty |
| `pkgs/sync-engine/src/client/merge.ts` L162–188 | Snapshot merge calls `mergeTable` per table then `rebasePending` |
| `pkgs/sync-engine/src/tests/scenarios/client-column-missing-from-server-snapshot-not-clobbered.sim.test.ts` | Local `color='red'` survives peer body update whose snapshot omits `color` |
| `pkgs/sync-engine/src/tests/scenarios/client-ahead-column-mutation-no-wipe.sim.test.ts` | `setNoteColor` before server DDL: upload does not apply; engine stays mounted; peer hydrates still work |
| `pkgs/sync-engine/src/tests/scenarios/server-snapshot-with-unknown-column-merges-cleanly.sim.test.ts` | Base-schema client ignores server `color` key; row still converges on shared cols |
| `pkgs/sync-engine/src/tests/unit/merge-snapshot-and-row-images.unit.test.ts` L68–92 | Same row: body updates to `v2`, `color` stays `kept`, `server_only` ignored |
| `pkgs/sync-engine/README.md` ~L667–671 | Documented deploy order: server migrate first |

## Failure scenario

Mixed binaries on one account:

1. **Client ahead (local extra column).** Device writes `notes.color` (or any column the server snapshot / peer mutation does not include). A later `ok` snapshot or MQTT row image for that id carries intersecting columns only. If merge binds absent keys as NULL, the local value is clobbered. If the failed upload is treated as revoke, the whole identity DB is deleted (engine wipe).
2. **Server ahead (extra snapshot key).** Server/newer peer includes a column the lagging SQLite does not have. If merge interpolates unknown idents into `INSERT`, SQLite throws and the merge transaction aborts — hydration stalls or the engine looks “dead.” Intersect by `PRAGMA table_info` is the claimed guard.

Antithesis should keep both binaries talking through real HTTP/MQTT under loss, reordering, and `not_modified` vs full snapshot interleavings. Sim pins heal the mesh before assert; the interesting failures are mid-fault merges.

## Key observations

- Intersection is **key-presence**, not JSON-null. A snapshot that explicitly sends `"color": null` **would** update the local column. The no-clobber claim is “omitted key,” not “null is ignored.”
- `withManagedDefaults` fills `id` / `created_at` / `updated_at` when those local cols exist and the row omits them. That can invent timestamps on partial images; it does not invent domain cols.
- Client-ahead **writes** are not forward-compatible on the server: `isLiveNote(server, 'ahead')` is false in the pin. The safety claim is local durability + engine health, not cross-version write replication.
- `tableColumns` caches per `SqlClient` but refuses to cache empty — mid-life ADD COLUMN can become visible. A stale non-empty cache after a same-connection migrate would skip a new local column (would then look like “not clobbered” by accident, or fail to write it on merge).
- Engine-not-wipe is a different predicate from merge: upload errors go through `handleError` → wipe only if `isAuthRevoked`. A schema mismatch must stay a retryable / rejected mutation, not `revoked`.

## Instrumentation (all missing)

- `Always` after each `upsertRowsIntersect`: for every local column not in the incoming key set, the stored value equals the pre-merge value.
- `Always` after merge of a row containing unknown keys: `PRAGMA table_info` still lacks those names (no accidental ALTER).
- `AlwaysOrUnreachable` on client-ahead mutation: if upload did not apply on the server, `deleteDatabase` was not called and `status` is still defined.
- `Reachable`: at least one merge where incoming cols ⊊ local cols, and one where incoming cols ⊋ local cols.

## Open questions

None remaining after the investigation below.

### Investigation Log

#### Does omitted-key merge skip the local column or write NULL?

- Examined: `intersectCols`, `upsertRowsSameCols` assignments, unit test L68–92, sim `client-column-missing-from-server-snapshot-not-clobbered`.
- Found: only `hasOwnProperty` keys that also exist on the local table are in the `INSERT … ON CONFLICT DO UPDATE` column list. Omitted `color` stayed `red` / `kept` in pins.
- Not found: a second upsert path that expands rows to the full local schema with NULLs.
- Conclusion: the no-clobber claim matches the intersect implementation for omitted keys.

#### Does a client-ahead write wipe the engine?

- Examined: `client-ahead-column-mutation-no-wipe.sim.test.ts`; `handleError` / `isAuthRevoked`.
- Found: pin asserts engine `status` still defined, `color` column still on `notes`, and a peer mutate still paints. Product wipe is revoke-only.
- Conclusion: claimed “no wipe” is the error-classification path, not merge. Include it as a sibling Always on this property.

#### Explicit JSON null vs omitted key?

- Examined: `intersectCols` (`hasOwnProperty`); unit test omits `color` rather than sending null.
- Found: a present key, including `"color": null`, enters the UPDATE list and would overwrite the local value. The no-clobber contract is omitted-key only.
- Conclusion: resolved — property invariant is “omitted keys are not bound,” not “null is ignored.”

#### Do MQTT row images use a different upsert?

- Examined: `merge.ts` `applyRowImages` L221–258 (`same upsert + rebase path as a full snapshot merge`).
- Found: pushes call `mergeTable` → `upsertRowsIntersect`. Push skips invalid ids; snapshot does not. Column intersect is shared.
- Conclusion: resolved — one merge function for both wires.

#### Instrumentation vs `existing-assertions.md` (2026-09-01 re-check)

- Examined: `antithesis/scratchbook/existing-assertions.md` (HEAD scan: no `@antithesis` / SDK assert APIs in `apps/`, `libs/`, `pkgs/`, `sim/`).
- Found: still no Antithesis SDK. Every suggested Always / AlwaysOrUnreachable / Reachable above remains **missing**.
- Not found: a partial SUT-side assertion that this file should have credited.
- Conclusion: instrumentation status unchanged — all missing.
