# Local-first launch audit — 2026-10-09

Verdict: **FAIL**. The currently offered product remains the release scope.
The authoritative inventory and release rules are in
[`specs/README.md`](../../../specs/README.md). This is an evidence record,
not another product definition. No manual testing supplies evidence.

## Verification

| Automated check | Recorded result | Limit |
| --- | --- | --- |
| Complete chess specification suite | 1,503 passed, 0 failed | Local execution; not a full release verdict |
| Complete shared-notes specification suite | 974 passed, 0 failed | Current saved-once and checked-note examples; 75 assertions across 50 files; c9190a19d with setup bindings committed as cb57fd0d9 |
| Complete profile specification suite | 130 passed, 0 failed | Local execution |
| Complete runtime specification suite | 62 passed, 0 failed | Local execution |
| Complete friend-and-space specification suite | 418 passed, 0 failed | Rejoining, the pinned recovery failure and four navigation examples included; 148 assertions across 83 files; source fabd3657b with the observer changes committed as 0dbb06404 |
| Guest departure while the host is offline | 4 passed, 0 failed | Offer, departure, both people offline, and departure retained after reconnection |
| Host identity and ended-friendship reactions | 20 passed, 0 failed | Host-named space follows a username change; a space left by a former friend leaves their lobby |
| Departure and ending offers | 15 passed, 0 failed | Positive ending offer; no further leave after leaving or ending; no further end after reconnection to an ended space |
| Host departure and naming features | 23 passed, 0 failed | Includes the three later examples: repeated refusal, offline host leaving, and learning that end on return |
| Space live-presence feature | 5 scenarios passed in the complete context run | Includes leaving, the rejoining offer, an explicit successful rejoin and the refusal after ending |
| Space authorization tests | 12 passed, 0 failed | Host is connected in the positive participant control |
| Simulated Postgres contracts | 47 passed, 0 failed | Includes overlapping transactions and callback queries |
| Quint framework tests | 74 passed, 0 failed | Includes counterexamples after equivalent compiler sharing |
| All registered formal models | 44 passed | Chess 12; friends and spaces 5; framework contexts 21; billing, profile and runtime 6. Original bounds and deadlines retained |
| Sync storage and continuity contracts | 24 package tests passed, including 11 replacement checks | Breaking incremental updates rejected two cases; duplicating the initial connection rejected five; duplicate note rows rejected both lost-save cases; four checked-write controls detected draft leakage, missing completion, unrolled server writes and an early refusal verdict |
| Strict specification gate | Passed: 1,722 scenarios, 44 models, 2,233 definitions | Only the automated subset of the audit standard |
| Focused local launch gate of 99c463cca and its ending-offer bindings | 20 tasks passed; 2 cached | Source snapshot included the bindings committed as fea97a51b; two-check ceiling retained; proof task 230 seconds against 420 seconds |
| Focused local gate of f5ffff795 | 18 tasks passed; 72 other plan tasks already cached | Source snapshot before the link-model draft; product proof 204 seconds against 420 seconds; includes sync storage contracts, four note spec parts and four note models |
| Affected chess models after the room lifecycle fix | 501 passed, 0 failed | Multiplayer, multiplayer spaces and three Custom Game models; 40 files; predates the new lobby-card observer |
| Space presence and stepping-out examples | 18 passed, 0 failed | Four new examples; both offline lobby cases originally failed because the card lacked a host-name identifier; its stable space-link identifier observes the rendered card |
| Room-framework specification suite | 355 passed, 0 failed | 568 assertions across 49 files after the memory transport lifecycle change |
| Visual-model setup and private-input contracts | Model installation succeeded; product 174 tests and tooling 559 tests passed | Setup/checker share the worktree cache; private snapshots preserve the prepared model without stale reports; visual-quality assessment remains outstanding |
| Harness room lifecycle checks | 31 harness tests and 5 memory-adapter tests passed | Server withdrawal closes the simulated socket; reconnection succeeds; a late close from the old socket cannot drop its replacement |
| Focused local gate of 1a5347032 | 109 tasks passed; 2 cached | Original 600-second deadline; documented four-worker setting and two concurrent tests; 395.62 seconds. Predates the rejoining contract and lifecycle fix |
| Local launch gate of 6b456bf5a | 115 tasks passed; 1 cached | Includes the rejoin lifecycle fix; 519.26 seconds against the original 600-second deadline; product proof 332 seconds against 420 seconds |
| Local launch gate of b88af8445 | 43 tasks passed; 2 cached, 122 other tasks already cached in the plan | Includes shared visual-model location; 238.57 seconds; later prepared-input fix not included |
| Visual-quality and product gate of 3d0568d15 | Failed: original 600-second deadline | Timed out generating chess input parts; no run summary or visual verdict. Its unconfirmed cached artifacts are not published as evidence. Bounded source groups are being generated with unchanged budgets |
| Expanded checked-note starting states | 266 focused checks passed; all four note models passed | Refusal starts with empty or already shared writing; finite graph 1,113 states, safety and progress unchanged; 6.4 seconds |
| Visual source groups | Earlier 64 chess parts and current 126 other parts passed | Original 600-second deadlines and task budgets; four chess groups took 314.6, 262.5, 419.6 and 414.1 seconds; four friend-and-space groups took 69.8, 64.4, 57.7 and 55.8 seconds; the other 62 parts took 105.9 seconds. Summary-confirmed artifacts transferred from the shared repository cache; current chess task hashes require fresh results |
| Visual run of c9190a19d with pending bindings | Cancelled: no verdict | Its 211 misses exposed a scratch-run cache handoff error. The passed groups were in the shared repository cache; the handoff had looked in the worktree cache. The corrected handoff uses the repository resolver and all four completed summaries; partial cancelled-run artifacts supply no passing evidence |
| Visual run of cb57fd0d9 | Cancelled: no verdict | Other composition reports were reused; chess reports had different current task hashes. The run stopped to generate those leaves in bounded groups. Cancelled-run artifacts supply no passing evidence |
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
| command | stopViewingPresence | presence | space-presence-navigation.feature:32,39,47,55 | covered |
| command | endSpace | end a space | space-end.feature:12; space-needs-connection.feature:102 | covered |
| command | goBackToLobby | go back to the lobby | space-presence-navigation.feature:75,81 | covered |
| invariant | invOnlyOpenSpaces | space | space-disconnect-reconnect.feature:40; space-host-leaves.feature:51 | covered |
| invariant | invHostsAreThePeople | host | space-hosting.qnt:253, finite cast bookkeeping | model-only |
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
| transition | ViewingPresence → InSpace | presence | space-presence-navigation.feature:29,36; host and joined person | covered |
| transition | DroppedOut → Lobby | step out | space-lifecycle.feature:55,62; host offline or joined person offline | covered: both new examples pass |
| transition | Closing presence while host offline → DroppedOut | presence | space-presence-navigation.feature:43 | covered: new example passes |
| transition | InSpace → Left | leave | space-live-presence.feature:23 | covered |
| transition | Left → InSpace | join | space-live-presence.feature:31; original hosting trace 61 and its pinned prefix pass | covered |
| transition | InSpace → Ended, host leaves | leave | space-host-leaves.feature:13,32 | covered |
| transition | InSpace → Ended, host ends | end a space | space-end.feature:9 | covered |
| transition | Left → Ended | end a space | space-live-presence.feature:38 | covered |
| transition | ViewingPresence → Ended | end a space | space-presence-navigation.feature:62 | covered |
| transition | Ended → Lobby | go back to the lobby | space-presence-navigation.feature:72 | covered |
| transition | Left → Lobby | go back to the lobby | space-presence-navigation.feature:78 | covered |
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
| consistency | Opening a space link | space link | space-links.qnt:49; space-links.feature:9,14,28,46 | covered by link aggregate |

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
| transition | Left → Ended | end a space | space-live-presence.feature:38 | covered |
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
- C4: the complete hosting exclusion matrix remains under review. The
  explicit Left and Ended refusals below close those rows only.

