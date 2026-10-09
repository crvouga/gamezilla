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
| Complete friend-and-space specification suite | 377 passed, 0 failed | Current examples, all model replays, decisions and structures; includes all final departure and naming additions |
| Host departure and naming features | 23 passed, 0 failed | Includes the three later examples: repeated refusal, offline host leaving, and learning that end on return |
| Space live-presence feature | 4 passed, 0 failed | Includes the visible outcome of leaving |
| Space authorization tests | 12 passed, 0 failed | Host is connected in the positive participant control |
| Simulated Postgres contracts | 47 passed, 0 failed | Includes overlapping transactions and callback queries |
| Quint framework tests | 74 passed, 0 failed | Includes counterexamples after equivalent compiler sharing |
| All registered formal models | 43 passed | Chess 12; friends and spaces 4; framework contexts 21; billing, profile and runtime 6. Original bounds and deadlines retained |
| Push-session continuity contracts | 18 package tests passed, including 5 replacement checks | Breaking incremental updates rejected two cases; duplicating the initial connection rejected all five |
| Strict specification gate | Passed: 1,702 scenarios, 43 models, 2,231 definitions | Only the automated subset of the audit standard |
| Focused local launch gate of 60e8c6c50 | 17 tasks passed; gate passed | Existing two-check concurrency ceiling; proof task 231 seconds against 420 seconds. Includes the final glossary and departure changes |
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
| invariant | invGuestsFollowHost | drop out | space-host-leaves.feature:49 | covered |
| event | SpaceOpened | open space | space-needs-connection.feature:14,15 | covered |
| event | PersonJoined | join | space-guest-link-join.feature:13 | covered |
| event | PersonLeft | leave | space-live-presence.feature:26 | covered |
| event | SpaceEnded | end a space | space-host-leaves.feature:15 | covered |
| transition | Lobby → InSpace, creation | create a space | space-needs-connection.feature:24 | covered |
| transition | Lobby → InSpace, return | return to a space | space-lifecycle.feature:9 | covered |
| transition | Lobby → InSpace, join | join | space-friend-join.feature:15 | covered |
| transition | InSpace → ViewingPresence | presence | space-presence-navigation.feature:9 | covered |
| transition | ViewingPresence → InSpace | presence | space-presence-navigation.feature:29 | covered |
| transition | InSpace → Left | leave | space-live-presence.feature:23 | covered |
| transition | InSpace → Ended, host leaves | leave | space-host-leaves.feature:13,30 | covered |
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
| world | loseConnection | connection | space-host-leaves.feature:50; space-disconnect-reconnect.feature:14 | covered |
| world | connectionReturns | connection | space-host-leaves.feature:20,39,58 | covered |
| policy | PaidAccessEnded → hosting limit with one existing space | paid access | space-host-limit.feature:24 | covered |
| policy | PaidAccessEnded with several existing spaces | paid access | Product decision about existing spaces is pending | MISSING |
| policy | FriendshipEnded → unjoined person's lobby | friend | No explicit downstream example after the friendship ends | MISSING |
| consistency | Creating another space with paid access | hosting limit | space-host-limit.feature:42; createSpace guard space-hosting.qnt:133 | MISSING: model does not distinguish paid access |
| consistency | Opening a space link | space link | space-links.feature:19; no link-opening action is mapped | MISSING |

## Confirmed coverage: space names

Against [`space-names.qnt`](../../../specs/spaces/space-names.qnt).
The six transitions of `lastRename` are explicit; other contexts' policy
coverage and the complete feature-language review remain separate checks.

| Kind | Model name | Term | Evidence | Status |
| --- | --- | --- | --- | --- |
| command | rename | rename a space | space-rename.feature:14,40,46,51 | covered |
| world | stopAllowing | stop allowing | space-rename.feature:60 | covered |
| world | startAllowing | start allowing | space-rename.feature:65 | covered |
| world | loseConnection | connection | space-host-leaves.feature:50; offline naming shown in space-needs-connection.feature:85 | covered |
| world | connectionReturns | connection | space-rename.feature:93 | covered |
| invariant | invNotAllowedNeverShown | not allowed | space-rename.feature:61,71 | covered |
| invariant | invHostSeesGivenName | space name | space-needs-connection.feature:85; space-rename.feature:91 | covered |
| invariant | invAlwaysRefusedNeverGiven | not allowed | space-rename.feature:38 | covered |
| invariant | invSavedRenameGivesTypedName | rename a space | space-rename.feature:13,44 | covered |
| invariant | invConnectedKnowsRules | no longer allowed | space-rename.feature:91 | covered |
| invariant | invStandingRulesKnown | not allowed | space-needs-connection.feature:90 | covered |
| invariant | invConnectedAgree | space name | space-rename.feature:13,18 | covered |
| transition | NoRename → NameSaved | rename a space | space-rename.feature:13 | covered |
| transition | NoRename → NameNotAllowed | rename a space | space-needs-connection.feature:90 | covered |
| transition | NameSaved → NameSaved | rename a space | space-rename.feature:27 | covered |
| transition | NameSaved → NameNotAllowed | rename a space | space-rename.feature:38 | covered |
| transition | NameNotAllowed → NameSaved | rename a space | space-rename.feature:44 | covered |
| transition | NameNotAllowed → NameNotAllowed | rename a space | space-rename.feature:49 | covered |
| policy | UsernameChanged → space named after host | rename themselves | No explicit example of the host changing their username while hosting | MISSING |

