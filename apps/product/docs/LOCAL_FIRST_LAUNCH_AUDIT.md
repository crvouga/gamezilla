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
| Complete friend-and-space specification suite | 384 passed, 0 failed | Current examples, all model replays, decisions and structures; 137 assertions across 73 files; includes the final departure exclusions |
| Guest departure while the host is offline | 4 passed, 0 failed | Offer, departure, both people offline, and departure retained after reconnection |
| Host identity and ended-friendship reactions | 20 passed, 0 failed | Host-named space follows a username change; a space left by a former friend leaves their lobby |
| Departure and ending offers | 15 passed, 0 failed | Positive ending offer; no further leave after leaving or ending; no further end after reconnection to an ended space |
| Host departure and naming features | 23 passed, 0 failed | Includes the three later examples: repeated refusal, offline host leaving, and learning that end on return |
| Space live-presence feature | 4 passed, 0 failed | Includes the visible outcome of leaving |
| Space authorization tests | 12 passed, 0 failed | Host is connected in the positive participant control |
| Simulated Postgres contracts | 47 passed, 0 failed | Includes overlapping transactions and callback queries |
| Quint framework tests | 74 passed, 0 failed | Includes counterexamples after equivalent compiler sharing |
| All registered formal models | 43 passed | Chess 12; friends and spaces 4; framework contexts 21; billing, profile and runtime 6. Original bounds and deadlines retained |
| Push-session continuity contracts | 18 package tests passed, including 5 replacement checks | Breaking incremental updates rejected two cases; duplicating the initial connection rejected all five |
| Strict specification gate | Passed: 1,709 scenarios, 43 models, 2,235 definitions | Only the automated subset of the audit standard |
| Focused local launch gate of 99c463cca and its ending-offer bindings | 20 tasks passed; 2 cached | Source snapshot included the bindings committed as fea97a51b; two-check ceiling retained; proof task 230 seconds against 420 seconds |
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
| invariant | invGuestsFollowHost | drop out | space-host-leaves.feature:51 | covered |
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
| transition | InSpace → Ended, host leaves | leave | space-host-leaves.feature:13,32 | covered |
| transition | InSpace → Ended, host ends | end a space | space-end.feature:9 | covered |
| transition | Left → Ended | end a space | space-live-presence.feature:30 | covered |
| transition | ViewingPresence → Ended | end a space | space-presence-navigation.feature:47 | covered |
| transition | Ended → Lobby | go back to the lobby | space-presence-navigation.feature:57 | covered |
| transition | Left → Lobby | go back to the lobby | space-presence-navigation.feature:63 | covered |
| illegal | joining while the host is offline | join | space-guest-link-join.feature:17 | covered |
| illegal | joining without one's own connection | join | space-needs-connection.feature:61,69 | covered |
| illegal | joining an ended space | join | space-friend-join.feature:28; space-links.feature:9 | covered |
| illegal | Leaving again after Left | leave | space-live-presence.feature:28 | covered |
| illegal | Leaving after Ended | leave | space-host-leaves.feature:17,18,77,78 | covered |
| illegal | Ending again after Ended | end a space | space-host-leaves.feature:72 | covered |
| policy | AccountDeletionConfirmed → ended host's spaces | account deletion | deleted-account-spaces.feature:8 | covered |
| policy | AccountDeletionConfirmed → joined person leaves | account deletion | deleted-account-spaces.feature:21 | covered |
| policy | PaidAccessStarted → hosting limit | Plus member | space-host-limit.feature:34; space-needs-connection.feature:52 | covered |
| world | loseConnection | connection | space-host-leaves.feature:52; space-disconnect-reconnect.feature:14 | covered |
| world | connectionReturns | connection | space-host-leaves.feature:20,41,60 | covered |
| policy | PaidAccessEnded → hosting limit with one existing space | paid access | space-host-limit.feature:24 | covered |
| policy | PaidAccessEnded with several existing spaces | paid access | Product decision about existing spaces is pending | MISSING |
| policy | FriendshipEnded → unjoined person's lobby | friend | space-friend-join.feature:20; former participant has left and is no longer a friend | covered |
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
| world | loseConnection | connection | space-host-leaves.feature:52; offline naming shown in space-needs-connection.feature:85 | covered |
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
| policy | UsernameChanged → space named after host | rename themselves | space-rename.feature:99 | covered |

## Confirmed coverage: space recovery

Against [`space-recovery.qnt`](../../../specs/spaces/space-recovery.qnt).
These rows concern visible whereabouts. Private connection and publication
bookkeeping remains model-only; it is not replaced with a server-data observer.

