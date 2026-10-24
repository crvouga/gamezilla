# Puzzle lifecycle specification audit

Date: 2026-10-24. Scope: the four new Puzzles lifecycle models and the
publication, saved-attempt and progression examples they touch.
Verdict: FAIL (C6 remains open). All four critical models pass product replay
and bounded checking at four steps. The complete context passes 108 checks.
Creation, validation, playtest and concurrent-edit commands still need their
own model coverage. The strict gate reports thirteen wording pairs outside
Puzzles, with no remaining Puzzles gate error. This checkpoint does not close
the context audit or the full release gate.

## Example map and writer review

Context: Puzzles. Aggregates: puzzle publication, pack publication, personal
attempts and pack progression. The job stories and product definitions remain
in the linked features and glossary; this report records coverage only.

| Rule | Permitted example | Refused or contrasting example |
| --- | --- | --- |
| Publish a named, validated draft | `publish-puzzles.feature:7` | Missing details, missing title and another author at lines 13, 19 and 77 |
| Keep editions stable | Editing and republishing at `publish-puzzles.feature:28` | Repeating an earlier publication cannot replace a later choice or withdrawal at lines 57 and 62 |
| Publish an author's available pack | `publish-packs.feature:7` | Private, withdrawn, empty and foreign-author cases at lines 12, 18, 24 and 30 |
| Keep pack references and order stable | `publish-packs.feature:39`, 46 and 55 | No counter-example: changing public contents requires another pack publication |
| Repeat a saved pack publication once | `publish-packs.feature:85` | Later order and withdrawal remain current at lines 90 and 96 |
| Keep a personal attempt's position and edition | `keep-attempts.feature:21`, 26 and 87 | Unavailable content and private attempts at lines 12 and 32 |
| Offer only supported history | `keep-attempts.feature:40` and 46 | Fresh undo/redo and replaced redo at lines 51, 57 and 63 |
| Keep completion through restart | `keep-attempts.feature:72` and 78 | No counter-example: restarting begins another attempt |
| Continue unfinished pack play and count each edition once | `pack-progression.feature:12`, 18, 27 and 43 | Incomplete and fully completed packs at lines 49 and 55 |

A0–A6: headers and new examples use existing Puzzles terms, the named cast and
kernel app/connection language. No term or definition is added. Glossary
changes attach model names to existing terms only. Record types, bounds and
bookkeeping stay in model bodies. No implementation files were read while
authoring these models.

B1–B3: the existing capability titles and job stories remain; every new
scenario is under a Rule. B4: each ordinary rule has success and refusal
examples, or retains its explicit true `No counter-example` explanation.
The pack-withdrawal rule now includes its foreign-author refusal and no longer
claims there is no counter-example. B5–B13: one command per example, facts in
Givens, observable outcomes with refusal reasons, plausible River/Valley
data, no outlines, interface copy or technical assertions. B15–B17: existing
domain tags only, no scenario exceeds eight steps, behavior survives a rewrite.
The new post-withdrawal publication example has six steps, retained to show
both the new publication and the earlier edition remaining available.

B14: existing wording is reused for publication, withdrawal, pack discovery,
completion and redo. New phrasings distinguish pack ownership, an earlier
pack order, withdrawal as a setup fact, a retained earlier attempt, missing
redo history, the tablet's saved pack order and a complete pack's lack of unfinished play. None aliases an
existing phrase with the same meaning and grammatical role. Exact new
definitions are the implementer's handoff; generated catalogs are not edited.
Strict whole-repository duplicate findings remain outside Puzzles.

## Puzzle publication coverage

| Kind | Model name | Term | Evidence | Status |
| --- | --- | --- | --- | --- |
| command | `savePuzzleDraft` | save | `author-drafts.feature:22`, 28; foreign edit at 40 | covered |
| command | `choosePuzzleDraft` | draft copy | `author-drafts.feature:62`; foreign choice at 46 | covered |
| command | `publishPuzzle` | publish | `publish-puzzles.feature:7`, 34, 41, 52, 57, 62, 77 | covered |
| command | `withdrawPuzzle` | withdraw | `publish-puzzles.feature:71`, 83 | covered |
| command | `reopenApp` | the app | `offline-work.feature:13` | covered |
| world | `connectionReturns` | connection | `offline-work.feature:39` | covered |
| world | `_loseConnection` | — | `puzzle-publication.qnt:77` | model-only |
| invariant | `invPublishedContentIsValid` | validate, title, author | `publish-puzzles.feature:13`, 19, 77 | covered |
| invariant | `invEditionsNeverChange` | edition | `publish-puzzles.feature:28`, 34, 57, 62 | covered |
| invariant | `invDiscoveryChoosesAnEdition` | discover | `publish-puzzles.feature:7`, 71 | covered |
| invariant | `invConnectedDevicesAgree` | save, connection | `offline-work.feature:39` | covered |
| invariant | `invOfflineWorkIsKept` | save | `offline-work.feature:13` | covered |
| transition | private → public; public → new edition; withdrawn → new edition | publish | `publish-puzzles.feature:7`, 34, 41 | covered |
| transition | public → withdrawn | withdraw | `publish-puzzles.feature:71` | covered |
| refusal | invalid, unnamed or foreign draft publication | publish | `publish-puzzles.feature:13`, 19, 77 | covered |
| refusal | foreign withdrawal or draft change | author | `publish-puzzles.feature:83`; `author-drafts.feature:40`, 46 | covered |
| invariant | copy count and draft indices | — | `puzzle-publication.qnt:38`, 109 | model-only |