## Confirmed coverage: space links

The [`space-links.qnt`](../../../specs/spaces/space-links.qnt) covers
opening a link and opening it again while its destination stays the same.
Bob stays online; Alice alone can lose and regain her connection. The other
space aggregates cover participation and each participant's connection.
These examples use existing terms only (A3); the glossary changes
are model-name mappings on existing terms, not new terms.

The strict handoff initially reported the missing binding and one undefined
setup phrase. The bound model and focused link/reconnection examples now
pass: 39 checks, 12 assertions. Induction proves initialization, preservation
and implication in 5.6 seconds. The complete context run passed 412 checks
with 142 assertions before the rejoining contract. The later complete run passed 418 checks and 148 assertions after the lifecycle and card-observer fixes; a current launch-gate verdict is still pending. This section is not a passing launch verdict.

| Kind | Model name or transition | Evidence | Status |
| --- | --- | --- | --- |
| command | openSpaceLink | space-links.feature:9 | covered |
| world | loseConnection | space-guest-link-join.feature:24 | covered |
| world | connectionReturns | space-guest-link-join.feature:31 | covered |
| invariant | invLinkShowsItsDestination | space-links.feature:9,14,28; space-guest-link-join.feature:17 | covered |
| invariant | invJoiningOfferedOnlyForOpenSpace | space-links.feature:9,14; space-guest-link-join.feature:17 | covered |
| invariant | invOfflineHostPreventsJoining | space-guest-link-join.feature:24 | covered |
| transition | none → open | space-links.feature:9 | covered |
| transition | none → ended | space-links.feature:14 | covered |
| transition | none → not found | space-links.feature:28 | covered |
| transition | none → host offline | space-guest-link-join.feature:17 | covered |
| transition | open → open | space-links.feature:46 | covered |
| transition | ended → ended | space-links.feature:52 | covered |
| transition | not found → not found | space-links.feature:59 | covered |
| transition | host offline → host offline | space-links.feature:65 | covered |
| transition | open → host offline | space-guest-link-join.feature:24 | covered |
| transition | host offline → open | space-guest-link-join.feature:31 | covered |
| transition | joining offered false → true / true → false | space-links.feature:9; space-guest-link-join.feature:24,31 | covered |
| world-only | connection changes before opening, or for ended/missing spaces | space-links.qnt:52,58; no different link outcome | model-only |
| illegal | opening is offered in every link outcome | space-links.qnt:49 has no guard | none |

