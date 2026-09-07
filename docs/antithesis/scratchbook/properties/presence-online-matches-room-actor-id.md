# presence-online-matches-room-actor-id

Focus: Wildcard (identity planes). Reformulated for first topology (headless, no Solid UI). Confidence: high.

Existing Antithesis SDK: **missing**. All suggested assertions are new.

Promoted from the deferred table (coverage-balance F6 / wildcard F3 / X4). **Not** privilege — that is `room-gateway-fallback-not-host` (who may pass host-gated commands). This card is **naming**: a signed-in account is online iff the live room actor for that connection is that account.

Do **not** require Durable Object storage. First topology RoomServer is in-process memory; SIGKILL of `api` wipes the log and roster. After remake, roster is empty and nobody is online — that satisfies the iff (account offline, no actor). Empty-after-kill is not a violation.

## Why this property (reformulation)

Implementability deferred the old write-up as “UI-only (`SpaceMemberTileRail` / badges).” The Solid UI rail is motivation, not the oracle. Headless clients already have:

| Probe | API |
|---|---|
| Signed-in account `A` | Session `users.id` / JWT `sub` (local SQLite / auth). |
| This tab’s room `clientId` | Value the workload put on `/api/room?clientId=` (RoomClient config; not sync `deviceId`). |
| Server-assigned actor `X` | `room.getRoster().find(p => p.clientId === clientId)?.id` after a `roster` frame. That `id` is gateway `x-actor-id` (`RoomActor.id`: “account or device”). |
| Account online | `room.getRoster().some(p => p.id === A)` |

`useMemberIsOnline(spaceId, profileId)` is `peersByMemberId.get(profileId).length > 0` — the same grouping: roster actors keyed by `RoomActor.id`. Product often passes **account** as that key. Happy path: `X === A`, lookup hits. Demotion: `X === D` (install / minted UUID), lookup of `A` is false while the user is still in the room.

Workload iff (no Solid UI):

```
accountOnline ≡ (ownActor === A)
```

where `ownActor` is the roster entry for this `clientId`, and `accountOnline` is whether any roster peer has `id === A`.

Gateway fallback (`resolveRoomActorId`: bearer fail → `anonId` → `createId()`) is how `X !== A` becomes reachable. This property does not assert that fallback is unauthorized (`room-gateway-fallback-not-host`); it asserts the **online bit** tracks `X`, not a stuffed account key.

## Code paths

| File | Role |
|---|---|
| `apps/server/src/room/route.ts` `resolveRoomActorId` | `x-actor-id` = account if bearer+device resolve, else `anonId`, else minted UUID. Never blocks on auth. |
| `pkgs/room/src/types.ts` `RoomActor` | `id` = participant; `clientId` = tab. |
| `pkgs/room/src/client/core/room-client.ts` `getRoster()` | Last `roster` wire frame. Public, no Solid UI. |
| `pkgs/room/src/server/core/room-server-fanout.ts` | Fanout `kind: roster`. |
| `libs/spaces/src/root/client/members/use-member-is-online.ts` | Spec for what UI would look up (not the oracle). |
| `libs/spaces/src/root/client/members/space-member-tile-rail.tsx` | Documents `deviceId` as presence key; callers often stuff account. |

`existing-assertions.md`: no Antithesis SDK.

## Failure scenario

1. Signed-in Alice `A` opens `space:{id}`. Gateway sets `x-actor-id = A`. Roster lists `{ id: A, clientId: C }`. `accountOnline` true. Iff holds.
2. Reconnect while Postgres is paused/killed. `tryResolveAccount` throws or returns null; gateway uses `anonId = D`. New roster `{ id: D, clientId: C }` (or both during overlap).
3. **Violation:** `accountOnline` is true (`roster` still or again contains `A`) while `ownActor === D`, or `accountOnline` is false while `ownActor === A` (connected under the account but not listed).
4. After **api process kill**: in-memory RoomServer is empty. Reconnect gets a new welcome/roster. Iff is evaluated on the **new** roster only. Do not require the pre-kill actor or puzzle state to survive.

## Invariant

For every signed-in RoomClient that has received a roster (or welcome that implies an empty roster) on `topic=space:{id}`:

- Let `A` = session `users.id`.
- Let `own` = roster entry with this connection’s `clientId` (absent if disconnected / not yet listed).
- Let `accountOnline` = roster contains some `p.id === A`.
- `Always`: `accountOnline === (own !== undefined && own.id === A)`.
- `Sometimes(space.presence.actor_ne_account)`: accepted upgrade/reconnect with a bearer offered and `own.id !== A` — `anonId` after failed resolve **or** minted UUID when `anonId` is missing/non-UUID (gateway skips `tryResolveAccount`).
- `Unreachable`: `accountOnline` while no live roster actor equals `A` (ghost account online) — equivalent to the Always failing one way.
- After api kill + remake: empty roster ⇒ `accountOnline` false; Always holds if `own` is absent.

