# sync-membership-and-room-seat-agree

Focus: Wildcard (two merge theories). Confidence: high.

Existing Antithesis SDK: **missing** (`existing-assertions.md`). All suggested assertions are new.

Security already filed `room-gateway-fallback-not-host` (gateway catch → anon must not *gain* host privileges). Data Integrity filed `tombstone-sync-and-pending-revive` (LWW revive agreement). Distributed filed `lww-upload-arrival-under-partition` (sync winners). This property is the **cross-plane** one they do not check: after settle, the room event-log seats and the sync LWW membership for the same human must name the same membership — or both be absent.

## Why this property

The product has two write planes for “who is in this space”:

1. **Sync LWW** — `spaces_users.deleted_at` / `spaces.host_*` via `leaveSpaceMutation` / join mutations. Server-authoritative by HTTP upload arrival. Snapshots + rebase.
2. **Room log** — `SpaceMembersRoomAttr.seats` is a `Record<memberId, { joinedAt }>` folded from `JoinSpaceSeat` / `LeaveSpaceSeat`. Live state must hash-equal the fold (`hashRoomState`). Seat join/leave require `cmd.payload.memberId === identity` (the WS `x-actor-id`).

`useLeaveSpace` fires **both**, in that order: `LeaveSpaceSeat({ memberId: myId })` then `leaveSpaceMutation`. `useAnnounceJoinedOnSync` seats `myId` (account) after room `isSynced`. `resolveRoomActorId` in the participation policy claims room actor **is** the member/account id.

Those planes only agree when the gateway’s `x-actor-id` equals `useMyId()`. `tryResolveAccount` swallows **any** throw (stale bearer **or DB hiccup**) and demotes the socket to the install `anonId`. After that:

- `LeaveSpaceSeat({ memberId: accountA })` is **unauthorized** (`memberId !== identity`).
- `leaveSpaceMutation` still tombstones `spaces_users` for `A` (sync actor comes from the HTTP session, not the WS header).
- The old seat keyed by `A` stays in the room fold. A new seat keyed by install id `D` may be added on the next announce.

Room hash is still consistent with its own log. Sync LWW is still consistent with its own arrivals. **The two theories disagree about the same person.** Product symptom from the SUT analysis: “left but still seated.”

## Code paths

| File | Role |
|---|---|
| `libs/spaces/src/root/client/leave-space/use-leave-space.ts` | Dispatches `LeaveSpaceSeat` + `AnnounceMemberLeft` with `useMyId()`, then `leaveSpaceMutation`. Room command is best-effort; mutation errors throw. |
| `libs/spaces/src/shared/space/space-members/space-members-messages.ts` | Seat join/leave unauthorized unless `memberId === identity`. Seats are a JSON map on `RoomState`, not Postgres. |
| `libs/spaces/src/root/client/room/use-announce-joined-on-sync.ts` | After `RoomMetaAttr.isSynced`, seats `myId` (account). If identity was demoted, this join is also unauthorized — or, if they later announce with the demoted id, a **second** seat appears. |
| `apps/server/src/room/route.ts` `tryResolveAccount` | `catch { return null }` on any auth/SQL failure during WS upgrade. |
| `libs/spaces/src/shared/space/participation/space-participation-policy.ts` `resolveRoomActorId` | Comment: room/game actor id is the member (account) id. |
| `libs/spaces/src/shared/space/space-module.ts` `hash` | `hashRoomState(state)` — room-only oracle. |

## Failure scenario

1. Signed-in host `A` is seated in `space:{id}` (`seats[A]` exists). Sync `spaces_users` for `A` is live.
2. Antithesis pauses Postgres (or the isolate SQL) during the next WS upgrade. Gateway sets `x-actor-id = D` (install anon).
3. User leaves. Client sends `LeaveSpaceSeat({ memberId: A })` → rejected. `leaveSpaceMutation` uploads and tombstones `A` on the server.
4. After HTTP heal + room `sync(fromSeq)`: sync says `A` has `deleted_at` set; room fold still has `seats[A]` (and maybe `seats[D]`).
5. **Bug if** that split survives a quiet period where both planes have accepted their own subsequent traffic (a successful `/api/query` that includes `mySpaceUsers`, and a room welcome/sync whose `hash` matches the fold).

Mid-fault divergence is allowed. The check is after both planes have a chance to apply the user’s leave (mutation applied **and** a later room command or reconnect from that client).

## Invariant (checkable)

After a quiet interval in which (a) `leaveSpaceMutation` for `(spaceId, account A)` is in `sync_engine_mutations_applied` and (b) that client has completed a later room `sync` or issued any subsequent command on `space:{id}`:

