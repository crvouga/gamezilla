# Puzzle layout specification audit

Status: **INCOMPLETE — implementation handoff, not an acceptance pass.**
Date: 2026-10-20. Parent: `551db9170`.
Scope: the seven changed or added puzzle features, their glossary entries,
`puzzle-attempt.qnt` and `puzzle-sound.qnt`.

## Example mapping

Context: Games. Aggregate: puzzle attempt.
Story: When a solver opens a puzzle, they want to play its solution, so a
puzzle without an opponent needs no artificial setup or reply.
Commands remain opening, continuing, solving, hinting, retrying, showing
the solution, skipping, reviewing and moving on. World events remain
closing the app and losing or regaining a connection. There is no new
published domain event or domain term.

| Rule | Positive example | Negative example or reason none exists |
| --- | --- | --- |
| Start before the solver's first move | Opening shows the puzzle's start and prompts the solver | Every valid puzzle starts there; a wrong move is separately called out |
| Accept the solver's continuation | A correct move leaves the next solver move ready | Illegal moves leave the board unchanged and are not held against the solver |
| Apply automatic moves only with an opponent | Setup is already played; a correct continuation receives the recorded reply | The solver cannot move the opponent's side |
| Review without changing the result | A solved puzzle remains solved while stepped back; forward reaches the solving position | Wrong and skipped attempts require retry; historical positions refuse moves and hints |
| Review the entire played line | End, previous move, start and first listed move are visible | A retired puzzle retains its whole line; valid review never changes its outcome |
| Respect the sounds preference | Enabled moves and forward review sound | Muted moves and review remain silent; changing sounds never replays completed feedback |

The known fixture still has two solver moves. Its line has four moves when
an opponent supplies setup and reply, and two without an opponent. The
same models express both through one boolean constant, `OPPONENT`:
`OPENING`, `CONTINUATION`, `END` are respectively `1,3,4` or `0,1,2`.
Zero is the supplied position before any move. Existing opponent traces
retain their original positions and action meanings. Model execution and
verification must instantiate both cases; replay must select the case for
the consumer. An unbound constant must fail rather than select a default.

## Language and feature checks

No new term requires confirmation. The changed definitions clarify existing
`game`, `known puzzle`, `line`, `setup move` and `opponent`. Kernel terms
come from `specs/ubiquitous-language.yml`. Existing `sign in`, `host`,
`space`, `friend`, `keyboard` and `sounds` retain their published lenders
and existing Games borrows.

| Verification | Current finding |
| --- | --- |
| A0, A5 | Changed prose describes visible moves, positions, sounds and choices. No transport, database or framework concepts were added. |
| A1–A4 | No new domain terms or borrows. Start/end and solver moves use the existing line, solution and review meanings. |
| A6 | Actors are Alice, the solver and the opponent. |
| B1–B3 | Capability titles, job stories and Rules remain. The opponent-only examples have one shared feature rather than one per game. |
| B4 | Correct continuation and illegal move share the move-authority rule. Automatic reply and refused opponent input share the opponent rule. Refusal examples remain in puzzle-refusals. Always-applicable review and sound-change rules state why they have no counter-example. |
| B5–B9 | Each example has one When, factual Givens, observable Thens and no quoted application copy. |
| B10–B13 | Titles describe outcomes. Review examples vary direction and destination, with two rows each. Backgrounds are used by every scenario they govern. |
| B14 | Pending rebinding and deletion of six retired numeric definitions. Strict checking also reports nine collisions outside the changed puzzle definitions; see below. |
| B15 | Existing domain and regression tags remain; the new feature uses domain:games. |
| B16 | No example exceeds eight steps. Thirty-two scenario headers remain at six or seven steps, including the three added in-place review examples. These are warnings: one action with distinct visible progress/result observations. |
| B17, D1 | The examples remain behavior under a rewrite. Constants describe line positions; no implementation API appears in product prose. |
| D2–D6 | Full step/binding audit remains pending the implementation commit. No step or binding was edited during authoring. |
| P1–P2 | This checkpoint contains only specs and documentation. Implementers must treat these specs as read-only. |
| P3 | The spec gate reports undefined replacement steps. Actual scenario execution must additionally demonstrate red before binding. |

## Per feature