## Confirmed coverage: space recovery

Against [`space-recovery.qnt`](../../../specs/spaces/space-recovery.qnt).
These rows concern visible whereabouts. Private connection and publication
bookkeeping remains model-only; it is not replaced with a server-data observer.

| Kind | Model name | Term | Evidence | Status |
| --- | --- | --- | --- | --- |
| command | leave | leave | space-live-presence.feature:23; space-leave-without-host.feature:23,27 | covered |
| command | endSpace | end a space | space-needs-connection.feature:99 | covered |
| command | leaveHost | leave | space-host-leaves.feature:13,30 | covered |
| world | loseConnection | connection | space-host-leaves.feature:49; space-disconnect-reconnect.feature:13 | covered |
| world | connectionReturns | connection | space-host-leaves.feature:36,56,63 | covered |
| invariant | invEndedHasNobodyInside | end a space | space-host-leaves.feature:63; space-disconnect-reconnect.feature:40 | covered |
| invariant | invOpenHasItsHost | host | space-leave-without-host.feature:33 | covered |
| invariant | invConnectedPeopleKnow | whereabouts | space-host-leaves.feature:56 | covered |
| invariant | invOfflineHostKeepsTheirSpace | space | space-host-leaves.feature:49 | covered |
| invariant | invGuestsFollowHost | drop out | space-host-leaves.feature:49 | covered |
| invariant | invPresenceIsCurrent | presence | space-disconnect-reconnect.feature:25; space-leave-without-host.feature:33 | covered |
| transition | InSpace → Left | leave | space-live-presence.feature:23 | covered |
| transition | DroppedOut → Left | leave | space-leave-without-host.feature:23,27 | covered |
| transition | Left → Left, reconnecting | connection | space-leave-without-host.feature:33 | covered |
| transition | Host InSpace → Ended, ending offline | end a space | space-needs-connection.feature:99 | covered |
| transition | Host InSpace → Ended, leaving offline | leave | space-host-leaves.feature:30 | covered |
| transition | DroppedOut → Ended, offline host ended | connection | space-host-leaves.feature:63 | covered |
| transition | DroppedOut → Ended, offline host left | connection | space-host-leaves.feature:36 | covered |
| transition | Left → Ended | end a space | space-live-presence.feature:30 | covered |
| illegal | Ended → leave or end again | leave; end a space | No explicit command-refusal examples | MISSING |

## Blocking findings and triage

- C5 block space-host-limit.feature:24 — “paid access has ended” — the
  one-space boundary is covered; what happens to several existing spaces is
  undefined. Owner: product decision, then spec-upsert and spec-implement.
- C6 block specs/README.md:45 — “adding and removing people” — the offered
  Share actions have no complete feature/model contract. Owner:
  spec-upsert, then spec-implement. The person's decision about removal
  and rejoining, and confirmation of the terms, are pending.
- C6 block space-hosting.qnt:133 — “not(_openSpaces.contains(person))” —
  the hosting model cannot represent the paid member's additional space.
  Owner: spec-upsert, then spec-implement; coordinate with the unresolved
  paid-access-ending decision instead of inventing it.
- C6 block space-links.feature:19 — “opens a link” — link opening is not
  mapped to an aggregate action. Owner: spec-upsert, then spec-implement.
- C4 block space-recovery.qnt:62,68 — “_openSpaces.contains(HOST)” — the
  exclusions after ending lack explicit refusal examples. The complete
  hosting exclusion matrix remains under review. Owner: spec-upsert.
- C5 block specs/spaces/ubiquitous-language.yml:252 — “friend” — the
  upstream FriendshipEnded event has no explicit downstream lobby example.
  Owner: spec-upsert, then spec-implement.
- C5 block space-rename.feature:96 — “named after its host” — the host's
  username change lacks its downstream example. Owner: spec-upsert, then
  spec-implement.

## Findings closed with replacement evidence

- B17: the four “app is still connected” transport assertions were removed
  only after five black-box continuity contracts passed and rejected both
  deliberately broken connection strategies. Every visible note outcome
  remains. Replacement: `push-session-continuity.test.ts` in
  `pkgs/sync-engine-harness/tests/`; commits 1f35bed33 and 17c4c0946.
- B5: prior app updates and space ending became setup facts; the observed
  note change remains the single When. The full 974-check suite passes.
- C1: all three space aggregates now name observed connection events
  publicly and bind them to exported harness actions. Private bookkeeping
  and proof bounds are unchanged; all four friend-and-space models pass.
- C4: offline departure now proves Left, its persistence on reconnection,
  and the surviving host's presence. Naming now illustrates refusal followed
  by success and repeated refusal. Host leaving offline illustrates Ended
  for the host and the guest learning that end on return.
- Cross-spec consistency: the shared connection definition promises
  automatic sharing of accepted local choices, while explicitly refused
  choices never take effect later. It no longer contradicts the refused
  friend-request and human Custom Game choices.

## Outstanding audit work

The mechanical scan covers 233 features. Its quoted-data and compound-actor
candidates require judgment; they are not all findings. Full per-feature
A0–B17 review, all aggregate C1–C6 maps, D1–D6 binding review and process
evidence remain incomplete. A green strict gate does not supply these missing
checks. The inventory also retains its quantitative-capacity and offered
developer-tool contract gaps. The capacity target is awaiting a product
decision; no target has been invented. Nothing here attests launch readiness.