The two touched features were checked against A0–B17: their words resolve in
the Spaces, borrowed profile/friends and kernel language; no avoid-list
synonym or technical concept was added; the descriptions remain job stories;
every example is under a Rule with both outcomes or its stated reason for no
counter-example; setup is factual; each When is one command or event; all
Thens read visible outcomes with refusal reasons; tags and actors remain
valid; there are no outlines or quoted app copy. Catalog phrases are reused
except the missing-link setup fact. B16 warnings remain at space-links.feature:34,65
and space-guest-link-join.feature:9: six steps preserve both people or the
previous opening and its visible consequences. D2–D6 for the new binding:
actions and reads use exported harness modules; initial choices select setup
paths, while the observer reads actual UI without changing space state or
deriving expected values; clocks are virtual; registration uses the
existing entry and keys match the model. Complete context policy and binding
audits remain outstanding elsewhere in this report.

## Findings closed with replacement evidence

- Visual-check inputs: model setup installed outside the worktree while
  the checker read its own cache. A shared path closes that mismatch;
  `ui-quality-model-installed-outside-worktree` pins the relative path.
  Isolated local snapshots also omitted this required prepared input;
  `check-snapshot-missing-visual-model` pins private copies, stale-report
  exclusion and archive size. Installation, product tests and tooling
  contracts pass. These fixes enable assessment; they do not prove the
  visual-quality verdict.

- Guest lobby observer: when Alice goes offline after Bob joins her link,
  Bob can step out and see the retained lobby card without a cached host
  profile. The previous name-based observer could not find that card.
  The pinned `space-guest-lobby-card-unobservable` example fails without
  the stable card identifier, passes with it, and then proves that ending
  the space removes the card. Lobby assertions identify the shared link
  and read the actual card, without querying the server profile.

- Harness recovery: the original hosting trace 61, seed `0x67932`,
  left while the host was offline and then could not rejoin. The
  in-process withdrawal removed a replacement preview connection without
  closing its simulated socket. The production adapters already close
  withdrawn sockets. The fix brings the harness into parity, notifies the
  client and reconnects on the existing heartbeat. The original 17-state
  prefix is unchanged in its fixture and known-bug record
  `space-link-preview-orphaned-after-leave`; both it and the full drawn
  32-step trace pass. No timeout, proof bound or expected state changed.

- C6: first and repeated space-link openings now have their own aggregate,
  explicit visible outcome examples and a binding that reads the current
  link screen. Host connection changes are independent of Bob, who remains
  online. The opening step previously pressed Join; it now only opens the
  link. The literal repeated-opening input is pinned as
  `space-link-reopen-auto-joined` and in its individual known-bug record.

