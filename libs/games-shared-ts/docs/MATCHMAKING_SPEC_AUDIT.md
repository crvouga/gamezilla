# Spec audit — finding an opponent — 2026-10-24

Verdict: PASS (one warning). This is the contract audit for the four
finding-an-opponent features changed for clockless games and the new
`opponent-search.qnt` aggregate. It is not a release verdict or a claim
that the rest of Pong is complete.

## Gate and language

The strict duplicate gate passed (`.cache/pong/matchmaking-spec-audit-gate.log`).
The first run found two connection-loss phrasings; the feature now reuses
the existing “loses the connection” step. The four displaced clock-specific
definitions were replaced with the common phrasings, rather than retained
as aliases. No conflict markers, unused definitions or undefined steps remain.

A0–A6: the feature prose and model comments describe people, accounts,
searches, clock choices, ratings, sides and connections. All resolve in the
Games glossary or its declared kernel, billing, auth, spaces, friends and
matchmaking borrows. No term was added: existing meanings were generalized
where clocks are optional. The model adds names to those existing terms.
No new public event or cross-context import was introduced.

## Per feature

| Feature | A0–A6 | B1–B15, B17 | B16 |
| --- | --- | --- | --- |
| `specs/games/finding-an-opponent.feature` | Pass | Pass | Pass |
| `specs/games/finding-an-opponent-clock-choices.feature` | Pass | Pass | Pass |
| `specs/games/finding-an-opponent-devices.feature` | Pass | Pass | Pass |
| `specs/games/finding-an-opponent-without-a-clock.feature` | Pass | Pass | Warning at line 21 |

B16 warn `specs/games/finding-an-opponent-without-a-clock.feature:21` —
the paired example has six steps including its Background. Both people's
opponent rating and side are the one pairing's observable result; retaining
both checks makes the two-sided promise explicit.

Every rule has a positive and a refusal example or a stated reason that no
refusal exists. Every scenario has one event, meaningful data, a named cast
member, and an observable result. Clock-specific waiting and lineup examples
were moved intact to the clock-choice feature. No formula, wire assertion,
simulation tick, scheduler behavior or packet case was promoted to Gherkin.

## Coverage — opponent search

The aggregate fixes two existing accounts and one clockless game. Its
boundary ends at the unfinished matched game: play, completion, rematches
and rated-result recovery remain obligations of matched-game lifecycle
contracts. They are not proved by this aggregate.

| Verification | Row | Evidence | Status |
| --- | --- | --- | --- |
| C1 | `openFindingAnOpponent` | clockless feature:11; common feature:66; devices feature:8 | Covered |
| C1 | `seekOpponent` | common feature:7 | Covered |
| C1 | `stopSeeking` | common feature:73 | Covered |
| C1 | `pairPeopleUp` world event | common feature:53; clockless feature:21 | Covered |
| C1 | `loseConnection` world event | clockless feature:31 | Covered |
| C1 | `connectionReturns` world event | clockless feature:37,43 | Covered |
| C2 | `invNoClockChoice` | clockless feature:11,16,21,43 | Covered |
| C2 | `invOneCurrentPlay` | common feature:45,66,78; devices feature:23 | Covered |
| C2 | `invConnectedView` | clockless feature:37,43; devices feature:8,13 | Covered |
| C2 | `invOfflineView` | clockless feature:31; devices feature:35 | Covered |
| C2 | `invOpponent` | clockless feature:21 | Covered |
| C2 | `invRefusal` | common feature:45,78,84,90; devices feature:23,35 | Covered |
| C3 | Owned domain events | Games declares no `events.qnt`; pairing is borrowed from Matchmaking | Not applicable |
| C4 | No search → seeking, by seeking | common feature:7 | Covered |
| C4 | Seeking → no search, by stopping | common feature:73 | Covered |
| C4 | Two searches → paired, by pairing | common feature:53; clockless feature:21 | Covered |
| C4 | Seeking → same search, refused duplicate | devices feature:23 | Covered |
| C4 | Paired → same game, refused search | common feature:45 | Covered |
| C4 | No search → unchanged, refused stop | common feature:84 | Covered |
| C4 | Paired → unchanged, refused stop | common feature:78 | Covered |
| C4 | Offline → unchanged, refused search | common feature:19; devices feature:35 | Covered |
| C4 | Offline seeking → unchanged, refused stop | common feature:90 | Covered |
| C4 | Connected → offline last-known search | clockless feature:31 | Covered |
| C4 | Offline search → agreed search on return | clockless feature:37 | Covered |
| C4 | Offline search → agreed match on return | clockless feature:43 | Covered |
| C4 | Opening is idempotent and has no excluded status | common feature:33,66; devices feature:8,13 | Covered |
| C5 | Account required; paid access does not gate seeking | common feature:7,12,28,33 | Covered |
| C5 | Account deletion ends its search | `specs/games/matched-game-ownership.feature:44` | Covered |
| C5 | A space and friendship do not own the search or match | devices feature:23,29,42; ownership feature:31,37 | Covered |
| C5 | Upstream pairing gives the two people one game | common feature:53,66 | Covered |
| C6 | Every changed search command and connection event has a model name | Games glossary:520,529,817,1454 | Covered |

The fixed clock-choice and speed-rating laws remain in the timed matched-game
aggregates; this aggregate neither changes their transitions nor invents a
clock for continuous execution. `init`, `step` and `_show` are model mechanics.

## Steps and implementation handoff

D1: no package, file or code identifier appears in feature prose. D2–D6:
definitions and bindings use exported harness actions and reads. Gesture
selectors, rendered attributes and identifier normalization stay in the
owning matchmaking harness. Refusals are adapted from the actual client
mutation verdict or the visible denial/error, never manufactured from the
model's expected state. The ordinary choice action taps Find; a command a
stale screen could send uses that same client mutation boundary.

Given setup uses production mutation fixtures. When performs the one choice.
Then may focus the observer, and reads and asserts. The model observer acts
neither on the product nor on virtual time. There are no skips, retries,
wall clocks, additional worlds, or expected values calculated from rules.
The fixed list of people is iteration over observers, not a rules engine.

P1–P2: spec text and this audit are committed separately from product and
bindings. P3: `.cache/pong/matchmaking-red.log` records valid undefined-step
failures before implementation (including all six clockless scenarios).
The completed runtime checks and remaining lifecycle work belong in the
implementation ledger, not in this contract verdict.
