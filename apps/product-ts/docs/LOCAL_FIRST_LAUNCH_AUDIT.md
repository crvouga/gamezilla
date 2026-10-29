# Local-first launch audit — 2026-10-09

Verdict: **FAIL**. The currently offered product remains the release scope.
The authoritative inventory and release rules are in
[`specs/README.md`](../../../specs/README.md). This is an evidence record,
not another product definition. No manual testing supplies evidence.

The current combined product proof run passed seven checks and failed six
at their existing time limits (471.43 seconds total). The six failures cover
offline replication, access and synchronization, multiplayer, account privacy,
the whole product and recovery. No bounds, deadlines or invariants were relaxed.
The combined models also retain older offline and space-addition assumptions;
those must be reconciled with the canonical domain rules before their verdict
can support launch.

All eight current Friends and Spaces models passed their formal checks with
the original bounds and deadlines. The full behavior replay is still running.
A separate settled-screen regression found an extra wait in the hosting
replay: immediate cancellation waited for the original trial period as well
as access grace, crossing the independent sign-in lifetime on the second
cycle. Waiting only for the remaining grace fixes that driver error. The
literal sequence now passes all three assertions, including a third checkout
and a newly hosted space. Sign-in lapse and its downstream reactions remain
a separate audit obligation.

## Verification