## Pack publication coverage

| Kind | Model name | Term | Evidence | Status |
| --- | --- | --- | --- | --- |
| command | `savePackDraft` | save | `author-packs.feature:56`; `publish-packs.feature:55` | covered |
| command | `publishPack` | publish | `publish-packs.feature:7`, 61, 85, 90, 96 | covered |
| command | `withdrawPack` | withdraw | `publish-packs.feature:70`, 76 | covered |
| command | `publishPackPuzzle` | puzzle, publish | `publish-packs.feature:39` | covered |
| command | `withdrawPackPuzzle` | puzzle, withdraw | `publish-packs.feature:46` | covered |
| command | `reopenApp` | the app | `offline-work.feature:18` | covered |
| world | `connectionReturns` | connection | `offline-work.feature:45` | covered |
| world | `_loseConnection` | — | `pack-publication.qnt:88` | model-only |
| invariant | `invPackReferencesPublishedEditions` | edition, pack contents | `publish-packs.feature:12`, 18, 24 | covered |
| invariant | `invPackEditionsNeverChange` | edition | `publish-packs.feature:39`, 46, 55, 90, 96 | covered |
| invariant | `invDiscoveryChoosesAnEdition` | discover | `publish-packs.feature:7`, 70 | covered |
| invariant | `invWithdrawalKeepsEarlierReferences` | withdraw | `publish-packs.feature:46` | covered |
| invariant | `invConnectedDevicesAgree` | save, connection | `offline-work.feature:45` | covered |
| invariant | `invOfflineWorkIsKept` | save | `offline-work.feature:18` | covered |
| transition | draft → public; public → new order | publish | `publish-packs.feature:7`, 61 | covered |
| transition | public → withdrawn | withdraw | `publish-packs.feature:70` | covered |
| refusal | private/withdrawn contents, empty pack or foreign author | publish | `publish-packs.feature:12`, 18, 24, 30 | covered |
| refusal | foreign withdrawal | author | `publish-packs.feature:76` | covered |
| invariant | explored draft/edition bounds | — | `pack-publication.qnt:40`, 69 | model-only |

## Puzzle attempt coverage

| Kind | Model name | Term | Evidence | Status |
| --- | --- | --- | --- | --- |
| command | `startPuzzle` | start a puzzle | `keep-attempts.feature:7`, 12 | covered |
| command | `advanceAttempt` | puzzle | `keep-attempts.feature:63`; `pack-progression.feature:12` | covered |
| command | `undoAttempt` | undo | `keep-attempts.feature:40`, 51 | covered |
| command | `redoAttempt` | redo | `keep-attempts.feature:46`, 57, 63 | covered |
| command | `restartPuzzle` | restart | `keep-attempts.feature:72`, 78 | covered |
| command | `resumeAttempt` | resume | `keep-attempts.feature:26` | covered |
| command | `reopenApp` | the app | `keep-attempts.feature:21`; `offline-work.feature:25` | covered |
| command | `publishPuzzleEdition` | publish | `keep-attempts.feature:87` | covered |
| command | `withdrawPuzzle` | withdraw | `keep-attempts.feature:94` | covered |
| world | `connectionReturns` | connection | `offline-work.feature:50` | covered |
| world | `_loseConnection` | — | `puzzle-attempt.qnt:105` | model-only |
| invariant | `invAttemptPositionsAreKept` | attempt | `keep-attempts.feature:21`, 26, 40, 46 | covered |
| invariant | `invEarlierAttemptsKeepTheirEdition` | edition | `keep-attempts.feature:72`, 87, 94 | covered |
| invariant | `invCompletionHasAnAttempt` | completion | `pack-progression.feature:12`, 18 | covered |
| invariant | `invCompletionNeverDisappears` | completion | `keep-attempts.feature:78` | covered |
| invariant | `invConnectedCompletionAgrees` | completion, connection | `offline-work.feature:50` | covered |
| invariant | `invOfflineCompletionIsKept` | completion | `offline-work.feature:50` | covered |
| invariant | `invWithdrawalPreservesSavedPlay` | withdraw | `keep-attempts.feature:94` | covered |
| transition | available → withdrawn; withdrawn → available | withdraw, publish | `keep-attempts.feature:94`; `publish-puzzles.feature:41` | covered |
| refusal | unavailable new play; fresh undo/redo; replaced redo | start, undo, redo | `keep-attempts.feature:12`, 51, 57, 63 | covered |
| invariant | representative game's three actions and explored attempt bounds | — | `puzzle-attempt.qnt:1`, 40 | model-only |