`Always` on each roster snapshot, not after a Solid paint. First topology does not run web.

## Antithesis angle

Pause/kill **postgres** during `/api/room` upgrade (gateway catch path). Do not require api kill to preserve the room. Two clients: Alice signed-in, Bob friend or second device — Bob’s roster is a second observer of Alice’s actor id. Clock jump vs 20s heartbeat can drop and reconnect, re-entering resolve.

## What goes wrong

Alice is in the puzzle room under install id `D` while every account-keyed “online” / “You” / compact list says she is gone (or the reverse: account tile online while the socket is `D`). Friends’ list and the live roster contradict. Privilege may still be correct (`D` cannot host) while the naming iff fails.

## Suggested SUT instrumentation (all missing)

- `Always("space.presence.account_online_iff_actor_is_account")` when applying a roster frame (SUT) or in the workload after `getRoster()`.
- `Sometimes("space.presence.actor_ne_account")` when `resolveRoomActorId` returns non-account after a bearer was offered.
- Do not add Solid/`useMemberIsOnline` assertions; they are not in the Node image.

## Open questions

- After take-over, can two roster rows share account `A` with different `clientId`s long enough that `accountOnline` is true while **this** `clientId`’s `own.id` is still catching up? `(partial: same-(id,clientId) take-over is sync supersede; two tabs sharing A is first-topology-off; demotion same clientId can leave A+D)`

SDK (`existing-assertions.md`): **missing**. Suggested assertions remain new.

### Investigation Log

#### Is `RoomActor.id` on the first roster frame always the gateway `x-actor-id` for that `clientId`, including take-over?

- Examined: `apps/server/src/room/route.ts` `resolveRoomActorId` / header set; `adapter-base.ts` `acceptUpgrade` / `supersedeActorSession`; `room-server.ts` `registerConnection` / `getRoster` / `sendWelcome`; `session-takeover.test.ts`.
- Found: gateway writes `x-actor-id`; DO `registerConnection({ id: identityRaw, clientId })`. Roster is `connections.map(c => c.actor)`. Welcome embeds `getRoster()` after register. Same `(identity, clientId)` take-over: `supersedeActorSession` unregisters the old conn **then** registers the new one (sync). First roster after that pair is one row with the new connection’s gateway id.
- Not found: a path that puts a different id on the first roster than the header for that connection. First topology still assumes `createRoomApp` in front of in-process RoomServer (same as `room-gateway-fallback-not-host`).
- Conclusion: resolved — first-roster `RoomActor.id` is the gateway `x-actor-id` for that connection, including same-identity take-over.

#### After take-over, can two roster rows share account `A` with different `clientId`s long enough that `accountOnline` is true while this `clientId`’s `own.id` is still catching up?

- Examined: `supersedeActorSession` (matches `(identityRaw, clientId)` only); DO test “different clientId keeps both”; `getRoster()` Map insertion order.
- Found: two tabs (A, C1) and (A, C2) is **designed** — `accountOnline` true and each `own.id === A`; iff holds. Same-`(A, C)` take-over: unregister then register — no two-row window for that pair. **Demotion** reconnect `(D, C)` does **not** supersede `(A, C)` — both rows can exist until the old socket unregisters. `find(p => p.clientId === C)` then returns the **first** inserted row (old A). First topology is one RoomClient per container — two tabs are off by default.
- Not found: an async gap in same-`(id, clientId)` supersede that leaves two rows.
- Conclusion: tagged `(partial: same-(id,clientId) take-over is sync supersede; two tabs sharing A is first-topology-off; demotion same clientId can leave A+D)` — define `own` as the roster row for this `clientId` (if duplicates, first match is ambiguous). Always still holds for one-tab happy path and same-identity take-over. Demotion overlap is a real iff risk if the old socket lags.

#### Should a minted fallback UUID (no `anonId`) be treated like install demotion for `Sometimes(actor_ne_account)`?

- Examined: `resolveRoomActorId`: bearer+uuid anon → account or `anonId`; else if `anonId !== null` return it; else `createId()`.
- Found: minted UUID is the no-`anonId` path. Bearer offered without a UUID `anonId` **skips** `tryResolveAccount` and mints. That is `own.id !== A` after a bearer was offered. `anonId` fallback after failed resolve is the other demotion.
- Not found: a comment that Sometimes should ignore minted ids.
- Conclusion: resolved — count **both** minted UUID (bearer offered, no/invalid anon) and `anonId` after failed bearer. `Sometimes(actor_ne_account)` already says “bearer offered and `own.id !== A`.”

## Assumptions

- Workload mints and records `clientId`; `getRoster()` is enough (no Solid UI, no `useMyId`).
- In-process RoomServer still goes through `createRoomApp` / `resolveRoomActorId` in this topology (same assumption as `room-gateway-fallback-not-host`). If setup uses raw loopback identity, demotion is Unreachable and the Always is only the happy path.
- Room persistence across api kill is **out of scope**.