| Automated check | Recorded result | Limit |
| --- | --- | --- |
| Complete chess specification suite | 1,503 passed, 0 failed | Local execution; not a full release verdict |
| Complete shared-notes specification suite | 974 passed, 0 failed | Current saved-once and checked-note examples; 75 assertions across 50 files; c9190a19d with setup bindings committed as cb57fd0d9 |
| Complete profile specification suite | 130 passed, 0 failed | Local execution |
| Complete runtime specification suite | 62 passed, 0 failed | Local execution |
| Complete friend-and-space specification suite after both profile fixes | 420 passed, 0 failed | 148 assertions across 84 files; 423.35 seconds; includes the two named-presence examples of c01abc3c8 and their binding and profile subscription committed as fedb06c88 |
| Guest departure while the host is offline | 4 passed, 0 failed | Offer, departure, both people offline, and departure retained after reconnection |
| Host identity and ended-friendship reactions | 20 passed, 0 failed | Host-named space follows a username change; a space left by a former friend leaves their lobby |
| Departure and ending offers | 15 passed, 0 failed | Positive ending offer; no further leave after leaving or ending; no further end after reconnection to an ended space |
| Host departure and naming features | 23 passed, 0 failed | Includes the three later examples: repeated refusal, offline host leaving, and learning that end on return |
| Space live-presence feature | 7 scenarios passed in the focused run | Includes named host and joined-person observations, leaving, the rejoining offer, an explicit successful rejoin and the refusal after ending |
| Space authorization tests | 12 passed, 0 failed | Host is connected in the positive participant control |
| Simulated Postgres contracts | 47 passed, 0 failed | Includes overlapping transactions and callback queries |
| Quint framework tests | 74 passed, 0 failed | Includes counterexamples after equivalent compiler sharing |
| All registered formal models | 44 passed | Chess 12; friends and spaces 5; framework contexts 21; billing, profile and runtime 6. Original bounds and deadlines retained |
| Sync storage and continuity contracts | 24 package tests passed, including 11 replacement checks | Breaking incremental updates rejected two cases; duplicating the initial connection rejected five; duplicate note rows rejected both lost-save cases; four checked-write controls detected draft leakage, missing completion, unrolled server writes and an early refusal verdict |
| Strict specification gate | Passed: 1,724 scenarios, 44 models, 2,234 definitions | Only the automated subset of the audit standard |
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
| Full release verification of d8e6f3a5a | Not executed | Actions run 37903939539: Actions budget prevented jobs from starting |
| Visual source parts of 37f7ca33f | 190 passed; 2,266 checks, no failures or skips | Report completions and JUnit records: product 65, billing 88, chess 1,503, friends/spaces 418, profile 130, runtime 62. Refreshed chess groups took 265.0, 238.6, 398.4 and 414.5 seconds; original budgets retained. Later naming and profile-subscription changes require fresh evidence |
| Touched-package tasks of 37f7ca33f | 61 passed across 34 packages | Every declared type-check and test task appears in a successful run summary. All 34 packages declare type checks; 27 declare separate tests. Seven rely on harness coverage and do not declare a test script, so the literal every-package-test attestation remains unchecked |
| PR Verify of 37f7ca33f | Not executed | Actions run 37954014738: every job had zero steps; its failure annotation states that the Actions budget prevented starting |
| Visual-quality and product gate of 37f7ca33f | Failed: original 600-second deadline | Preparation was still running after 444 seconds; 27,143 inputs had been written, but no manifest or visual verdict existed. Individually completed model and renderer logs do not make the failed run a passing gate |
| Reusable stylesheet analysis of 8df24f5c5 | Product unit suite, type check and lint passed | 175 tests, 1,004 assertions, 24 files; the literal frame preserves its original fingerprint |
| Visual-quality and product gate of 8df24f5c5 | Failed: original 600-second deadline | Preparation completed with 2,091 reports, 545,469 references and 42,018 unique inputs. Scoring was still running after 151 seconds when the enclosing run timed out. No full visual verdict or successful run summary was produced; partial artifacts were not published as passing evidence |
| Link-joined host-name regression | Literal example failed before the product fix and passed afterward; 16 naming scenarios passed | The relevant-background rewrite initially exposed four failing outcomes: clear name, moderate space name, change host username and moderate host username. The guest rendered “Space” because the host's profile was absent locally. The existing profile subscription now keeps it synchronized; the complete 418-check context passed |
| Link-joined presence-name regression | Literal example and the host's named-presence Then failed before the fix; 23 focused checks and the complete 420-check context passed afterward | The host counted two people, but the joined person's row had no name. Connected people now keep their profiles synchronized. Eight friends-harness tests, 15 client tests, 12 spaces-harness tests, four affected type checks and lint passed |
| Local full check of ee238af5d with the host-profile fix | Failed: original 600-second deadline | Four model tasks were still active; three had spent over nine minutes in the run. The documented default allows only one solver. No complete run summary was produced, so partial cached artifacts were not published as passing evidence |
| Local full check of c01abc3c8 with the named-presence fix, four solver slots | Failed: native EMQX startup | 410 tasks succeeded before the broker contract failed; 170.4 seconds total. The installation's physical path on OWC Express 1M2 was split by EMQX's launcher, which rejected Express as an Erlang environment argument. Original proof bounds and deadlines were retained |
| Native broker path regression | Two literal runtime tests and 19 live pubsub contracts passed | A release under the literal OWC Express 1M2 path is staged without whitespace, retains relative links, and disposes only its temporary runtime. Existing broker data and logs remain at the source. The unchanged real-broker contracts, including the offline session buffer, passed in 8.02 seconds; type check and lint passed. A fresh complete check remains required |
| Local full check of 0cdf542d1 with the broker fix | Failed: original 600-second deadline | The 1,093-task plan included all full-verify leaves; 760 were misses. The chess proof task, product contract task and two billing parts were still running at the deadline. No complete run summary or passing full verdict was produced; partial artifacts were not published as passing evidence |
| Relevant offline-departure setup of 2c198c153 | Five focused scenarios, strict specifications and ownership passed | The outsider's refusal no longer depends on Bob's account or participation. Every action and outcome remains; the complete 420-check context passed with 148 assertions across 84 files in 393.08 seconds |
| Fast local PR gate of 2c198c153 with the pending audit | Passed: 844 tasks, 312 cached | The PR scope alone; 272.0 seconds total, including 264.179 seconds of Turbo execution. Original deadlines and budgets retained; this is local evidence and does not make the remote CI attestation true |
| Declared touched-package tasks in that PR summary | 63 passed across 35 packages | All 35 type checks and 28 declared tests have successful task records. Seven touched packages have no separate test script; the literal every-package-test attestation remains unchecked |
| Hosting-limit description of 57bbe7e81 | Five focused scenarios, strict specifications and the complete 420-check context passed | Only the duplicated description was removed. Both Rule headings, every limit and all five actions and outcomes are unchanged; the complete context had 148 assertions across 84 files in 390.40 seconds |
| Complete profile-subscription regression of 39ee511d7 | Literal 201-profile example failed before the fix; all four profile-client tests, type check and lint passed afterward | Requests previously discarded every identifier after the first 200. Batches now cover every requested profile within the unchanged query bound; generated inputs and subscription disposal are checked. The complete affected context passed 420 tests with 148 assertions across 84 files in 433.81 seconds |
| Fast local PR gate including 39ee511d7 | Passed: 844 tasks, 489 cached | Snapshot of 57bbe7e81 with the pending profile fix and audit; profile sources were then committed as 39ee511d7. The PR scope alone; 253.6 seconds total, including 245.183 seconds of Turbo execution. Original deadlines and budgets retained; remote CI and full verification remain required |
| Declared touched-package tasks after the batching fix | 67 passed across 37 packages | All 37 type checks and 30 declared tests have successful records in the fresh PR summary: 29 executed and 38 cache hits. The same seven packages have no separate test script; the literal every-package-test attestation remains unchecked |
| PR Verify of 3e47f6065 | Not executed | Actions run 37975904169: all six jobs ran zero steps; the failure annotation says an Actions budget prevented starting |
| Full local check of 3e47f6065 | Failed: original 600-second deadline | The 1,093-task plan had 862 cache hits and 231 tasks to execute. The chess proof task and three friend-specification parts were still running at the deadline; no complete summary or passing aggregate verdict was produced |
| Isolated chess proof task of 3e47f6065, two model workers | All 12 proofs passed; task gate failed its unchanged budget | The task took 451 seconds against 300 seconds. This confirms the outstanding verification-time limit; successful safety proofs do not turn a failed task gate into a pass |