| Kind | Model name | Term | Evidence | Status |
| --- | --- | --- | --- | --- |
| command | leave | leave | space-live-presence.feature:23; space-leave-without-host.feature:23,27 | covered |
| command | endSpace | end a space | space-needs-connection.feature:99 | covered |
| command | leaveHost | leave | space-host-leaves.feature:13,32 | covered |
| world | loseConnection | connection | space-host-leaves.feature:51; space-disconnect-reconnect.feature:13 | covered |
| world | connectionReturns | connection | space-host-leaves.feature:38,58,65 | covered |
| invariant | invEndedHasNobodyInside | end a space | space-host-leaves.feature:65; space-disconnect-reconnect.feature:40 | covered |
| invariant | invOpenHasItsHost | host | space-leave-without-host.feature:33 | covered |
| invariant | invConnectedPeopleKnow | whereabouts | space-host-leaves.feature:58 | covered |
| invariant | invOfflineHostKeepsTheirSpace | space | space-host-leaves.feature:51 | covered |
| invariant | invGuestsFollowHost | drop out | space-host-leaves.feature:51 | covered |
| invariant | invPresenceIsCurrent | presence | space-disconnect-reconnect.feature:25; space-leave-without-host.feature:33 | covered |
| transition | InSpace → Left | leave | space-live-presence.feature:23 | covered |
| transition | DroppedOut → Left | leave | space-leave-without-host.feature:23,27; space-guest-leave.feature:18,23 | covered |
| transition | Left → Left, reconnecting | connection | space-leave-without-host.feature:33; space-guest-leave.feature:30 | covered |
| transition | Host InSpace → Ended, ending offline | end a space | space-needs-connection.feature:99 | covered |
| transition | Host InSpace → Ended, leaving offline | leave | space-host-leaves.feature:32 | covered |
| transition | DroppedOut → Ended, offline host ended | connection | space-host-leaves.feature:65 | covered |
| transition | DroppedOut → Ended, offline host left | connection | space-host-leaves.feature:38 | covered |
| transition | Left → Ended | end a space | space-live-presence.feature:30 | covered |
| illegal | Ended → leave or end again | leave; end a space | space-host-leaves.feature:72 | covered |

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
- C4: the complete hosting exclusion matrix remains under review. The
  explicit Left and Ended refusals below close those rows only.
- A0/B5/B6 block specs/sync-engine/notes-saved-once.feature:10,17 — “will
  not hear back about its next save” and two actions — technical fault setup
  remains in business prose, and the crash example has two When actions.
  Owner: replacement contracts through spec-implement, then spec-upsert.

## Findings closed with replacement evidence

- B17: the four “app is still connected” transport assertions were removed
  only after five black-box continuity contracts passed and rejected both
  deliberately broken connection strategies. Every visible note outcome
  remains. Replacement: `push-session-continuity.test.ts` in
  `pkgs/sync-engine-harness/tests/`; commits 1f35bed33 and 17c4c0946.
- B5: prior app updates and space ending became setup facts; the observed
  note change remains the single When in those changed examples. The full
  974-check suite passes. This closes those examples, not every B5 finding;
  the separate saved-once crash example above remains blocking.
- C1: all three space aggregates now name observed connection events
  publicly and bind them to exported harness actions. Private bookkeeping
  and proof bounds are unchanged; all four friend-and-space models pass.
- C4: offline departure now proves Left, its persistence on reconnection,
  and the surviving host's presence. Naming now illustrates refusal followed
  by success and repeated refusal. Host leaving offline illustrates Ended
  for the host and the guest learning that end on return. Guest departure
  has its own four examples, including both people offline and the guest's
  retained departure on reconnection. A person who left is no longer offered
  to leave; an ended space offers neither leave nor end after reconnection.
  The positive ending offer prevents the end-denial read from passing by
  always reporting that the choice is absent.
- C5: the explicit host username change follows through to the host-named
  space. A person who left and is no longer a friend stops finding that space
  in their lobby. Both reactions pass through existing product behavior.
- Cross-spec consistency: the shared connection definition promises
  automatic sharing of accepted local choices, while explicitly refused
  choices never take effect later. It no longer contradicts the refused
  friend-request and human Custom Game choices.

## Outstanding audit work

The mechanical scan covers 234 features. Its quoted-data and compound-actor
candidates require judgment; they are not all findings. Full per-feature
A0–B17 review, all aggregate C1–C6 maps, D1–D6 binding review and process
evidence remain incomplete. A green strict gate does not supply these missing
checks. The inventory also retains its quantitative-capacity and offered
developer-tool contract gaps. The capacity target is awaiting a product
decision; no target has been invented. Nothing here attests launch readiness.
The offline behavior of username changes and cached-profile friend requests
is also awaiting clarification; their current specs require a connection.

## Recent per-feature review

These entries record the language, one-action structure, visible outcomes and
scenario-length checks for the recently changed examples. They do not supply
the outstanding complete A0–B17 and D1–D6 review described above. All quoted
space names in these examples are names supplied by people, not required app
copy (B9). Each current example has one When action (B5).

| Feature | Named evidence | Remaining findings |
| --- | --- | --- |
| space-guest-leave.feature | A0/B17: Left and presence are visible; B4: leaving needs no other person's agreement; B5: one action; B11: three background facts | B16 warnings: lines 22 and 27 have six and eight steps. C6 link opening remains unmapped |
| space-friend-join.feature | A4/C5: published friend and the settled end; B6: no-longer-friends is a fact; B5: going from Left to lobby is one action | B16 warning: line 20 has six steps |
| space-rename.feature | A4/C5: published rename-themselves term; B9: names supplied by Alice; C4: all six rename-result transitions are illustrated | B16 warnings: lines 38, 63, 68, 79, 84 and 90 have six or seven steps |
| space-host-leaves.feature | A0/B17: host retains space, other person drops out, ending is visible; C4: ended people are no longer offered leave or end | B16 warnings: lines 13, 38, 51, 58, 65 and 72 have six or seven steps |
| space-live-presence.feature | B4: line 23 allows leaving and rejoining; line 31 removes joining after the host ends the space; C4: Left no longer offers leave | B16 warning: line 23 has six steps |
| space-guest-host.feature | C2: the guest host sees the ending offer; positive control for the ended-space denial observer | No new language, shape or length finding recorded in this review |

The scratch scan's B4 candidate at space-live-presence.feature:20 is not a
refused departure: line 26 says the person left and line 27 offers joining.
The additional refusal at line 28 concerns leaving again after that accepted
departure. The command-under-test distinction is the standard's definition of
refusal; it preserves the rule's positive and negative examples.

The earlier redundant “joining needs a connection” glossary term was removed
in 88358ff57; the boundary now belongs to the existing join definition. No
confirmation of a new term is inferred from the offline requirement (A3).
