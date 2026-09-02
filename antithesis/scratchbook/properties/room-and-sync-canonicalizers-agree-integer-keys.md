# room-and-sync-canonicalizers-agree-integer-keys

Focus: Wildcard (two hashers). Confidence: medium.

Existing Antithesis SDK: **missing**. All suggested assertions are new.

Room Data Integrity / room live-vs-log will assert `hash(state) === fold(log)` using **one** hasher (`hashRoomState`). Sync will assert checkpoint / `hashQueryTables` stability using **another** (`canonicalJson`). Neither focus compares the two algorithms. `PBT_AUDIT.md` already flags “integer-like string keys sort numerically in JS” for room hash and “align with room sort rules” for sync. `DETERMINISM.md` says integer-like keys on plain objects sort numerically ahead of other keys and forbids iterating `Object.keys` for hashing without an explicit sort.

## Why this property

Two public canonicalizers exist for “same bytes for the same logical object”:

| Function | Package | Sort | Digest |
|---|---|---|---|
| `canonicalRoomJson` / `hashRoomState` | `@pkgs/room` | `Object.keys(obj).sort()` then `JSON.stringify` | FNV-1a 64-bit of UTF-16 code units |
| `canonicalJson` / `scopeHash` / `hashQueryTables` | `@pkgs/sync-engine` | Identical `sortValue` | SHA-256 of UTF-8 |

A third cousin, `canonicalJsonStringify` in `@pkgs/determinism`, also uses `Object.keys(value).sort()`.

Default `Array.sort()` is **lexicographic** UTF-16 (`"10" < "2"`). JS **enumeration** of integer-like keys is **numeric** (`"2"` then `"10"`). Both room and sync re-sort, so they **currently agree with each other** and **disagree with raw `Object.keys` order**.

If one hasher is later “fixed” to numeric sort (reading DETERMINISM.md’s enumeration warning as a sort rule) and the other is not, then:

- Room reconnect hash ≠ fold on a replica that used the other rule (or a different JS engine that exposed a path without `.sort()`).
- Sync `hashQueryTables` / `scopeHash` would not match a room-side digest of the same JSON (oracles become incomparable).
- Room seats are a `Record<memberId, Seat>`. Member ids are UUIDs today (not integer-like). Chess / counter attrs could still grow integer-like keys (`"2"`, `"10"`). `hashQueryTables` stringifies each row through the same `sortValue`.

Antithesis value is not “run a unit test.” It is: under real engines (Hermes vs V8 vs Bun) and after reconnect/hibernate restore, **the same object must not hash two ways** if both libraries are asked to canonicalize it. A workload fixture with keys `"2"` and `"10"` is enough.

## Code paths

| File | Role |
|---|---|
| `pkgs/room/src/hash-room-state.ts` `sortValue` / `canonicalRoomJson` / `fnv1a64Hex` | Room reconnect / anti-cheat / `RoomModule.hash`. |
| `pkgs/sync-engine/src/queries/shared/canonical.ts` `sortValue` / `canonicalJson` / `hashQueryTables` | Scope hash, snapshot content hash. Row ids sorted with `String` compare, not numeric. |
| `pkgs/determinism/src/json.ts` `canonicalJsonStringify` | Sim traces / knobs — third copy. |
| `libs/spaces/src/shared/space/space-members/space-members-messages.ts` | Seats map hashed as part of `RoomState`. |
| `PBT_AUDIT.md` rows 1–2 | Explicit risk: integer-like keys; align room vs sync sort. |
| `DETERMINISM.md` “Object key ordering” | Enumeration is numeric-first; hashing must sort. |

Room and sync `sortValue` bodies are copies (undefined → null, arrays keep order, null prototype). They are not imported from one module. Drift is a one-line edit.

## Failure scenario

1. Workload (or SUT self-check) builds `{ "10": 1, "2": 2, a: 3 }` (and nested copies).
2. `canonicalRoomJson` vs `canonicalJson` vs `canonicalJsonStringify` must be **identical strings**.
3. After a room reconnect, `hashRoomState(live)` vs `hashRoomState(fold(log))` must match **and** `canonicalRoomJson(live)` must still equal `canonicalJson(live)` for the attribute object.
4. **Bug if** one path starts using `Object.keys` without `.sort()`, or sorts with `Number(key)`, or uses `localeCompare`. Hermes vs V8 would then disagree on the same logical seats/attrs.

Integer-like keys on **row `id`** in `hashQueryTables` use `String` `<` / `>` — `"10" < "2"` is true. A numeric sort there would change snapshot hashes across versions (Version Compatibility adjacent). This property only requires **the two object-key canonicalizers** to stay aligned; row-id sort is a documented sync rule.

## Invariant (checkable)

For any JSON object the SUT hashes (room state, or a cloned room state passed through `canonicalJson`):

- `canonicalRoomJson(x) === canonicalJson(x)` (same string, not just same digest).
- Key order in that string for integer-like keys is the **lexicographic** `.sort()` order (`"10"` before `"2"`), unless both functions are changed **together**.
- `hashRoomState` is a pure function of `canonicalRoomJson` (FNV of that string).

`Always` on a fixture (and on live `RoomState` snapshots sampled at welcome/sync). `Reachable` when a hashed object actually contains an integer-like key (otherwise the Always is vacuous for the interesting case). Do **not** use `Sometimes(true)`.

This is a safety property on the canonicalizers, not “room hash equals sync snapshot hash” (different payloads, different digests).

## Suggested SUT instrumentation (all missing)

- `Always("hash.canonical.room_eq_sync")` in a tiny shared helper called from room welcome **and** from a sync self-check: `canonicalRoomJson(sample) === canonicalJson(sample)` for `sample` including `{10:1,2:2}` (number keys become `"10"` / `"2"`).
- `Reachable("hash.canonical.integer_like_key_present")` when `RoomState` or a query row object has a key matching `/^\d+$/`.
- `Always("hash.room.live_eq_fold")` stays the room invariant; this property is the **cross-library** clause.

No SDK exists today. Room DST `live-vs-log` is an in-house oracle, not this comparison.

## What goes wrong if violated

Reconnect / anti-cheat rejects a faithful fold (“hash mismatch”). Or two clients on different JS engines accept different “equal” states. Sync checkpoint hashes would not be a safe stand-in if anyone compared them to room hashes. PBT that assumed one sort rule would not transfer.

## Open questions

- Should the three copies be one module? Out of scope for the property; the Always still holds if they stay duplicated.
- Do product room attrs ever use integer-like keys today? Seats use UUIDs. If never, the Reachable may stay silent in product traffic — keep the fixture Always so the property is not vacuous.
- `hashQueryTables` row-id sort is a separate rule. Do not fold it into “canonicalizers agree” without an explicit decision.

## Assumptions

- Digests (FNV vs SHA-256) are allowed to differ; only the **canonical string** / key order must match.
- Not a test-harness property: the functions run in production reconnect and query hashing.