Equivalent proof compilation preserves model guarantees, search bounds,
concurrency ceilings and deadlines. Serialized execution measured 435 seconds
and failed its budget; the supported two-check configuration measured 218
seconds and passed. Full release verification remains outstanding. Later changes require current
evidence; earlier runs cannot attest a later artifact.

The on-demand visual gate is outside the required full verification, as
documented in [`README.md`](../../../README.md#correctness-machinery).
Its partial scoring produced 601 below-threshold results among 2,863 completed
image results. These are experimental model preferences, not 601 confirmed
product defects or a complete visual verdict; the detector's measured limits
are in [`EVALUATION.md`](../../../pkgs/ui-quality-check-server-ts/EVALUATION.md).

The complete local product scenarios above use the in-process host. The
[`harness host contract`](../../../libs/harness-ts/README.md#hosts) states that
real and stack browser modes have no partition capability. These local
results do not supply an offline browser-matrix or live-production verdict;
those obligations remain unproven. No browser was driven by hand.

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
| command | leave | leave | space-live-presence.feature:28; space-host-leaves.feature:15 | covered |
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
| event | PersonLeft | leave | space-live-presence.feature:37 | covered |
| event | SpaceEnded | end a space | space-host-leaves.feature:15 | covered |
| transition | Lobby → InSpace, creation | create a space | space-needs-connection.feature:24 | covered |
| transition | Lobby → InSpace, return | return to a space | space-lifecycle.feature:9 | covered |
| transition | Lobby → InSpace, join | join | space-friend-join.feature:15 | covered |
| transition | InSpace → ViewingPresence | presence | space-presence-navigation.feature:9 | covered |
| transition | ViewingPresence → InSpace | presence | space-presence-navigation.feature:29,36; host and joined person | covered |
| transition | InSpace → Lobby | step out | space-lifecycle.feature:23,43 | covered: host and joined person |
| transition | DroppedOut → Lobby | step out | space-lifecycle.feature:56,63; host offline or joined person offline | covered: both new examples pass |
| transition | Closing presence while host offline → DroppedOut | presence | space-presence-navigation.feature:43 | covered: new example passes |
| transition | InSpace → Left | leave | space-live-presence.feature:34 | covered |
| transition | Left → InSpace | join | space-live-presence.feature:42; original hosting trace 61 and its pinned prefix pass | covered |
| transition | InSpace → Ended, host leaves | leave | space-host-leaves.feature:13,32 | covered |
| transition | InSpace → Ended, host ends | end a space | space-end.feature:9 | covered |
| transition | Left → Ended | end a space | space-live-presence.feature:49 | covered |
| transition | ViewingPresence → Ended | end a space | space-presence-navigation.feature:62 | covered |
| transition | Ended → Lobby | go back to the lobby | space-presence-navigation.feature:72 | covered |
| transition | Left → Lobby | go back to the lobby | space-presence-navigation.feature:78 | covered |
| illegal | joining while the host is offline | join | space-guest-link-join.feature:17 | covered |
| illegal | joining without one's own connection | join | space-needs-connection.feature:61,69 | covered |
| illegal | joining an ended space | join | space-friend-join.feature:28; space-links.feature:9 | covered |
| illegal | Leaving again after Left | leave | space-live-presence.feature:39 | covered |
| illegal | Leaving after Ended | leave | space-host-leaves.feature:17,18,77,78 | covered |
| illegal | Ending again after Ended | end a space | space-host-leaves.feature:72 | covered |
| policy | AccountDeletionConfirmed → ended host's spaces | account deletion | deleted-account-spaces.feature:8 | covered |
| policy | AccountDeletionConfirmed → joined person leaves | account deletion | deleted-account-spaces.feature:21 | covered |
| policy | PaidAccessStarted → hosting limit | Plus member | space-host-limit.feature:33; space-needs-connection.feature:52 | covered |
| world | loseConnection | connection | space-host-leaves.feature:52; space-disconnect-reconnect.feature:14 | covered |
| world | connectionReturns | connection | space-host-leaves.feature:20,41,60 | covered |
| policy | PaidAccessEnded → hosting limit with one existing space | paid access | space-host-limit.feature:23 | covered |
| policy | PaidAccessEnded with several existing spaces | paid access | Confirmed: retain existing spaces and block creation at the free limit; space-host-limit.feature | covered |
| policy | SignedIn → host can create and find their space | sign in | space-create.feature:10,12; signed-in fact and visible lobby outcome | covered |
| policy | SignedOut → hosting and participation | sign out | The identity relationship is declared in specs/README.md:1120; no Spaces reaction or borrowed sign-out term is evidenced | MISSING |
| policy | BecameFriends → friend can find the host's space | friend | space-friend-join.feature:7,12; settled friendship fact and visible lobby outcome | covered |
| policy | FriendshipEnded → unjoined person's lobby | friend | space-friend-join.feature:20; former participant has left and is no longer a friend | covered |
| consistency | Creating another space with paid access | hosting limit | space-host-limit.feature:41; createSpace guard space-hosting.qnt:133 | MISSING: model does not distinguish paid access |
| consistency | Opening a space link | space link | space-links.qnt:49; space-links.feature:9,14,28,38 | covered by link aggregate |

## Confirmed coverage: space names

Against [`space-names.qnt`](../../../specs/spaces/space-names.qnt).
The six transitions of `lastRename` are explicit; other contexts' policy
coverage and the complete feature-language review remain separate checks.

| Kind | Model name | Term | Evidence | Status |
| --- | --- | --- | --- | --- |
| command | rename | rename a space | space-rename.feature:11,43,50,56 | covered |
| world | stopAllowing | stop allowing | space-rename.feature:64 | covered |
| world | startAllowing | start allowing | space-rename.feature:71 | covered |
| world | loseConnection | connection | space-host-leaves.feature:52; offline naming shown in space-needs-connection.feature:85 | covered |
| world | connectionReturns | connection | space-rename.feature:102 | covered |
| invariant | invNotAllowedNeverShown | not allowed | space-rename.feature:65,79 | covered |
| invariant | invHostSeesGivenName | space name | space-needs-connection.feature:85; space-rename.feature:91 | covered |
| invariant | invAlwaysRefusedNeverGiven | not allowed | space-rename.feature:44,45 | covered |
| invariant | invSavedRenameGivesTypedName | rename a space | space-rename.feature:12,51 | covered |
| invariant | invConnectedKnowsRules | no longer allowed | space-rename.feature:103 | covered |
| invariant | invStandingRulesKnown | not allowed | space-needs-connection.feature:90 | covered |
| invariant | invConnectedAgree | space name | space-rename.feature:12,19 | covered |
| transition | NoRename → NameSaved | rename a space | space-rename.feature:12 | covered |
| transition | NoRename → NameNotAllowed | rename a space | space-needs-connection.feature:90 | covered |
| transition | NameSaved → NameSaved | rename a space | space-rename.feature:31 | covered |
| transition | NameSaved → NameNotAllowed | rename a space | space-rename.feature:44,45 | covered |
| transition | NameNotAllowed → NameSaved | rename a space | space-rename.feature:51 | covered |
| transition | NameNotAllowed → NameNotAllowed | rename a space | space-rename.feature:57 | covered |
| policy | UsernameChanged → space named after host | rename themselves | space-rename.feature:114 | covered |

## Confirmed coverage: space recovery

Against [`space-recovery.qnt`](../../../specs/spaces/space-recovery.qnt).
These rows concern visible whereabouts. Private connection and publication
bookkeeping remains model-only; it is not replaced with a server-data observer.

| Kind | Model name | Term | Evidence | Status |
| --- | --- | --- | --- | --- |
| command | leave | leave | space-live-presence.feature:34; space-leave-without-host.feature:27,35 | covered |
| command | endSpace | end a space | space-needs-connection.feature:99 | covered |
| command | leaveHost | leave | space-host-leaves.feature:13,32 | covered |
| world | loseConnection | connection | space-host-leaves.feature:51; space-disconnect-reconnect.feature:13 | covered |
| world | connectionReturns | connection | space-host-leaves.feature:38,58,65 | covered |
| invariant | invEndedHasNobodyInside | end a space | space-host-leaves.feature:65; space-disconnect-reconnect.feature:40 | covered |
| invariant | invOpenHasItsHost | host | space-leave-without-host.feature:46 | covered |
| invariant | invConnectedPeopleKnow | whereabouts | space-host-leaves.feature:58 | covered |
| invariant | invOfflineHostKeepsTheirSpace | space | space-host-leaves.feature:51 | covered |
| invariant | invGuestsFollowHost | drop out | space-host-leaves.feature:51 | covered |
| invariant | invPresenceIsCurrent | presence | space-disconnect-reconnect.feature:25; space-leave-without-host.feature:46 | covered |
| transition | InSpace → Left | leave | space-live-presence.feature:34 | covered |
| transition | DroppedOut → Left | leave | space-leave-without-host.feature:27,35; space-guest-leave.feature:18,23 | covered |
| transition | Left → Left, reconnecting | connection | space-leave-without-host.feature:45; space-guest-leave.feature:30 | covered |
| transition | Host InSpace → Ended, ending offline | end a space | space-needs-connection.feature:99 | covered |
| transition | Host InSpace → Ended, leaving offline | leave | space-host-leaves.feature:32 | covered |
| transition | DroppedOut → Ended, offline host ended | connection | space-host-leaves.feature:65 | covered |
| transition | DroppedOut → Ended, offline host left | connection | space-host-leaves.feature:38 | covered |
| transition | Left → Ended | end a space | space-live-presence.feature:49 | covered |
| illegal | Ended → leave or end again | leave; end a space | space-host-leaves.feature:72 | covered |

## Blocking findings and triage

- C5 paid-access-ending contract is now defined: retain existing spaces and
  block new spaces at the free hosting limit. The added examples pass; the
  repeated access-transition model still requires a passing product replay.
- C6 block specs/README.md:45 — “adding and removing people” — the offered
  Share actions have no complete feature/model contract. Owner:
  spec-upsert, then spec-implement. The confirmed contract grants lobby access
  through Add, requires explicit Join, ends participation through Remove,
  permits rejoining through public links, and reserves Leave for the host.
  New examples and models exist; current aggregate verification is running.
- C6 block space-hosting.qnt:133 — “not(_openSpaces.contains(person))” —
  the hosting model cannot represent the paid member's additional space.
  The new hosting-limits model represents additional spaces and retained
  spaces after paid access ends. Its repeated access-cycle replay is not yet
  passing, so this remains an implementation verification blocker.
- C4: the complete hosting exclusion matrix remains under review. The
  explicit Left and Ended refusals below close those rows only.
- B2 closed by 57bbe7e81: the hosting-limit description is one job story;
  the free and paid boundaries remain in its two Rule headings and all five
  examples. No vocabulary, limit or expected outcome changed. The five
  scenarios and strict specifications pass through existing bindings.
- B11 closed by 2c198c153: the outsider example at
  space-leave-without-host.feature:17 needs only Alice's space and her offline
  connection. Bob's account and participation now appear only in the four
  examples that use them. Every original action and visible outcome remains;
  all five scenarios pass through existing bindings. Repeated opening setup
  is retained as a warning because the outsider does not share it.
- B11 closed by ee238af5d: friendship is confined to the lobby-name example
  at space-rename.feature:15. Alice-only refusals at lines 53 and 74 no longer
  arrange Bob's participation. The offline and host-identity rule backgrounds
  at lines 83 and 108 contain only facts every example in their rule needs.
  All 16 naming examples pass after correcting the missing host-profile
  subscription exposed by the link-joined setup.

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
| transition | open → open | space-links.feature:38 | covered |
| transition | ended → ended | space-links.feature:44 | covered |
| transition | not found → not found | space-links.feature:51 | covered |
| transition | host offline → host offline | space-links.feature:57 | covered |
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
except the missing-link setup fact. B16 warnings remain at space-links.feature:57
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
  `verify-snapshot-missing-visual-model` pins private copies, stale-report
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
  `pkgs/sync-engine-harness-ts/tests/`; commits 1f35bed33 and 17c4c0946.
- B5: prior app updates and space ending became setup facts; the observed
  note change remains the single When in those changed examples. The full
  974-check suite passes. This closes those examples, not every B5 finding;
  technical cases elsewhere still require review.
- A0/B5/B6/B17: saved-once examples now show one copy for each person,
  including after the writer's app crashes and reopens. The original lost
  response and immediate-crash inputs remain in two storage contracts at
  `pkgs/sync-engine-harness-ts/tests/unacknowledged-note-rows.test.ts`.
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
developer-tool contract gaps. No launch capacity was supplied; quantitative
evidence remains to be measured. Nothing here attests launch readiness.
Username changes and cached-profile friend requests now follow the confirmed
local-acceptance contract. Current focused checks are recorded below.

## Current Spaces shape checks

A fresh scan of all 19 Spaces features found 113 scenarios. B3 (every scenario
under a Rule) and B5 (one When in each non-synthetic scenario) pass. B16
has 25 warnings and no scenario over the eight-step blocking boundary.
The five synthetic probes have no When, as permitted by the standard.
This scan does not replace the outstanding language, background-relevance,
binding or aggregate reviews.

| Feature | Scenarios | B16 warnings: scenario line (steps including Background) |
| --- | --- | --- |
| deleted-account-spaces.feature | 4 | none |
| live-updates.feature | 4 | none |
| space-create.feature | 1 | none |
| space-disconnect-reconnect.feature | 6 | 40 (6) |
| space-end.feature | 2 | 16 (7) |
| space-friend-join.feature | 4 | 20 (6) |
| space-guest-host.feature | 2 | none |
| space-guest-leave.feature | 4 | 22 (6), 27 (8) |
| space-guest-link-join.feature | 4 | 9 (6) |
| space-host-leaves.feature | 9 | 13 (6), 38 (6), 51 (6), 58 (6), 65 (6), 72 (7) |
| space-host-limit.feature | 5 | 23 (6) |
| space-leave-without-host.feature | 5 | 9 (6), 30 (6), 38 (8) |
| space-lifecycle.feature | 8 | 48 (6) |
| space-links.feature | 8 | 57 (6) |
| space-live-presence.feature | 7 | 34 (6) |
| space-needs-connection.feature | 13 | 69 (6), 99 (6) |
| space-presence-navigation.feature | 10 | 43 (6), 51 (6) |
| space-rename.feature | 16 | 93 (6), 99 (6) |
| spaces.feature | 1 | none |

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
| space-rename.feature | A4/C5: published rename-themselves term; B9: names supplied by Alice; C4: all six rename-result transitions are illustrated; B11: each rule background is relevant to every example using it, and host-only refusals arrange only Alice | B16 warnings: lines 93 and 99 each have six steps; offline naming needs both the prior allowed name and the person's connection history |
| space-host-leaves.feature | A0/B17: host retains space, other person drops out, ending is visible; C4: ended people are no longer offered leave or end | B16 warnings: lines 13, 38, 51, 58, 65 and 72 have six or seven steps |
| space-live-presence.feature | A0/A1: presence names who is there, not just how many; B5/B8: the two named-presence examples at lines 16 and 21 each have one view-presence action and a visible name; B4: line 34 allows leaving and rejoining, line 49 removes joining after ending, and line 42 proves explicit rejoining; C4: Left no longer offers leave; D2: named outcomes read the displayed name through the harness | B16 warning: line 34 has six steps; the named examples each have three |
| space-host-limit.feature | B2: the description states the motivation; limits remain under Rules; B4: the free boundary has accepted and refused cases, and the unlimited paid rule explains its absent counter-example; all five scenarios pass | B16 warning: line 23 has six steps; C5/C6: several previously hosted spaces after paid access ends and the paid creation guard remain unresolved |
| space-leave-without-host.feature | A0/B17: departure and the Leave offer are visible; B4: the joined person can leave and the outsider is refused; B5: one action; B11: account and participation facts appear only where needed; all five examples pass | B16 warnings: lines 9 and 30 have six steps, line 38 has eight; the four joined-person examples repeat setup explicitly because the outsider does not need it |
| space-lifecycle.feature | C4: joined people can step out while the host or their own device is offline; both remain able to find the retained space in the lobby | The complete hosting exclusion matrix remains open |
| space-presence-navigation.feature | C4: joined people return from presence; closing presence while the host is offline keeps them disconnected | B16 warning: the offline closing example at line 43 has six steps |
| space-guest-host.feature | C2: the guest host sees the ending offer; positive control for the ended-space denial observer | No new language, shape or length finding recorded in this review |
| checked-notes.feature | A0/A1/A4: supplied note names and writing, saving and refusal resolve in sync-engine and kernel language; A2/A3/A5/A6: no new terms or avoided words, named people act; B1–B3: capability title, job story and every scenario under a rule; B4: each unconditional rule explains its absent counter-example; B5–B13/B15/B17: one action, factual setup, visible outcomes and refusal reason, supplied literals, valid cast/tag, one background fact and no outlines; B14: strict gate has no duplicate warning; D1: no implementation names | B16 warning: scenario at line 27 has seven steps including the background. D2: the current harness reads note rows, not a rendered example app; the feature wording and passing API checks do not close that observation gap |

The earlier scratch scan's B4 candidate is now at space-live-presence.feature:31.
It is not a refused departure: line 37 says the person left and line 38 offers
joining. The additional refusal at line 39 concerns leaving again after that accepted
departure. The command-under-test distinction is the standard's definition of
refusal; it preserves the rule's positive and negative examples.

The earlier redundant “joining needs a connection” glossary term was removed
in 88358ff57; the boundary now belongs to the existing join definition. No
confirmation of a new term is inferred from the offline requirement (A3).

## Rejoining example consolidation

B14 closed: the rejoining examples previously at space-links.feature:34 and
space-lifecycle.feature:48 used the same three starting facts and the same
join action. The link example also checked that Bob was in the space. That
stronger example is retained verbatim at space-lifecycle.feature:48; its
presence count and Bob's visible whereabouts both remain. The overlapping
weaker example is removed, with no goal or regression tag involved.

The link aggregate retains its command, all three observable invariants,
first and repeated opening outcomes, and both host connection transitions
in the map above. No model, language entry, step or product rule changes.
A0–A6, B1–B15, B17 and D1 were checked for the two touched features; names,
actors, factual setup, single actions and visible outcomes use the existing
Spaces, borrowed friends/profile and kernel language. B16 retains one
six-step warning in each feature: the lifecycle example needs the prior
participation and stepping out, and the offline-host link example needs
the prior opening. This closes the duplicate finding only; other aggregate
and whole-tree findings remain blocking.

Strict specifications after consolidation pass with 1,723 scenarios, 44
models and 2,234 definitions; ownership passes. The moved example had
already passed in the complete 420-check context in its original location.
A fresh run of both affected features passes: 16 scenarios, 13 assertions
across four files in 6.44 seconds. The strict and ownership gates also pass.

## Bounded proof performance

The opt-in multiplayer proof groups keep all twelve named invariants and
the original two-step bound, native encoding and total 480-second model
deadline. The existing two-phase pool and its lower-concurrency setting
remain unchanged. Grouping is not enabled for other models.

The literal twelve-target scheduling input failed before grouping and
passes after it. The complete verifier package passes 87 tests with 185
assertions, including an actual violating door transition in the later
group and independently completed safe groups. The binding metadata tests,
four affected type checks, lint and the known-bug gate pass.

The complete chess model task passes in 278 seconds against the unchanged
300-second task budget, using the documented four-model configuration. Its
completed summary records task hash 092a38acbcfd9e3c and exit code zero. Only
that successful task's artifacts were published into the local check cache.
This snapshot includes the grouping implementation before commit and
predates the rejoining example consolidation; the model text is unchanged.
A fresh full check and remote full verification remain required.

## Current local-first verification after confirmed decisions

The person confirmed that username choices and requests from a profile already
on the device are accepted locally, shared later, and clearly refused when
shared rules reject them. These decisions replace the earlier open questions.
The person did not supply a capacity target; quantitative evidence still needs
to be measured and documented, rather than treating that absence as a pass.

Username verification now passes all 35 selected feature and model checks,
including local persistence, later sharing, taken-name refusal and a newly
disallowed name. The profile package passes eight property and contract checks
with 587 assertions. Current profile client, profile harness, spaces client and
sync client type checks pass; username feedback lint passes. These are focused
local results, not a full launch verdict.

The literal newly-added-person Join regression failed before the startup
availability fix and passes after it. The room framework passes 56 contracts
with 165 assertions. The previous full addition run passed 72 checks and failed
that one startup case; a broader addition, removal and host-connection run is
now in progress. The six offline cached-profile request examples now pass;
their complete context verification remains outstanding.

A broader run found four observer divergences where a person who had already
left or been removed was labelled a disconnected participant solely because
the preview showed an offline-host notice. A preview does not participate.
The addition model now agrees with the hosting model on that distinction;
the removed-person offline preview is explicitly illustrated. The literal
hosting input will pin the observer classification separately. No expected
participation, offline-host denial or disconnection guarantee is weakened.

The six offline friend-request scenarios failed at their visible outcomes before
implementation (16.13 seconds), then all six passed with nine assertions in
25.96 seconds. The returning-person removal example now waits for the
observable settled view and passes in 1.79 seconds, with a five-second bound;
connectivity returning does not synchronously deliver a membership snapshot.
The three durable-feedback contracts pass with 17 assertions in 2.06 seconds,
including separate outcomes for two different choice targets. These focused
results do not replace the outstanding whole-context and full local gates.

All eight current Friends/Spaces formal models pass under the existing bounds
and deadlines. Product replay exposed lost feedback after a local refusal and
queries treating a correctly deleted request as pending. Both inputs are pinned;
the local refusal now survives reopening and the deleted request cannot prevent
a later offline choice. Four feedback contracts pass with 24 assertions and the
whole sync harness passes 28 checks with 98 assertions. The current complete
behavior suite is running. These results do not resolve the remaining audit,
capacity, environment-conformance or full local verification gaps.
