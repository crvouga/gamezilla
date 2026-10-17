# Multiplayer space coverage

The requested contract keeps every chess game inside spaces. The multiplayer
match is shared by both hosts' spaces; guests watch without gaining a side.

| Rule | Positive example | Boundary example |
| --- | --- | --- |
| Finding requires a space | A host finds an opponent from the space's chess choices | A person outside a space cannot find a chess opponent |
| Both spaces follow one board | Guests in different spaces see the accepted multiplayer move; a guest arriving after a move sees the current multiplayer board | No counter-example: membership in either space grants watching the same game |
| Watching gives no side | A matched host moves from their space | A guest watching a multiplayer game cannot move |
| Only people in either space watch | A guest sees the result shared by the matched people | Someone outside either space cannot watch; a guest who leaves no longer sees the multiplayer board |

## Aggregate coverage

The existing `games/matched-game.qnt` owns pairing handoff, moves, results, account
withdrawal, device agreement and disconnection. Its space membership is now
explicitly supplied by scenario setup. `games/matched-game-spaces.qnt` owns watching
that game from either space, leaving, returning and the matched people's side.

| Model action or invariant | Observable coverage |
| --- | --- |
| `joinSpace` | Late-arriving guest; guests in both spaces |
| `leaveSpace` | A guest who leaves no longer sees the multiplayer board |
| `openMultiplayer` | Returning to multiplayer chess does not start a new game |
| `playMove` | Matched host moves; guest move refused |
| `resignPlay` | Guest sees the matched people's result |
| `loseConnection`, `comeBackOnline` | Model traces cover an offline guest keeping the accepted board and catching up on return |
| `invSharedBoard` | Guests in two spaces see e4; late guest sees e4 |
| `invOutsideCannotWatch` | Outsider unavailable; guest leaves |
| `invMatchedPeopleOnly` | Guest cannot move; ongoing game and result both keep watcher controls unavailable |

Joining and leaving change visibility; accepted moves change the shared board;
resigning changes unfinished play to a permanent result. A guest's attempted
move is refused, and someone outside either space cannot open the game.
Upstream matchmaking's accepted match remains covered by `find-an-opponent.feature`.
No new upstream event or product term was added.

## Audit

A0–A6: product prose uses the existing chess, spaces and shared glossaries;
all four cast names already exist; there is no new term or technical concept
in feature prose. B1–B17: one job story, four rules with positive and boundary
examples, one event per scenario, factual setup, visible results and refusals,
existing wording where available, known domain and regression tags, no outline,
and at most six steps. The two additional watcher outcome phrasings describe
new observations not previously catalogued. C1–C6: the watching model and the
map above cover the added commands, visible invariants and state transitions.
D1: the feature survives an implementation rewrite. D2–D6 are checked with the
bindings. P1: specification changes are committed separately.

Report-only strict duplicate audit: INCOMPLETE. The gate reports existing
near-duplicate multiplayer and matchmaking steps (gendered pronouns, repeated
resignation, turn/result wording, blocking and rating wording). None was added
by this feature. New model bindings and outcome steps are an implementation
handoff until they pass the ordinary spec gate.

Code checks cover room admission, forged room commands, stale deliveries,
namespace isolation and identity erasure. Those mechanisms are not business
scenarios (B17).

The `matched-game-watch-access` decision table covers every combination of guest,
free account and Plus member with host, joined and outside presence. Application,
server room admission and client gating agree on all nine cases. The conformance
manifest declares watching as its own capability. Returning to Puzzle after
looking for an opponent preserves the position shared by the space.