| File in specs/games | Contract retained or added | Pending work |
| --- | --- | --- |
| solve-flow.feature | Start, finish, wrong move, success/error haptics | Bind start observation |
| solve-move-rules.feature | Correct continuation, illegal input, wrong/finished move refusal | Bind progress observation; the existing continuation example moved here, without a copy |
| puzzle-opponent.feature | Setup, automatic reply, opponent-input refusal | Enroll only consumers whose puzzles have an opponent |
| solve-show-solution.feature | Full line, revealed state, stopped play, failed result and rating | Bind end observation |
| puzzle-refusals.feature | Finished, historical and wrong-state refusals | Bind the earlier position relative to the actual reached position |
| puzzle-review.feature | Game-log navigation, animation, keyboard, flick, retirement; in-place solved-result preservation, forward continuation and direct selection | Bind destination names; audit every status row below |
| puzzle-sound.feature | Enabled/muted feedback and review; progress retained and old feedback not replayed | Bind progress and named review positions |

## Coverage: puzzle-attempt.qnt

These are source coverage addresses, not executed verdicts. `G` means
`specs/games/`. Line numbers are the opening lines of the relevant feature
rules at this authoring checkpoint. Every action remains bound by its
existing name; none was removed to make a consumer pass.

| Kind | Model name | Contract source | Status |
| --- | --- | --- | --- |
| command | openPuzzles | G/solve-flow.feature:11; G/puzzle-offline.feature:7 | covered |
| command | goBackToPuzzles | G/puzzle-attempt-resume.feature:11 | covered |
| command | leavePuzzle | G/puzzle-spectator.feature:52 | covered |
| command | backToGameChoice | G/puzzle-attempt-resume.feature:56 | covered |
| command | solve | G/solve-flow.feature:11; G/puzzle-controls.feature:11 | covered |
| command | playWrongMove | G/solve-flow.feature:11 | covered |
| command | playCorrectContinuation | G/solve-move-rules.feature:10 | covered |
| command | requestHint, revealSolutionMove | G/puzzle-controls.feature:11 | covered |
| command | stepBackPosition, stepForwardPosition, chooseReviewPosition | G/puzzle-review.feature, in-place review rule | covered, new examples |
| command | showSolution | G/solve-show-solution.feature:7 | covered |
| command | skip | G/puzzle-skip-clock.feature:7 | covered |
| command | retry | G/puzzle-controls.feature:28 | covered |
| command | moveOn, moveOnTwiceAtOnce | G/puzzle-attempt-resume.feature:33; G/puzzle-play.feature:11 | covered |
| command | tryMoveAfterFinish, tryHintAfterFinish, tryShowSolutionAfterFinish, trySkipAfterFinish | G/puzzle-refusals.feature:11 | covered |
| command | tryMoveFromReview, tryHintFromReview, tryShowSolutionFromReview | G/puzzle-refusals.feature:63 | covered |
| command | tryHintBeforeRetry, tryMoveBeforeRetry | G/puzzle-refusals.feature:92 | covered |
| command | tryRetryWhileSolving | G/puzzle-controls.feature:28 | covered |
| command | trySolutionBeforeHint | G/puzzle-refusals.feature:113 | covered |
| command | tryIllegalMove | G/solve-move-rules.feature:10 | covered |
| command | tryEarlierHint | G/puzzle-refusals.feature:127 | covered |
| command | tryReviewBeforeRetry | G/puzzle-refusals.feature:145 | covered |
| command | suggestMove | G/puzzle-spectator.feature:68 | covered |
| command | reopenApp | G/puzzle-attempt-resume.feature:64 | covered |
| world | timePasses | G/puzzle-skip-clock.feature:7 | covered |
| world | connectionReturns | G/puzzle-offline.feature:7; G/puzzle-late-watcher.feature:22 | covered |
| invariant | invStartsWithinAllowance | G/puzzle-quota.feature; G/puzzle-exhaust.feature | covered; this model's three-puzzle bound cannot exhaust the daily allowance |
| invariant | invMoveOnOnlyWhenOver | G/puzzle-play.feature:11; G/puzzle-spectator.feature:12 | covered |
| invariant | invNothingOffTheBoard | G/puzzle-spectator.feature:52 | covered |
| invariant | invWatcherSeesTheHostsBoard | G/puzzle-spectator.feature:52 | covered |
| invariant | invOfflineWatcherKeepsTheBoard, invWatcherFollowsHostAvailability | G/puzzle-late-watcher.feature:22; G/puzzle-interruption-recovery.feature:7 | covered |
| invariant | invOnlyReachedPositions | G/puzzle-refusals.feature:63; G/puzzle-review.feature | covered |
| invariant | invHelpBelongsToPosition | G/puzzle-refusals.feature:63,92,113,127 | covered |
| invariant | invSolvedReviewCannotReactivate | G/puzzle-review.feature, in-place solved review example | covered, new example |
| liveness | liveReturningWatcherFollows | G/puzzle-late-watcher.feature:22 | covered |
| event | none | Games publishes no events.qnt | not applicable |