- A0/B6/B17: checked-note examples now report what Alice and Bob see,
  including the previous note after refusal. The dropped-response input,
  committed row and rollback-before-verdict guards remain in
  `checked-note-storage.contract.test.ts`, with all four original bug
  records pointing to that file. Each replacement rejects a corresponding
  broken implementation in a private copy; all four pass after restoration.
  Model initialization also includes an earlier accepted note, with no
  weakened invariant, proof bound or deadline. The rewritten feature passes
  within the complete 974-check context.

- B17: the four “app is still connected” transport assertions were removed
  only after five black-box continuity contracts passed and rejected both
  deliberately broken connection strategies. Every visible note outcome
  remains. Replacement: `push-session-continuity.test.ts` in
  `pkgs/sync-engine-harness/tests/`; commits 1f35bed33 and 17c4c0946.
- B5: prior app updates and space ending became setup facts; the observed
  note change remains the single When in those changed examples. The full
  974-check suite passes. This closes those examples, not every B5 finding;
  technical cases elsewhere still require review.
- A0/B5/B6/B17: saved-once examples now show one copy for each person,
  including after the writer's app crashes and reopens. The original lost
  response and immediate-crash inputs remain in two storage contracts at
  `pkgs/sync-engine-harness/tests/unacknowledged-note-rows.test.ts`.
  Both reject deliberately duplicated rows. No goal or regression ties were
  removed; commits c60e4520b and f5ffff795. This closes this feature's fault
  setup and compound action, not technical concepts elsewhere in the notes
  context's features, glossary or model headers.
- C1: all three space aggregates now name observed connection events
  publicly and bind them to exported harness actions. Private bookkeeping
  and proof bounds are unchanged; all five friend-and-space models pass.
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
| space-guest-leave.feature | A0/B17: Left and presence are visible; B4: leaving needs no other person's agreement; B5: one action; B11: three background facts | B16 warnings: lines 22 and 27 have six and eight steps. C6 link opening is covered by space-links.qnt |
| space-friend-join.feature | A4/C5: published friend and the settled end; B6: no-longer-friends is a fact; B5: going from Left to lobby is one action | B16 warning: line 20 has six steps |
| space-rename.feature | A4/C5: published rename-themselves term; B9: names supplied by Alice; C4: all six rename-result transitions are illustrated | B16 warnings: lines 38, 63, 68, 79, 84 and 90 have six or seven steps |
| space-host-leaves.feature | A0/B17: host retains space, other person drops out, ending is visible; C4: ended people are no longer offered leave or end | B16 warnings: lines 13, 38, 51, 58, 65 and 72 have six or seven steps |
| space-live-presence.feature | B4: line 23 allows leaving and rejoining; line 38 removes joining after the host ends the space; line 31 proves an explicit rejoin; C4: Left no longer offers leave | B16 warning: line 23 has six steps |
| space-lifecycle.feature | C4: joined people can step out while the host or their own device is offline; both remain able to find the retained space in the lobby | The complete hosting exclusion matrix remains open |
| space-presence-navigation.feature | C4: joined people return from presence; closing presence while the host is offline keeps them disconnected | B16 warning: the offline closing example at line 43 has six steps |
| space-guest-host.feature | C2: the guest host sees the ending offer; positive control for the ended-space denial observer | No new language, shape or length finding recorded in this review |
| checked-notes.feature | A0/A1/A4: supplied note names and writing, saving and refusal resolve in sync-engine and kernel language; A2/A3/A5/A6: no new terms or avoided words, named people act; B1–B3: capability title, job story and every scenario under a rule; B4: each unconditional rule explains its absent counter-example; B5–B13/B15/B17: one action, factual setup, visible outcomes and refusal reason, supplied literals, valid cast/tag, one background fact and no outlines; B14: strict gate has no duplicate warning; D1: no implementation names | B16 warning: scenario at line 27 has seven steps including the background. D2: the current harness reads note rows, not a rendered example app; the feature wording and passing API checks do not close that observation gap |

The scratch scan's B4 candidate at space-live-presence.feature:20 is not a
refused departure: line 26 says the person left and line 27 offers joining.
The additional refusal at line 28 concerns leaving again after that accepted
departure. The command-under-test distinction is the standard's definition of
refusal; it preserves the rule's positive and negative examples.

The earlier redundant “joining needs a connection” glossary term was removed
in 88358ff57; the boundary now belongs to the existing join definition. No
confirmation of a new term is inferred from the offline requirement (A3).
