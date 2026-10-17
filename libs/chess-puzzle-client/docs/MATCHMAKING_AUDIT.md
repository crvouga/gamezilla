# Multiplayer matchmaking coverage audit

Specification review: 2026-10-02. Implementation verdict: **RED**.
This ledger indexes the canonical contracts; it is not a second product
specification. Undefined bindings and operation failures remain required
implementation work. Passing syntax checks alone do not establish conformance.

The post-binding review corrected two reference omissions without relaxing a
promise. Confirmed account deletion clears that account's private game while
preserving the opponent's result and an offline device's last known board until
return. The literal Dave/Bob history first failed the model regression. Generic
legal worlds now include a complete group of sixteen and refuse a seventeenth
place; six-bit cardinalities keep those boundaries representable. Existing
command, privacy, group-size and structural coverage entries own these checks.

## Search status and commands

Every cell refers to `matching.qnt` and the indexed features below. Offline
commands are unavailable in every standing; observation retains the last known
view until reconnect. Foreign search references have the same refusal/absence
as unknown references. Reading an earlier accepted reference retains its own
outcome independently of the current reference.

| Command/event | No accepted wait | Waiting | Stopped | Matched |
| --- | --- | --- | --- | --- |
| Fresh begin, available | Start | Keep current wait | Start new identity | Start new identity, preserve old match |
| Fresh begin, unavailable | Refuse | Unavailability ends wait | Refuse | Refuse, preserve match |
| Repeat begin | Impossible without earlier request | Keep original receipt | Keep stopped receipt | Keep matched receipt |
| Observe own reference | Absence | Waiting | Not waiting | Complete immutable match |
| Observe another's reference | Absence | Absence | Absence | Absence |
| Stop exact own reference | No effect | Stop | No effect | No effect |
| Stop older reference | No effect | Cannot stop current wait | No effect | Cannot undo match |
| Fresh range change | Refuse | Change current range, keep age | Refuse | Refuse |
| Repeat range change | Impossible without earlier change | Keep latest choice | No revival | No revival |
| Pair people up | No effect | Complete compatible groups only | No revival | Never reuse reference |
| Time passes | No effect | Grow to cap; no expiry | No revival | Preserve accepted outcome |
| Become unavailable | Refuse future begin | Stop | Remain stopped | Preserve match |
| Become available | Permit fresh begin | Remain waiting | No revival | Preserve match |
| Restrict/allow a pair | Change future eligibility | Change future eligibility | No revival | Preserve match |
| Lose connection | Keep cached view | Keep cached view | Keep cached view | Keep cached view |
| Come back online | Accepted view | Accepted view | Accepted view | Accepted view |

## Compatibility matrix

The finite dimensions are exhausted in `matching.qnt`: four people, two pools,
three requested sizes, fixed ranges 5/50/200 and a growing range, available or
unavailable, restricted or unrestricted, two devices each, three successive
requests each, and six independent match identities. Numeric properties and
`rating-ranges.feature` require the boundary representatives below; a finite
model's four ratings do not replace these numeric obligations.

| Dimension | Accepted representative | Refusal representative | Contract |
| --- | --- | --- | --- |
| Distinct person | Two different people | Same person/two devices | `invOneWait`, `invCompleteGroups`, Alloy ownership |
| Pool | Same pool | Different pool | `invMutualRanges`, availability-and-details |
| Group | All request 2, 3 or 4; all places filled | Mixed size or incomplete group | `invCompleteGroups`, complete-groups, searches.als |
| Mutual acceptance | Every pair accepts both directions | One narrow side; incompatible pair inside group | `invMutualRanges`, being-matched, complete-groups |
| Exact radius | Distance 50 at radius 50; 400 at cap | Distance 51 or 401 respectively | rating-ranges; formula properties |
| Growing radius | 50 initially, 60 at one second, 400 at 35 seconds | Beyond either person's contemporaneous radius | rating-ranges, `invGrowingBoundaries` |
| Range choice | New choice, retaining age | Earlier replay overwrites newer choice | changing-ranges; change identity |
| Availability | All eligible at formation | One unavailable before formation | `invFormationApproved`, `invAvailableWaits` |
| Pair restriction | Unrestricted pair | Restriction in either direction | pair-restrictions, chess-opponent-policies |
| Selection | Earlier complete compatible opportunity | Incompatible elder preventing younger complete group | competing-waits; `pairUp` |
| Exact simultaneous tie | Either complete legal group | Partial/overlapping/incompatible group | Model permits accepted ordering either way; no nearest-rating promise |