C4 is **not yet fully audited**. The following matrix records the guards
that implementation and the remaining coverage review must retain:

| Command group | Legal states | Refused or unavailable states |
| --- | --- | --- |
| Solver moves | solving, at current position | wrong before retry; solved/revealed/skipped; historical position |
| First/second hint | solving, current position, preceding help stage | finished, wrong, historical, repeated first hint, second before first |
| Show solution | solving or wrong, current position | finished or historical |
| Retry | wrong, solved, revealed, skipped | solving; no puzzle |
| Review | solving, solved, revealed; reached positions | wrong/skipped before retry; beyond reached positions |
| Move on | solved, revealed, skipped; host | solving/wrong; watcher |
| Open/return | game choice or game choices; known offline content | no content offline |
| Leave/reopen | retained attempt in every puzzle state | choices absent off the board |

In particular, every legal review command × puzzle-state row still needs
individual confirmation; a game-log review is not evidence for the
in-place room command. This report does not mark C4 complete based on the
three new examples. C5 retains the existing guest carryover, account
deletion and offline/recovery features; no new cross-context policy was
introduced. C6 model and feature meanings agree at the source level; both
OPPONENT values still need executable model and implementation evidence.

## Coverage: puzzle-sound.qnt

| Kind | Model name | Contract source | Status |
| --- | --- | --- | --- |
| command | playPuzzleMove | puzzle-sound.feature, enabled and muted continuation examples | covered |
| command | stepPuzzleSoundReview | puzzle-sound.feature, enabled and muted review examples | covered |
| command | configurePuzzleSounds | puzzle-sound.feature, sound-change rule | covered |
| invariant | invPuzzleSilence | muted move, wrong feedback and review examples | covered |
| invariant | invPuzzleSoundPosition | before/after continuation and final review observations | covered |
| transitions | sounds on/off × puzzle/review before/after action | sound changes and enabled/muted examples | covered at source; execution pending |
| events/policies | none added | local surface; existing app sounds preference | unchanged |

## Gate evidence and handoff

`bun run spec:verify` finds undefined replacement steps and six retired
numeric definitions. It reports no new vocabulary, shape or prose failure.
The six definitions must be removed while rebinding, not retained as aliases.
At the authoring checkpoint the model-parameter execution path was not implemented.

The documented strict flag cannot pass through the root wrapper: it reaches
Turbo as its own option. The equivalent package-owned task was run as
`bunx turbo run @libs/tools#ci:specs -- --strict-duplicates`. It additionally
reports nine existing B14 pairs in custom-game wording, friends space
wording and the matched-game repeated-move phrase. They are not dismissed
as passes; the strict audit remains incomplete until addressed.

Next: run the changed scenarios red, bind named positions through public
harness reads/actions, instantiate and verify both boolean model cases,
then implement solver-only puzzles through the existing shared lifecycle.
No single-player support or completed-spec-audit claim is made here.

## Implementation checkpoint

The replacement definitions are bound, and all six unused numeric
expressions were deleted. Named destinations are translated by a shared
harness helper over the consumer's authored fixture and declared layout.
The seven feature files passed 134 checks for Chess and the counting race
reference. Before rebinding, 38 checks failed on undefined steps and 58
passed; the runner stopped early, so this is not a claim that every one of
the 134 had executed red. Completing P3 evidence for every rewritten
example remains part of the final audit.

