# private-space-join-requires-acl

Focus: Security Boundaries.
Existing Antithesis SDK: **missing**. Policy unit tests and `decideJoin` pins exist; they are not Antithesis instrumentation.

## Why this property

Default space visibility is **private** (`parseSpaceVisibility` fallback; SUT analysis [product]: anons cannot create/join). Join is a `defineMutation` that must reject strangers. Allowed principals:

- **host** (`isSpaceHostActor`: member id, creating device `host_id`, or `host_account_id`)
- **existing `spaces_users` row** (invite via `addSpaceUser`, or a prior successful join) — rejoin does **not** re-check friendship
- **live friendship** with the host (`areFriends` on `friends_friendships` where `deleted_at IS NULL`)

A valid sequence that should **fail**: friend → join → host unfriends + removes `spaces_users` → join again. A valid sequence that should **succeed**: host `addSpaceUser` then target `joinSpace` without being friends.

Privilege escalation is sequential, not a single forged request: accept friend, join, unfriend, keep seat; or join public, host flips visibility, stranger already seated. Antithesis explores those interleavings plus concurrent `removeFriend` / `joinSpace` on READ COMMITTED.

## Code paths

| File | What it does |
|---|---|
| `libs/spaces/src/use-cases/join-space/shared/join-space-mutation.ts` | After `SPACE_ENDED` check: if `visibility !== 'public'` and no live `spaces_users` for actor and not host and not `areFriends` → `SPACE_VISIBILITY_DENIED`. Else upsert membership + `openSession`. Runtime join also rewrites `host_member_id` / `host_account_id`. |
| `libs/spaces/src/shared/space/friendship-sql.ts` `areFriends` | Live friendship between viewer member id and host account/member id. |
| `libs/spaces/src/shared/space/space-mutation-helpers.ts` `accountId` / `isHost` | Anon cannot join (`SPACE_NOT_SIGNED_IN`). Runtime uses `isSpaceHostActor`. |
| `libs/spaces/src/shared/space/participation/space-participation-policy.ts` `decideJoin` / `isSpaceHostActor` | Policy twin of the mutation. Runtime via device or account drift. `hasSpaceUser` → `already` without visibility re-check. Friend → `friend`. Else private → denied. |
| `libs/spaces/src/use-cases/add-space-user/shared/add-space-user-mutation.ts` | Runtime-only ACL grant (`requireHost`). Inserts/un-tombstones `spaces_users`. |
| `libs/spaces/src/test/space-participation-policy.test.ts` | Pins: private + no friend + no ACL denied; friend allowed; already-seated allowed; host device/account drift allowed. |
| `libs/spaces/src/shared/space/space-visibility.ts` | `'public' \| 'private'` only (no `'friends'` visibility enum). |

Room WS (`createRoomApp`) does **not** enforce this policy — anyone who knows `topic=space:{id}` can connect. That is `room-gateway-fallback-not-host`, not this mutation invariant.

## Failure scenario

1. Stranger S (signed in, not friend, not on `spaces_users`) calls `joinSpace` on private space → must get `SPACE_VISIBILITY_DENIED`; no live `spaces_users` row for S.
2. Concurrent: H unfriends S while S's join is in the same READ COMMITTED window. Join must not commit if the friendship row is gone at commit (today: `areFriends` then INSERT in one mutation txn — still racy vs a concurrent unfriend txn under RC).
3. After unfriend **without** `removeSpaceUser`, S can still `joinSpace` (`present.length > 0`). That is **intended ACL persistence**. The property must treat live `spaces_users` as a grant, not a bug.
4. Anon `env.isAnon` must never create a seat.

## Invariant (checkable)

After every `joinSpace` apply (local + server replay):

- If the space is live and `visibility = 'private'`, a new `spaces_users` row for actor M exists only if at apply time at least one of: `isSpaceHostActor(M)`, live friendship(M, host), or a pre-existing live `spaces_users` for M (including host `addSpaceUser`).
- Public spaces: signed-in non-anon may join; anons still `SPACE_NOT_SIGNED_IN`.
- Ended spaces: no new live membership (`SPACE_ENDED`).

`Always` — each apply is a safety check. `Reachable` on the three allow reasons (`host` / `friend` / `already`) and on `SPACE_VISIBILITY_DENIED` so the Always is not vacuous.

## Suggested SUT instrumentation (all missing)

- `Always` at end of `joinSpaceMutation.run` after INSERT: re-read host/visibility/friend/ACL and assert the allow predicate (catches TOCTOU if the write landed illegally).
- `Always` in replay when verdict is applied and name is `joinSpace`.
- `Reachable` unique messages: `join allowed: friend`, `join allowed: acl`, `join denied: visibility`.

## Open questions

- `joinSpace` host path updates `host_account_id` — can a device-drift host rewrite host to a different account? `(needs human input)`

## Assumptions

- Workload can create users, friend/unfriend, `addSpaceUser`, flip visibility, end space, and inspect Postgres `spaces_users` + `friends_friendships`.
- This property is **mutation/Postgres** truth, not room presence seats (`space-members-messages` is a different log).

### Investigation Log

#### After unfriend, must the host also tombstone `spaces_users`?

- Examined: `remove-friend-mutation.ts`; `remove-space-user-mutation.ts`; `join-space-mutation.ts`; `decideJoin` / policy comments; `space-participation-policy.test.ts`.
- Found: `removeFriend` only soft-deletes `friends_friendships`. It does not touch `spaces_users`. Runtime-only `removeSpaceUser` is the ACL revoke. Policy: existing ACL may reopen without a friendship re-check.
- Not found: a friends mutation that tombstones seats, or a comment that unfriend implies kick.
- Conclusion: resolved — “friend-only private” is false. Invariant keeps the ACL disjunct (as written). Property unchanged.

#### Can a device-drift host rewrite `host_account_id` to a different account?

- Examined: `join-space-mutation.ts` host `UPDATE`; `isSpaceHostActor`; policy tests “creating device may join when member id drifted”; `set-visibility` also rewrites `host_id` / `host_member_id`.
- Found: `host_id === deviceId` is host even when `host_account_id` is another user. Runtime join writes `host_member_id` / `host_account_id` to the current actor. Policy treats creating-device join after member-id drift as **allowed**.
- Not found: a comment or test that a later signed-in account on the creating device must **not** take `host_account_id`.
- Conclusion: tagged `(needs human input)` — code allows the rewrite; whether that is intended recovery vs space takeover is not in this tree. This property keeps host-via-device as an allow; do not tighten until confirmed.

#### Visibility flip public→private: do already-seated strangers keep seats?

- Examined: `set-visibility-mutation.ts`; `decideJoin` `hasSpaceUser` / `already`; join mutation `present.length > 0` short-circuit.
- Found: visibility update does not tombstone `spaces_users`. Existing live ACL skips the private/friend check.
- Not found: a kick-on-private mutation.
- Conclusion: resolved — in-scope as existing seat, not a new join. Property unchanged.