## Race matrix

Each row is an interleaving obligation of `matching.qnt`; device-visible results
are compared after every action. Simultaneous operations linearize to a legal
ordering, with no intermediate partial match observable. The assembled game
additionally binds `games/matched-game.qnt` at the same transaction boundary.

| Race | Classification and coverage |
| --- | --- |
| Begin/begin; begin from two devices | One accepted current identity; receipt of second points to it; search-identity |
| Begin/stop | Stop affects only its named accepted identity; search-identity, competing-waits |
| Stop/match | First accepted operation wins; stopped reference never matched, formed match unchanged; competing-waits |
| Two match attempts sharing a person | One complete assignment for each reference; `invExactlyOneAssignment`, `invTerminalWaits` |
| A/B versus A/C with B/D | Earliest complete opportunity first; two disjoint groups where possible; four-person model |
| Eligibility change/match | Check facts at formation; earlier unavailability stops wait, later change preserves match; availability-and-details |
| Block/match | Earlier block vetoes pairing, later block keeps game; pair-restrictions, chess-opponent-policies |
| Widen or narrow/match | Accepted range at formation; later command cannot change match; changing-ranges, rating-ranges |
| Disconnect/match | Offline cached wait; remote match durable; reconnect converges; waits-after-time-away |
| Reconnect/cancel | Accepted stop reflected without new request; waits-after-time-away |
| Stale stop/new begin | Older identity never changes newer wait; search-identity |
| Stale range change/new begin | Older identity never changes newer range; changing-ranges |
| Handoff/cancel | Atomic accepted match and game; stop cannot undo formed game; find-an-opponent |
| Formation retry | Same match and one game, fixed sides; lasting-outcomes, find-an-opponent |
| Move/move from two devices | One accepted revision; stale revision refused; matched-game-turns |
| Resign/move; resign/resign | Legal ordering, immutable terminal outcome; matched-game.qnt, matched-game-turns, matched-game-over |
| Account deletion/formation or move | No new deleted participant; unfinished game resigned, historical result retained; multiplayer-recovery-and-privacy |

## Aggregate coverage

| Obligation | Canonical evidence |
| --- | --- |
| All person-expressible search commands | waiting-for-a-match, being-matched, search-identity, changing-ranges |
| All connection/time/world events | waits-after-time-away, rating-ranges, lasting-outcomes, availability-and-details, pair-restrictions |
| Search identity, terminal states, exactly-once outcome | matching.qnt invariants and searches.als |
| Accepted outcomes and per-device convergence | matching.qnt `invAcknowledgedOutcomes`, `invReturningAgrees`, `invOfflineKeepsKnown` |
| Match-formed event consumed by game | events.qnt publication, matched-game.qnt `pairPeopleUp`, find-an-opponent |
| Play actions and strongest refusals | matched-game-turns, matched-game-abort, matched-game-draw-offers, matched-game-rematch, matched-game-over; matched-game.qnt `playMove`, `resignGame` |
| Game continuity, privacy, account reaction | multiplayer-recovery-and-privacy, multiplayer-account-and-space |
| Game ownership, fixed sides, one unfinished game | matched-games.als; matched-game.qnt safety invariants |
| Upstream permission and usage policies | billing/access.dmn; games/unfinished-game-limit.dmn; conformance capabilities |
| Upstream blocks, paid access, spaces, friends, usernames | chess-opponent-policies, multiplayer-account-and-space |
| Keyboard and listener access | multiplayer-accessibility; real rendered control checks required |
| Match ready latency and reliability | matched-game-ready.openslo.yaml; multiplayer-game journey |
| Critical assembled flow | journeys/multiplayer-game.feature |
| Model-only bookkeeping | Bounded example identifiers, counters, received facts and sequence choices; comments in models justify the finite projection |
| Published versus private language | Context map and each context's ubiquitous-language.yml; no Chess vocabulary in generic Matchmaking |
| Environments and operation enforcement | specs/conformance.yaml; generic SQL adapters and assembled runtime bindings required |

