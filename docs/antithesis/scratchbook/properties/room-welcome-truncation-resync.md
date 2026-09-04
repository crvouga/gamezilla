# room-welcome-truncation-resync

Focus: Protocol Contracts. Lead: room wire `v = 1`; `MAX_WELCOME_ENTRIES_PER_FRAME = 512`; server may send a **prefix** of the log while advertising the true tip in `lastSeq`. Client must not mark synced until applied `lastSeq` equals welcome `lastSeq`.

## Claim

A `welcome` frame is not a complete snapshot just because it parsed. `entries` may be truncated. `lastSeq` is the log tip (last loaded event, or `getLastSeq` when the load is empty). The client applies a contiguous suffix, then `sendSync` from its new `lastSeq` until `host.lastSeq === msg.lastSeq`. Treating `entries.length` as “fully caught up,” or trusting `lastSeq` without applying / requesting the rest, leaves live state behind the Durable Object log.

Wrong `v` is not a negotiated upgrade: `parseServerToClientWire` / `parseClientToServerWire` return `null` if `v !== 1`. Frames are dropped. There is no room equivalent of sync `upgrade_required`.

## Code paths

- `pkgs/room/src/protocol/wire.ts` — `WIRE_VERSION = 1`. Parse requires `raw['v'] === WIRE_VERSION`. Welcome fields: `fromSeq`, `lastSeq`, `entries`.
- `pkgs/room/src/bounds.ts` — `MAX_WELCOME_ENTRIES_PER_FRAME = 512`. Comment: truncated welcome; client catch-up via `sync`.
- `pkgs/room/src/server/core/room-server-fanout.ts` `sendWelcomeFrame` — load `all` after `fromSeq`; `tip = all[all.length-1].seq` or `getLastSeq` if empty; `entries = all.slice(0, 512)` if over cap; send welcome then roster. Errors become `rejected` with `commandId: '__welcome__'`.
- `pkgs/room/src/client/core/room-client-wire.ts` `applyWelcomeWire`:
  - suffix = entries with `seq > host.lastSeq`;
  - non-contiguous suffix or `serverBehind` → reset + `sendSync`;
  - `behindWithoutEntries` (empty entries but `lastSeq > host.lastSeq`) → `sendSync` (and assert if both sides claim 0 / tip mismatch);
  - after apply, if `msg.lastSeq !== host.lastSeq` → **partial welcome** — save, rebuild optimistic, `sendSync`, do **not** `setSynced(true)`;
  - only equality sets synced and flushes outbound.
- `pkgs/room/src/client/core/room-client.ts` — `sendSync` uses `fromSeq: this.lastSeq`. `onOpen` always syncs. Unparseable frames (`v !== 1`) are ignored (`parse … === null` → return).
- Pins: `room-server-welcome.test.ts` (lastSeq matches tail even when `getLastSeq` is wrong); `stale-welcome-recover.sim.test.ts` (empty tip-only welcome → resync); `room-server-reset.test.ts` (stale/behind/duplicate welcomes).

## Failure scenario

A space with >512 committed events (or a client syncing from 0 after a long offline) receives welcome `{ lastSeq: tip, entries: first 512 }`.

- **Correct:** client applies 1..512, sees `lastSeq` still ahead, syncs `fromSeq=512`, repeats until tip, then `synced`.
- **Violation A:** client sets synced when `entries.length > 0` and ignores `lastSeq`. Live hash ≠ log fold. Commands enqueue against a short state.
- **Violation B:** server sets `lastSeq` to the last **sent** entry instead of the log tip (easy bug if someone “fixes” the truncated frame to look consistent). Client believes it is at tip; tail events never requested.
- **Violation C:** `getLastSeq` disagrees with `loadEventsAfter` on an empty batch (`BrokenGetLastSeqStorage` fixture). Empty welcome with a lying `lastSeq` either asserts or loops `sync(fromSeq=0)`.
- **Violation D:** a v=2 frame (or truncated JSON missing `v`) is dropped. Client stays unsynced with no protocol-cut signal — unlike sync HTTP’s `upgrade_required`.

Room README “Tiger Style” also says “Fail loudly on bad wire (unknown `kind` / version)” but the parser **silently returns null**. That is a documented-vs-implemented protocol gap.

## Why Antithesis

Sim loopback delivers whole welcomes without WS frame size limits. Antithesis can grow a log past 512, kill the DO/process mid-welcome, duplicate/reorder welcome vs committed, or inject a v≠1 frame. Partial welcome + reconnect storm is the interesting interleaving (`down-during-welcome.sim.test.ts` already admits “may or may not be synced”).

## Instrumentation

`existing-assertions.md`: no Antithesis SDK. Suggested assertions are **missing**:

- `Always`: `setSynced(true)` only when applied `lastSeq ===` last welcome `lastSeq`.
- `Always`: if welcome `entries.length === MAX_WELCOME_ENTRIES_PER_FRAME` and `lastSeq > last(entries).seq`, a `sync` with `fromSeq >= last(entries).seq` is sent.
- `Unreachable`: `setSynced(true)` on a welcome whose `lastSeq` ≠ fold of applied committed entries.
- `Reachable`: truncated welcome (entries cap hit) and a v≠1 drop.

In-house substitutes: room DST `log-seq-contiguity`, `live-vs-log`, `client-lastseq-equals-server-tip` (post-converge, after heal).

## Open questions

- None

### Investigation Log

#### Is `lastSeq` the log tip or the last entry in the (possibly sliced) array?

- Examined: `sendWelcomeFrame` tip computation vs `entries` slice; `applyWelcomeWire` partial branch.
- Found: tip is computed from the **unsliced** `all` (or `getLastSeq` if empty). Slice is send-only. Client treats `lastSeq !== host.lastSeq` as “ask for the rest.”
- Conclusion: resolved — the contract is tip-in-`lastSeq`, prefix-in-`entries`. Property fails if either side “normalizes” them to match.

#### What happens on `v !== 1`?

- Examined: `parseClientToServerWire`, `parseServerToClientWire`, `RoomClient.onWire`.
- Found: `null` → ignore. No `upgrade_required`, no rejected frame.
- Not found: a version-negotiation or loud-fail handler on the client.
- Conclusion: tagged partial — README “fail loudly” is not implemented on the parse path; property should still require silent drop not to mutate log/state.

- Re-investigation 2026-09-01. Examined: `RoomClient.onWire`; `apps/server/src/room/route.ts` (gateway does not inspect frame `v`); DO `webSocketMessage` / `handleClientMessage`; `pkgs/room/src/README.md` Tiger Style “Fail loudly on bad wire (unknown `kind` / version)”; `wire.pbt.test.ts` “unknown kind / version / garbage → null”.
- Found: silent drop is the only behavior above the parser. Gateway forwards bytes; client `onWire` returns on `parseServerToClientWire === null`. No upgrade frame, no rejected `__welcome__` for bad `v`.
- Not found: a product handler that surfaces unknown version.
- Conclusion: resolved — README “fail loudly” is not implemented. Property requires a `v ≠ 1` drop not to mutate log/state, and `Reachable` on that drop. Not a protocol-cut like sync `upgrade_required`.

SDK (`existing-assertions.md`): **missing**. Suggested Always / Unreachable / Reachable remain new. In-house DST substitutes are not Antithesis instrumentation.