## Pack progression coverage

| Kind | Model name | Term | Evidence | Status |
| --- | --- | --- | --- | --- |
| command | `openPack` | pack | `pack-progression.feature:7`, 49 | covered |
| command | `startPackPuzzle` | pack, start a puzzle | `pack-progression.feature:35` | covered |
| command | `completePackPuzzle` | completion | `pack-progression.feature:12`, 18, 43 | covered |
| command | `restartPackPuzzle` | restart | Restart is a Given at `pack-progression.feature:20`; its When is `keep-attempts.feature:78` | covered |
| command | `continuePack` | pack progress | `pack-progression.feature:27`, 55 | covered |
| command | `reopenApp` | the app | `offline-work.feature:25` | covered |
| world | `connectionReturns` | connection | `offline-work.feature:50` | covered |
| world | `_loseConnection` | — | `pack-progression.qnt:72` | model-only |
| invariant | `invCompletedPuzzlesWerePlayed` | attempt, completion | `pack-progression.feature:12`, 35 | covered |
| invariant | `invCompletionCountIsDistinct` | completion | `pack-progression.feature:18` | covered |
| invariant | `invPackCompletionRequiresEveryPuzzle` | pack progress | `pack-progression.feature:43`, 49 | covered |
| invariant | `invProgressMatchesPlay` | pack progress | `pack-progression.feature:7`, 12, 35 | covered |
| invariant | `invContinueOffersUnfinishedPlay` | pack progress | `pack-progression.feature:27`, 49, 55 | covered |
| invariant | `invCompletionNeverDisappears` | completion | `pack-progression.feature:18`; `keep-attempts.feature:78` | covered |
| invariant | `invConnectedDevicesAgree` | connection | `offline-work.feature:50` | covered |
| invariant | `invOfflineProgressIsKept` | pack progress | `offline-work.feature:50` | covered |
| transition | unfinished → complete; unfinished → unfinished | completion | `pack-progression.feature:43`, 12 | covered |
| refusal | continuing a complete pack | pack progress | `pack-progression.feature:55` | covered |

## Events, policies and context gaps

C3: Puzzles has no `events.qnt` and introduces no published event here.
C5: no upstream event reaction is introduced by these models. Existing
borrowed identity, billing, game and control concepts remain governed by the
permission decision and their owning contexts; this report does not claim
their broader integration audit.

C6 remains open for creation, private inspection, validation, beginning and
finishing a playtest, adding/removing individual pack contents, creating from
a pack, simultaneous saved draft orders and simultaneous attempt continuations.
Whole-order saving covers pack publication integrity, but does not replace a
model of authoring or concurrent choices. Those commands must not be hidden
behind a generic save action in the final coverage map.

## Initial execution and implementation handoff

All four files typecheck with the installed Quint 0.32.0. Each independently
simulates 50 seeded traces of up to 40 steps with every declared invariant
enabled, seed 424242, TypeScript evaluator: no violations. This is evidence
about the models only, not product conformance or bounded proof.

The ordinary spec gate accepts the model shapes and glossary names. It reports
the missing `verify:models` task, model discovery index and all four bindings.
These are the implementer's handoff. The strict gate ran through the package's
Turbo task (`bunx turbo run ci:specs --filter=@libs/tools-harness-ts --
--strict-duplicates`). It reports undefined new wording and those missing
bindings, plus thirteen duplicate wording pairs outside Puzzles. No new pair
involves Puzzles. The full context test invocation stops at the missing Quint
discovery index, before executing examples: it is not an initial behavioral
red run. Add discovery, then run the examples before binding their new wording.
The final pack-reconnection example was added after that strict run and still
needs its gate execution. P1 requires a separate `spec:` commit. No product or
step source belongs in that commit.