## Reusable package audit

| Existing implementation evidence | Required implementation correction |
| --- | --- |
| Example lobby refuses duplicate begin with a process-local name/reference map | Enforce person-level exclusivity and immutable begin receipts in the public package and shared store |
| Join has no trusted owner, logical request identity or accepted-reference result | Extend generic contract; update every call site, no legacy aliases |
| Status, stop and change accept only a raw reference | Require trusted owner; unknown/foreign observations reveal no private facts |
| Range changes have no identity | Persist accepted change receipts; earlier retries cannot overwrite newer decisions |
| Tick claims a batch without rechecking its outer update predicate | Serialize operation boundary and revalidate current waiting state and formation policy |
| Candidate pruning uses the global radius and one primary bucket | Use complete formula compatibility; overrides and weighted axes must not lose valid opportunities |
| Greedy partial group building can miss a complete clique | Complete group selection with earliest compatible opportunity; no speculative team semantics |
| Default matched retention is one hour; server waiting timeout is five minutes | No automatic loss of accepted waits or outcomes |
| Schema fingerprint change rebuilds waiting tables | Reconcile without deleting accepted state; reject incompatible configuration safely |
| Consumer main menu disables Matchmaking | Integrate ordinary private play through reusable package and domain mutations/queries |
| Quint simulation stdout can exceed child-process default buffer | Preserve deep traces without false failure; pin literal regression and known-bugs entry |

## Per-feature review

For each row: A0/A1 vocabulary and product-only language reviewed against its
context glossary; B rules/one-event scenarios/outcome assertions reviewed;
C command/invariant/event/transition/policy coverage mapped above. D thin-step
binding and P executable evidence remain RED until implementation. The
existing scenarios were preserved, rather than rewritten to fit the package.

| Feature | Rules | Scenarios | Review |
| --- | ---: | ---: | --- |
| `specs/chess/chess-opponent-policies.feature` | 3 | 7 | A/B/C reviewed; D/P required |
| `specs/chess/find-an-opponent.feature` | 5 | 11 | A/B/C reviewed; D/P required |
| `specs/chess/multiplayer-accessibility.feature` | 2 | 4 | A/B/C reviewed; D/P required |
| `specs/chess/multiplayer-account-and-space.feature` | 3 | 5 | A/B/C reviewed; D/P required |
| `specs/chess/multiplayer-recovery-and-privacy.feature` | 3 | 9 | A/B/C reviewed; D/P required |
| `specs/games/matched-game-turns.feature` | 4 | 10 | A/B/C reviewed; D/P required |
| `specs/journeys/multiplayer-game.feature` | 1 | 3 | A/B/C reviewed; D/P required |
| `specs/matchmaking/availability-and-details.feature` | 4 | 10 | A/B/C reviewed; D/P required |
| `specs/matchmaking/being-matched.feature` | 2 | 7 | A/B/C reviewed; D/P required |
| `specs/matchmaking/changing-ranges.feature` | 4 | 8 | A/B/C reviewed; D/P required |
| `specs/matchmaking/competing-waits.feature` | 4 | 8 | A/B/C reviewed; D/P required |
| `specs/matchmaking/complete-groups.feature` | 2 | 5 | A/B/C reviewed; D/P required |
| `specs/matchmaking/lasting-outcomes.feature` | 3 | 6 | A/B/C reviewed; D/P required |
| `specs/matchmaking/pair-restrictions.feature` | 3 | 6 | A/B/C reviewed; D/P required |
| `specs/matchmaking/rating-ranges.feature` | 3 | 8 | A/B/C reviewed; D/P required |
| `specs/matchmaking/search-identity.feature` | 4 | 10 | A/B/C reviewed; D/P required |
| `specs/matchmaking/waiting-for-a-match.feature` | 2 | 6 | A/B/C reviewed; D/P required |
| `specs/matchmaking/waits-after-time-away.feature` | 4 | 11 | A/B/C reviewed; D/P required |