- Room `seats` must **not** contain key `A`.
- Sync must have a tombstone (`deleted_at IS NOT NULL`) for `A`’s `spaces_users` row in that space (or the space itself ended).

Conversely, after join mutation applied + `JoinSpaceSeat` accepted for `A`:

- `seats[A]` exists **and** `spaces_users` for `A` is live.
- Room must not have an extra seat keyed only by `A`’s install id `D` while `A` is the session `users.id`.

`Always` after that quiet interval. Pair with `Sometimes(cond)` when room `seats` keys and live `spaces_users.user_id` sets differ — proves the workload actually crossed the planes. `Reachable` on `LeaveSpaceSeat` unauthorized while a leave mutation later applies (the demotion trigger).

## Suggested SUT instrumentation (all missing)

- `Always("space.planes.leave_clears_seat")` in the workload after quiet: no `seats[A]` if server tombstone for `A` exists and that client has room-synced since the leave.
- `Always("space.planes.join_seats_account")` after accepted `JoinSpaceSeat`: seat key equals session `users.id`, not `anonId`, when a bearer was offered and the session is still valid.
- `Sometimes("space.planes.seat_keys_ne_sync_members")` when the two id sets differ mid-run.
- `Reachable("space.room.leave_seat_unauthorized_then_sync_leave_applied")` when the room command fails identity match and the mutation still applies.

Do not reuse sim `assertConverged` as the oracle — it heals the mesh first and does not compare room seats to `spaces_users`.

## What goes wrong if violated

Friends still see the leaver in the live room roster / puzzle host seat. The leaver’s next `LeaveSpaceSeat({ memberId: A })` can never succeed while the socket is demoted. Chess `hostIdentity` captured as `A` no longer matches the socket, so the real host cannot move — the SUT-analysis “left but still seated” / “host checks see the wrong identity” pair.

## Open questions

- None

## Assumptions

- Antithesis topology includes both the HTTP room gateway and the sync mutation path (not in-process `RoomServer` alone).
- “Settle” means HTTP query completed for space membership **and** room `isSynced` after the leave, not harness `healAll`.
- Leave/join Always stays scoped to accounts that had (or completed) a live `spaces_users` row. Extra seats from the open gateway without ACL are not a product spectator feature.

### Investigation Log

#### After a rejected `LeaveSpaceSeat`, does the client retry with the current room identity, or only with `useMyId()`?

- Examined: `libs/spaces/src/root/client/leave-space/use-leave-space.ts`; `use-announce-joined-on-sync.ts`; room client rejected-command handling.
- Found: leave dispatches `LeaveSpaceSeat({ memberId: myId })` and `AnnounceMemberLeft` once from `useMyId()`, then `leaveSpaceMutation`. No catch/retry with a different member id. Announce-join also always uses `useMyId()`.
- Not found: a path that re-issues leave-seat with the gateway-demoted install id.
- Conclusion: resolved — client only ever seats/leaves with `useMyId()`. A demoted socket rejects leave-seat for `A` and does not remove `seats[A]` (or `seats[D]`). Property “must not contain `A`” after settle still holds; it will fail on this path.

#### Is a room seat without a live `spaces_users` row ever intentional (spectator who never got an ACL row)?

- Examined: `create-space-mutation.ts`, `join-space-mutation.ts` (both INSERT `spaces_users`); `useAnnounceJoinedOnSync` (requires `session.isOpen`); `space-members-messages.ts` (seat join is `memberId === identity` only); `createRoomApp` (open gateway); lobby SQL that lists host spaces without an ACL row.
- Found: product join/create always write ACL before an open session, then announce-seat. There is no UI spectator-without-ACL path. Runtime-without-`spaces_users` is a lobby listing OR, not a room seat. Raw WS can still `JoinSpaceSeat` because the gateway never checks ACL.
- Not found: a product “watch without joining” seat command.
- Conclusion: resolved — extra seats without ACL are an open-gateway artifact, not an intentional spectator feature. Always for leave stays scoped to users who had a live membership; converse join Always requires join mutation applied.

#### Does DO hibernation restore seats from the log only or from a cached map?

- Examined: `RoomServer.hydrateFromStorage`; `createServerLocked`; `SpaceMembersRoomAttr.seats` (JSON on `RoomState`); `hibernation-restore.ts`.
- Found: seats are folded from the event log via `module.reduce`. Restore rebuilds `RoomServer` and hydrates from `loadEventsAfter(0)`. No separate seat cache.
- Not found: a persisted seats map independent of the log.
- Conclusion: resolved — hibernation cannot diverge seats from the log on its own. Cross-plane disagreement still comes from identity demotion / failed leave-seat, not restore.

SDK (`existing-assertions.md`): **missing**. All suggested Always / Sometimes / Reachable are new. Do not reuse sim `assertConverged` as the oracle.
