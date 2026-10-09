# Local-first launch audit — 2026-10-09

Verdict: **FAIL**. The currently offered product remains the release scope.
The authoritative inventory and release rules are in
[`specs/README.md`](../../../specs/README.md). This is an evidence record,
not another product definition. No manual testing supplies evidence.

## Verification

| Automated check | Recorded result | Limit |
| --- | --- | --- |
| Complete chess specification suite | 1,503 passed, 0 failed | Local execution; not a full release verdict |
| Complete shared-notes specification suite | 974 passed, 0 failed | Local execution; audit findings below remain |
| Complete profile specification suite | 130 passed, 0 failed | Local execution |
| Complete runtime specification suite | 62 passed, 0 failed | Local execution |
| Space lifecycle, presence and navigation features | 14 passed, 0 failed | Includes offline host, absent guests, departure and an ended presence view |
| Complete friend-and-space specification suite | 368 passed, 0 failed | Before the last presence-view example; its focused checks subsequently passed |
| Space live-presence feature | 4 passed, 0 failed | Includes the visible outcome of leaving |
| Space authorization tests | 12 passed, 0 failed | Host is connected in the positive participant control |
| Simulated Postgres contracts | 47 passed, 0 failed | Includes overlapping transactions and callback queries |
| Quint framework tests | 74 passed, 0 failed | Includes counterexamples after equivalent compiler sharing |
| Strict specification gate | Passed: 1,694 scenarios, 43 models, 2,228 definitions | Only the automated subset of the audit standard |
| Focused local launch gate | 30 tasks passed; gate passed | Existing two-check concurrency ceiling; proof task 218 seconds against 420 seconds. Snapshot predates the final presence-view example |
| Full release verification of d8e6f3a5a | Not executed | [Actions run](https://github.com/crvouga/gamezilla/actions/runs/37903939539): Actions budget prevented jobs from starting |

Equivalent proof compilation preserves model guarantees, search bounds,
concurrency ceilings and deadlines. Serialized execution measured 435 seconds
and failed its budget; the supported two-check configuration measured 218
seconds and passed. Full release verification remains outstanding. Later changes require current
evidence; earlier runs cannot attest a later artifact.

## Confirmed coverage: space hosting

The map is against [`space-hosting.qnt`](../../../specs/spaces/space-hosting.qnt).
`MISSING` remains blocking even when drawn model traces exercise a similar
path. The complete transition matrix and the other aggregates remain under
review.

| Kind | Model name | Term | Evidence | Status |
| --- | --- | --- | --- | --- |
| command | createSpace | create a space | space-needs-connection.feature:13,20,26 | covered |
| command | returnToSpace | return to a space | space-lifecycle.feature:13,20 | covered |
| command | join | join | space-friend-join.feature:17; space-guest-link-join.feature:13 | covered |
| command | stepOut | step out | space-lifecycle.feature:26 | covered |
| command | leave | leave | space-live-presence.feature:25; space-host-leaves.feature:15 | covered |
| command | viewPresence | presence | space-presence-navigation.feature:11,17,23 | covered |
| command | stopViewingPresence | presence | space-presence-navigation.feature:32,40 | covered |
| command | endSpace | end a space | space-end.feature:12; space-needs-connection.feature:102 | covered |
| command | goBackToLobby | go back to the lobby | space-presence-navigation.feature:60,66 | covered |
| invariant | invOnlyOpenSpaces | space | space-disconnect-reconnect.feature:40; space-host-leaves.feature:51 | covered |
| invariant | invHostsAreThePeople | host | space-hosting.qnt:251, finite cast bookkeeping | model-only |
| invariant | invLobbyListsOpenSpaces | lobby | space-lifecycle.feature:23; space-end.feature:16 | covered |
| invariant | invPresenceCountsTheSpace | presence | space-presence-navigation.feature:14,20; space-disconnect-reconnect.feature:25 | covered |
| invariant | invOfflineHostKeepsTheirSpace | space | space-needs-connection.feature:10,17,24,30,37 | covered |
| invariant | invGuestsFollowHost | drop out | space-host-leaves.feature:36 | covered |
| event | SpaceOpened | open space | space-needs-connection.feature:14,15 | covered |
| event | PersonJoined | join | space-guest-link-join.feature:13 | covered |
| event | PersonLeft | leave | space-live-presence.feature:26 | covered |
| event | SpaceEnded | end a space | space-host-leaves.feature:16 | covered |
| transition | Lobby → InSpace, creation | create a space | space-needs-connection.feature:24 | covered |
| transition | Lobby → InSpace, return | return to a space | space-lifecycle.feature:9 | covered |
| transition | Lobby → InSpace, join | join | space-friend-join.feature:15 | covered |
| transition | InSpace → ViewingPresence | presence | space-presence-navigation.feature:9 | covered |
| transition | ViewingPresence → InSpace | presence | space-presence-navigation.feature:29 | covered |
| transition | InSpace → Left | leave | space-live-presence.feature:23 | covered |
| transition | InSpace → Ended, host leaves | leave | space-host-leaves.feature:14 | covered |
| transition | InSpace → Ended, host ends | end a space | space-end.feature:9 | covered |
| transition | Left → Ended | end a space | space-live-presence.feature:30 | covered |
| transition | ViewingPresence → Ended | end a space | space-presence-navigation.feature:47 | covered |
| transition | Ended → Lobby | go back to the lobby | space-presence-navigation.feature:57 | covered |
| transition | Left → Lobby | go back to the lobby | space-presence-navigation.feature:63 | covered |
| illegal | joining while the host is offline | join | space-guest-link-join.feature:17 | covered |
| illegal | joining without one's own connection | join | space-needs-connection.feature:61,69 | covered |
| illegal | joining an ended space | join | space-friend-join.feature:21; space-links.feature:9 | covered |
| policy | AccountDeletionConfirmed → ended host's spaces | account deletion | deleted-account-spaces.feature:8 | covered |
| policy | AccountDeletionConfirmed → joined person leaves | account deletion | deleted-account-spaces.feature:21 | covered |
| policy | PaidAccessStarted → hosting limit | Plus member | space-host-limit.feature:34; space-needs-connection.feature:52 | covered |
| policy | PaidAccessEnded → hosting limit | paid access | No explicit downstream example when paid access ends | MISSING |

## Blocking findings and triage

- C5 block specs/README.md:1122 — “the hosting limit” — paid-access ending
  lacks its downstream space example. Owner: spec-upsert, then
  spec-implement. Add it using the existing billing promise.
- C6 block specs/README.md:45 — “adding and removing people” — the offered
  Share actions have no complete feature/model contract. Owner:
  spec-upsert, then spec-implement. The person's decision about removal
  and rejoining, and confirmation of the terms, are pending.
- B17 block shared-space-membership.feature:35,42 — “app is still connected”
  — transport state is not a person's outcome. Owner: spec-implement first,
  then spec-upsert. Demote only after a replacement check is seen rejecting
  the same failure.
- B17 block notes-across-app-updates.feature:26,56 — “app is still connected”
  — the same demotion requirement applies; preserve every guard.
- B5 block notes-across-app-updates.feature:12,40 — multiple actions in one
  example — retain the earlier event as setup and the one observed event
  as When. Owner: spec-upsert, then spec-implement.

## Outstanding audit work

The mechanical scan covers 233 features. Its quoted-data and compound-actor
candidates require judgment; they are not all findings. Full per-feature
A0–B17 review, all aggregate C1–C6 maps, D1–D6 binding review and process
evidence remain incomplete. A green strict gate does not supply these missing
checks. The inventory also retains its quantitative-capacity and offered
developer-tool contract gaps. Nothing here attests launch readiness.