## Automated evidence before implementation

The unchanged baseline strict spec gate and Matchmaking domain tests passed.
New identity scenarios and new multiplayer scenarios failed on undefined
operations/bindings, establishing required red. Draft models were simulated
through deep histories; current semantic Chess model induction passed. Generic
induction must also pass on the committed model, not an earlier draft. Both
Alloy specifications admitted legal histories and found no counterexample to
their declared structural checks. Both DMN tables were complete and consistent.
These specification-level results do not substitute for real product replay.

The final audit must update this ledger with actual gate evidence, repeated
adversarial trace coverage and mutation/fault detection. No manual checking is
accepted, and no unspecified behavior or missing binding is treated as a pass.

## Named audit checks

- **A0 — REVIEWED:** Business-reader prose reviewed; model mechanics remain in executable bodies.
- **A1 — REVIEWED:** All own, borrowed and shared-kernel forms resolved by strict glossary gate.
- **A2 — REVIEWED:** Avoid-list scan has no remaining violation.
- **A3 — REVIEWED:** New terms are explicitly authorized by the autonomous discovery mission and listed in the spec commit body.
- **A4 — REVIEWED:** Public borrowing and events-only model imports checked by the strict gate.
- **A5 — REVIEWED:** Technical stand-ins reviewed and removed; requests refer to the documented person-expressible request.
- **A6 — REVIEWED:** Named actors or canonical world-event subjects throughout.
- **B1 — REVIEWED:** Capability titles describe a person’s job.
- **B2 — REVIEWED:** Each feature opens with its job story.
- **B3 — REVIEWED:** Every example belongs to a Rule.
- **B4 — REVIEWED:** Every rule has a success and refusal/strongest violation, or a justified No counter-example declaration.
- **B5 — REVIEWED:** One When per ordinary scenario; journeys use the explicit standard exception.
- **B6 — REVIEWED:** Given describes state; setup actions belong only to bindings.
- **B7 — REVIEWED:** When expresses one present command or event.
- **B8 — REVIEWED:** Outcomes are visible standings, identities, boards, turns, refusals or results.
- **B9 — REVIEWED:** No app-copy assertions or knowledge of storage/wire mechanics.
- **B10 — REVIEWED:** Unique action/outcome titles; strict duplicate gate reviewed.
- **B11 — REVIEWED:** Backgrounds satisfy the four-state limit; every scenario uses its context.
- **B12 — REVIEWED:** No new outlines replace numeric or permission matrices.
- **B13 — REVIEWED:** Cast names and meaningful domain ratings only.
- **B14 — REVIEWED:** No strict near-duplicate wording findings; binding duplicates must be checked after implementation.
- **B15 — REVIEWED:** Domain tags match folders; no invented tags.
- **B16 — REVIEWED:** Step counts, including backgrounds, remain within caps.
- **B17 — REVIEWED:** No technical-only scenario; numeric mechanics are model/property obligations.
- **C1 — REVIEWED:** All public model actions mapped in aggregate and command matrix.
- **C2 — REVIEWED:** Every observable invariant mapped to strongest attempted violation; bookkeeping identified.
- **C3 — REVIEWED:** MatchFormed is published and consumed as the resulting shared game.
- **C4 — REVIEWED:** Every legal transition and person-attemptable refusal indexed in both matrices.
- **C5 — REVIEWED:** Availability, blocks, membership, account deletion, names, spaces and friends reactions indexed.
- **C6 — REVIEWED:** Model vocabulary includes each command and event in the features.
- **D1 — REVIEWED:** Feature prose contains no implementation paths or identifiers.
- **D2 — REQUIRED RED:** Required thin harness-only bindings remain implementation work.
- **D3 — REQUIRED RED:** Required operation-driven bindings remain implementation work.
- **D4 — REQUIRED RED:** Missing binding entries are explicitly reported by strict gate; no extra world is introduced.
- **D5 — REQUIRED RED:** Injected virtual-time and no skipped/retried evidence required.
- **D6 — REQUIRED RED:** Each action and public variable must bind; final action reachability required.
- **P1 — REQUIRED RED:** Spec-only commit fc45ac91e preceded all product edits.
- **P2 — REQUIRED RED:** Implementers treat the committed contract as read-only; any correction returns through spec-upsert.
- **P3 — REQUIRED RED:** Final full gate, product replay and adversarial conformance remain required.
- **P4 — REVIEWED:** No behavior scenario was demoted or deleted.

