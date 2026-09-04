# room-gateway-fallback-not-host

Focus: Security Boundaries.
Existing Antithesis SDK: **missing** (`existing-assertions.md`). No `assertAlways` / `assertSometimes` / `assertReachable` in product or framework code. Suggested SUT-side assertions below are new.

## Why this property

`createRoomApp` documents the gateway as **open to anyone — never blocks on auth**. Actor resolution prefers a signed-in account when bearer + device bind, otherwise the install `anonId`, otherwise a fresh `createId()`. Any failure in `tryResolveAccount` (invalid token **or DB hiccup**) is swallowed and treated as anon.

Room host/seat checks compare **string identity** from the upgrade header (`x-actor-id`) to stored host / `memberId`. Chess host commands (`SubmitChessPuzzleMove`, hint, clear) require `ctx.identity === hostIdentity`. Seat join/leave require `cmd.payload.memberId === identity`. There is **no** product `RoomServer.authorize` hook tying the socket to `spaces_users` / friendship.

A stale-bearer or spoofed-`anonId` connection can therefore present as the wrong principal for those string compares. Antithesis is the right tool: the fallback is triggered by **transient SQL / token expiry during WS upgrade**, which the in-process sim does not inject on the live gateway.

## Code paths

| File | What it does |
|---|---|
| `apps/server/src/room/route.ts` `createRoomApp` / `resolveRoomActorId` / `tryResolveAccount` | Copies inbound headers, **overwrites** `x-actor-id` with the resolved actor, forwards Upgrade to the DO. Bearer from `?token=` or `Authorization`. `anonId` from query or `x-anon-id`. Catch-all `catch { return null }` on auth resolve. |
| `apps/server/src/room/route.ts` `parseAnonId` | No UUID check on the no-bearer path. `if (anonId !== null) return anonId`. |
| `pkgs/room/src/server/adapters/durable-object/adapter-base.ts` `parseUpgradeIdentity` | Identity is **only** the `x-actor-id` header. Frames do not set identity. Missing/invalid header → 401. |
| `libs/chess/src/shared/chess/chess-puzzle-play-router.ts` `handleStart` / `handleClear` / `handleReclaim` | Start captures `hostIdentity: identity`. Clear/moves require host match. **`handleReclaim` transfers host to any other connected identity** (no space-membership check). |
| `libs/spaces/src/shared/space/space-members/space-members-messages.ts` | Seat join/leave unauthorized unless `memberId === identity`. |
| `pkgs/room/src/server/core/room-server.ts` | Optional `authorize(identity, topic, command)` — unused by product space/chess composition (only sim/kit fixtures). |

## Failure scenario

1. Runtime H is signed in (account `A`). Puzzle `hostIdentity` is `A`.
2. During WS reconnect, bearer is stale **or** `BearerAuthResolver.resolveAccountId` throws (Postgres pause, isolate SQL disconnect). Gateway sets `x-actor-id` to H's install `anonId` `D` (or a fresh UUID).
3. Runtime-gated chess commands from this socket now compare `D` vs `A` → denied (availability). **Worse:** a second client connects with **only** `anonId=A` (no bearer). Gateway returns `A` unchanged. Seat join and chess host checks treat them as H.
4. Independently, any peer on `topic=space:{id}` can send `reclaim` and become puzzle host (`handleReclaim`). Combined with an open gateway, knowing the topic is enough.

Client frames cannot override identity (gateway overwrites the header; DO reads only that header). The hole is **who the gateway writes**, not frame forgery.

## Invariant (checkable)

After every accepted room upgrade and after every host-gated command apply:

- The connection's `x-actor-id` equals: resolved session `accountId` if bearer+device bind succeeded; otherwise the offered `anonId` if present; otherwise a server-minted id. Never a value from the WS JSON body.
- A connection whose bearer was offered but **failed to resolve** must **not** pass host checks that require the signed-in account `A` (fallback identity ≠ `A`).
- A connection that never presented a valid bearer+device bind for account `A` must **not** pass host/seat checks as `A` — including `anonId=A` without bind.

`Always` matches the safety claim. Pair with `Reachable` on the stale-bearer fallback branch so the search actually hits the catch path (otherwise the Always can vacuously hold).