The first rebound run found six failures in the new review observation,
which referenced a nonexistent probe field. That observation now uses the
visible position captured before the review action. The subsequent full
selected-feature run passed. All 17 affected package type/lint/test tasks
also passed. Solver-only core setup, staged solution, completion and review
now have focused example coverage, but client navigation, fixtures, shared
suite enrollment and executable model constant instantiation remain open.
This checkpoint does not change the INCOMPLETE verdict above.

The ordinary `bun run spec:verify` passed after catalog regeneration. Its
strict form still fails on exactly the nine previously recorded wording
pairs, with no new pair from these bindings. All 64 dependency, boundary,
task-policy, test-ownership and regression-register checks passed.
An explicit run of the two changed models type-checked and passed shape
checks, but trace generation failed with `QNT500: Uninitialized const
OPPONENT`. This identified the runner gap closed in the checkpoint below;
the seven passing feature files did not substitute for it.

The full gate also exposed a verifier mismatch: it rejected this package's
Markdown audit document beside specs. `15e5950cc` corrects the documentation
path rule, with the literal commit/path pinned and negative source-file
controls retained. All 14 ownership checks and the actual history gate
pass. The subsequent full repository gate again stops on the unchanged
deploy YAML alias; this does not clear the independent model and audit gaps.

## Model execution checkpoint

The runner now closes declared boolean constants in private compiler inputs
and groups implementation variants by their complete assignment. Trace
cache identity, action covers and replay plans distinguish assignments.
Both proof paths check every combination within the existing overall
deadline, independent of which games are currently registered.

Both attempt-model instances passed complete TLC verification: 14,422
states without an opponent, 17,626 with one, depth 20 for each. Both sound
instances passed every invariant at the existing four-step bound. The
actual shared-model replay command passed 20 checks for the currently
enrolled Chess and counting reference consumers, both with an opponent.
Native fixture checks also cover both assignments, cache separation,
equivalence to native Quint instantiation, variant attribution, slicing,
and counterexamples found only in the second assignment.

This closes the uninitialized-constant execution gap. It does not complete
C4, the strict wording audit, every scenario's P3 evidence, client navigation
or solver-only consumer enrollment. The verdict remains INCOMPLETE.

A fresh full `bun verify` again stopped at the unchanged deploy YAML alias
at lines 160/170 (`verify-run-JwHcDg/diagnostics.tar.gz`). Preparation and
spec ownership passed; this is not a full green verdict.

## Navigation execution checkpoint

The shared navigation functions and client controllers now use the declared
starting index. A review cursor can remain at zero; null means the initial
end view. Existing selection and seek message payloads remain integers, and
an older opponent review at zero still displays the end. Literal failures
for disabled Back and zero being overwritten are in the bug register.

Nine affected package tasks passed, including 596 tests, and the selected
seven features plus both models passed 154 checks for the existing enrolled
consumers. The isolated framework contract also passed its 202 internal
checks. The fresh-seed property task passed 155 files at the deeper 200-case
budget after repairing its Bash startup timeout. The whole nightly group
was stopped after that failure and is not green evidence.

This closes the client bounds/cursor gap. Solver-only fixture checking,
board feedback, shared-suite enrollment, C4, strict wording and complete P3
evidence remain open. The verdict is still INCOMPLETE.

## Consumer enrollment execution checkpoint

The solo consumer is checked and enrolled in the common composition, with
three known puzzles and thirty more, real marks and audio, and no fabricated
opponent input. Fixture and conformance indices follow the declared layout;
head-to-head turn and victory obligations remain enforced for the relevant
capabilities. The first shared puzzle suite run failed 13 checks; its
parameterized follow-up passed all 197. Both common layout models then
passed all 29 checks with the solo implementation included, not merely an
abstract constant assignment. Literal regressions pin the first correct cue,
zero selection and puzzle-only menu recognition failures those runs found.

The broader inherited feature/model run and final package, isolation and
repository checks are pending. C4, strict wording and complete P3 evidence
remain open; this checkpoint does not change the INCOMPLETE verdict.

The navigation checkpoint's full `bun verify` again failed on the unchanged
deploy YAML alias (`verify-run-GfskPh/diagnostics.tar.gz`). It is not a full
green verdict.