## Implementation evidence in progress

The accepted specification is committed as `fc45ac91e`. Final pre-binding runs
produced 65 failures and seven passes across 72 new Matchmaking examples,
50 undefined Chess examples, and three undefined assembled journeys. These
were operation/step failures, not compile failures. Both models pass shape
checks. The expanded generic reference draw reached every action, five retained
match identities, complete groups of three (21,961 device observations) and
four (8,327 observations). The 256 by 300 Chess draw reached every action,
eight accepted moves and automatic draws. Induction remains a required gate;
the current generic proof exceeds the existing time budget.

Two literal SQL-adapter regressions first failed their outcome assertions:
a complete Bob/Carol/Dave group hidden by Alice's incompatible partial choice,
and two people 199 points apart both accepting 200 while the host default is
50. Both pass after complete group search and removal of unsafe bucket pruning.
The matcher now imports the reusable compatibility and group-selection core
from `@pkgs/matchmaking/shared`. Ten existing and new adapter checks passed.

The literal long-output Quint fixture first failed with over one MiB of
rendered console output despite a correct generated trace. The runner now
retains trace evidence in ITF files without redundant console rendering; all
six simulation-runner checks pass, including invalid-model and false-init
rejections. These fixes do not complete the required owned-search API, game
integration, bindings, conformance or release gates.

## Owned-search implementation evidence

The current public package enforces trusted ownership, immutable request
receipts, exact-reference stop and range changes, availability, symmetric
restrictions, durable terminal outcomes, and complete formation. Consumer
restriction facts are read after owner locks; a failed transaction-scoped
handoff rolls the match back. Per-device recovery retains an offline view and
rejects delayed responses superseded by disconnection or a newer read.

All 85 Matchmaking examples pass. The canonical 128 traces of 160 steps contain
20,608 observed states and reach every bound action, all 12 accepted historical
waits, and complete groups of two, three and four. The three- and four-person
matched device observations total 11,159 and 5,222 respectively. The bindings
observe eight real device views after every action and compare retained
searches and current ownership across all three replicas.

Alloy accepts the stored server snapshots captured after the model's actions,
including terminal searches and historical groups. Twenty-six mechanism and
regression checks pass, including real Postgres concurrent begins, competing
formation, handoff rollback, and authoritative consumer restrictions. The
Postgres run found compatibility-install concurrency, an overwritten injected
schema, a `float8` physical-type alias, and aborted serializable transactions;
regressions retain the literal inputs. SQLite additionally pins the paused
handoff that exposed an uncommitted match. Package type and lint checks pass.

The release verdict remains **RED**. The generic inductive proof still exceeds
the existing checker budget; boxed proof and finite-bookkeeping experiments
have not produced a verdict and have not changed the canonical specification.
Private Chess integration, its bindings, permission enforcement, critical
journeys, accessibility, and final release gates remain implementation
obligations. The next adversarial pass must also resolve distributed schema
bootstrap and configuration-change races, inspect the supported sixteen-person
Alloy boundary, and check consumer formation cannot be bypassed through a
second entry point. Passing example traces are not a substitute for those
obligations.