D1: no implementation paths or identifiers appear in feature or model prose.
D2–D6: new bindings do not yet exist; no conformance claim. Bind through the
shared counting example and actual mutation/query paths, observing public
state after every action. Never implement an expected-state calculator in the
binding. Add discovery and the bounded verification task through the existing
package conventions, then run the new examples red before binding them.

## First implementation handback

The coverage-map line references above identify the initial contract in
`7fc38f2ac`. The first real publication replay failed at trace 1, step 16,
`publishPuzzle(draft: 0, person: "Alice")`: the model published an older,
unpublished draft that had not been chosen as the working draft. This was a
model-boundary mistake. The existing publish definition says publication
follows the author's chosen draft, and the draft definition/choice examples
say a kept copy is chosen before becoming the working draft. Repeating an
already published draft is a separate permitted command and remains tested.
The implementer handed this back rather than changing publication behavior
to accept an unchosen copy. Both publication models now restrict new
publication to the working draft, retaining repetition of earlier editions.

The pack model also now keeps the chosen edition with each private draft item.
Reordering retains that choice; adding an item chooses its available edition;
a puzzle not yet published waits for its first edition. Publication resolves
only that waiting choice. The added example, “Publishing a pack keeps the
puzzle edition chosen in its draft”, illustrates the already-defined stable
choice when the puzzle gains a later edition before the pack is published.
It adds one setup phrase about the chosen puzzle's later publication, and
reuses publication/discovery wording. No term or product definition changes.
These corrections belong in another separate `spec:` commit. Both corrected
models typecheck and independently simulate 50 seeded traces of up to 40 steps
with every invariant enabled, without a violation. The new pack example ran
red on its undefined setup phrase, with the other fourteen pack-publication
examples passing. The strict gate again reports the three remaining missing
model bindings, this new phrase, and thirteen wording pairs outside Puzzles.
The first model's product replay was still open at that handback; current
implementation evidence follows.

## Current implementation evidence

The four bindings call only exported reference-app actions and observations.
Every operation uses the real shared mutation/query implementation. The
attempt model uses the same non-grid example game with a three-step target;
its author also plays, so offline publication is an action on that person's
own phone rather than invisible changes from another person. Historical
completion is read from retained positions through the game's real projection.
The progression model reads the shared pack-progress projection. No binding
computes expected domain behavior, issues SQL, or touches interface selectors.

Each model draws 24 traces of up to 32 steps, checks every invariant over the
draw, and verifies that every bound action appears. The PR profile replays
the smallest selected trace set covering those actions, as the repository
contract requires. All four replays pass; this is not a claim that every
drawn trace has been replayed in the deeper profile. A pinned 32-step pack
history also passes on every run.

That history caught a harness observation defect: a withdrawn document keeps
its old edition for saved play, while discovery correctly hides it. The
observer incorrectly called that retained pointer publicly current. It now
uses the product's discovery projection. The literal history failed before
the observation fix, is registered under
`puzzle-withdrawal-observation-uses-retained-edition`, and has its own known-bug
entry. No product publication behavior was changed to satisfy this observation.

The package's model gate proves all 26 declared invariants in every reachable
state within four steps. All four models have passing shape and proof
evidence. The package's typecheck, lint and nine code tests pass. All 108
checks pass together: 80 feature examples, seven decision checks and 21 model
checks/replays. Every added feature example first ran on undefined wording.
Generated catalogs and input fingerprints were refreshed; the strict gate
then reported only the thirteen duplicate wording pairs outside Puzzles.

The known-bug gate also exposed its own parser rejecting nested world types.
A literal `Run<World>` regression was red before balancing type brackets;
unclosed types still refuse. Tooling typecheck, lint, all 866 tests and the
known-bug gate pass after that separate fix. The generated CI capacity section
now includes the new model gate, without changing runner limits or deadlines.

The subsequent [publication recovery audit](PUZZLE_RECOVERY_SPEC_AUDIT.md)
adds a fifth aggregate and eleven examples. The complete context now passes
127 checks. All 32 invariants pass bounded checking within four steps, and
the official nightly profile passes all 120 drawn histories plus four pinned
histories across the five models. This is a targeted context run, not a full
nightly verdict. Deeper findings are retained in PR replay: same-instant
activity ordering, harness HTTP retirement, and a recovery fixture wait.

Remaining: the C6 commands above, their complete transition/coverage audit,
production-bundle execution and the full Verify gate. The strict gate still
finds thirteen wording pairs outside Puzzles, preventing a whole-tree PASS.