## Suggested SUT instrumentation (all missing)

- `Always` in `resolveRoomActorId` after resolution: if bearer was non-null and `tryResolveAccount` returned null, actorId must equal the offered anonId (or the minted id), never a previously cached account.
- `Reachable` in the `catch` of `tryResolveAccount` ("room gateway auth fallback").
- `Always` in chess host-gated handlers: if command applied, `identity` equals stored `hostIdentity` **and** that identity was gateway-resolved (pass a resolved-vs-fallback flag on the connection meta).
- `Unreachable` for "host-gated command applied for identity that only appeared as unauthenticated `anonId` equal to another user's `accountId`".

## Related claimed guarantees

SUT analysis [failure] / [wildcard]: "Room stale bearer → anon actor — host checks see the wrong identity"; "room actor can silently become the install id on a DB hiccup during WS upgrade." Comments in `route.ts` treat fallback as intentional availability, not as a privilege grant.

`upsertExternalAccount` / session actor are a **different** plane (HTTP mutations). Room identity is not the sync JWT `sub`.

## Open questions

- Is `anonId` on the no-bearer path supposed to be UUID-only? `(needs human input)`

## Assumptions

- Antithesis topology includes the HTTP room gateway (`createRoomApp`), not only in-process `RoomServer` (sim skips this file).
- Chess "host" is puzzle-session host, not necessarily `spaces.host_account_id`. Both string-compare against gateway identity.
- `ReclaimChessPuzzlePlay` is a protocol feature: any connected non-host identity may become puzzle host. The property does not treat reclaim itself as privilege escalation; it still forbids an unauthenticated `anonId=A` from acting as account `A`.

### Investigation Log

#### Is `handleReclaim` intended to let any connected spectator become puzzle host?

- Examined: `libs/chess/src/shared/chess/chess-puzzle-play-router.ts` `handleReclaim`; `chess-puzzle-play.test.ts` reclaim cases; chess client/UI for `ReclaimChessPuzzlePlay`; `host-auth-partition.sim.test.ts`.
- Found: reclaim succeeds for any identity that is not already host, with only “puzzle in play” / “already host” gates. No `spaces_users` or spectator check. Unit test “reclaim transfers host so a new actor can submit moves” uses `GUEST`. No product UI dispatch — command is still on the wired router.
- Not found: a comment or ACL that reclaim is host-only or membership-gated.
- Conclusion: resolved — reclaim is implemented as any-connected-identity. Property host-check stays “identity string match after gateway resolve.” Reclaim is out of privilege-escalation scope. Still combine with unauthenticated `anonId=A` must not be `A`.

#### Does product `RoomServer` ever get an `authorize` callback that checks `spaces_users`?

- Examined: `apps/room-server/src/app/create-room-server.ts`; `create-room-server-durable-object.ts`; `pkgs/room` DO adapter; `libs/spaces` for `authorize:`.
- Found: `createRoomServer` constructs `new RoomServer({ topic, module, storage, clock, effectHandlers })` with no `authorize`. DO adapter likewise. No `authorize:` in spaces or `apps/room-server`.
- Not found: a product composition that passes `spaces_users` into `RoomServer.authorize`.
- Conclusion: resolved — product never wires the hook. Runtime/seat checks are module string equality only.

#### Is `anonId` on the no-bearer path supposed to be UUID-only?

- Examined: `apps/server/src/room/route.ts` `parseAnonId`, `parseClientId`, `resolveRoomActorId`.
- Found: `parseAnonId` returns the query/header string with no `isUuid`. Bearer+anon bind requires `isUuid(anonId)` before `tryResolveAccount`. `parseClientId` is UUID-only. No-bearer path is `if (anonId !== null) return anonId`.
- Not found: a comment that the no-bearer path must reject non-UUIDs. Comments call anon “install device id” (product devices are UUIDs) but do not say the gateway should enforce that.
- Conclusion: tagged `(needs human input)` — code accepts any non-empty `anonId` without a bearer. Whether that is intended (vs a missed `isUuid`) is not in this tree. Property invariant stays “offered anonId if present.”

SDK (`existing-assertions.md`): **missing**. No `assertAlways` / `assertSometimes` / `assertReachable` in product or framework code. Suggested SUT-side assertions remain new.
