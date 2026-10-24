# Puzzle authoring model audit

Date: 2026-10-24. Verdict: INCOMPLETE. The remaining Puzzles C6 commands
now have explicit models, but two new product bindings and three new bound
actions are not implemented yet. The strict gate also retains thirteen B14
wording pairs outside Puzzles. This report does not claim product conformance
or a green release gate.

## Mapping and writer review

Context: Puzzles. Aggregates: private puzzle authoring and private pack
authoring; extensions to puzzle publication, pack publication and personal
attempts. The job stories remain in `author-drafts.feature`,
`playtest-drafts.feature`, `author-packs.feature` and `offline-work.feature`.
No feature wording, product definition or glossary term changes. Glossary
edits attach model identifiers to existing terms only.

A0–A6: model headers describe Alice's and Bob's private work, play and
connection in the existing language. Record shapes and finite exploration
bounds stay inside model bodies. No implementation or binding source was read
during authorship. The existing feature review in
[the lifecycle audit](PUZZLE_LIFECYCLE_SPEC_AUDIT.md) and
[the recovery audit](PUZZLE_RECOVERY_SPEC_AUDIT.md) applies; no new B1–B17
wording is introduced. D1: no implementation identifiers or paths in prose.
D2–D6 are the implementer's handoff, not completed evidence.

## Private puzzle authoring

| Kind | Model name | Existing example | Status |
| --- | --- | --- | --- |
| command | `createPuzzleDraft` | `author-drafts.feature`, new private draft; `offline-work.feature`, offline creation | covered |
| command | `saveAuthoringDraft` | `author-drafts.feature`, saved metadata, incomplete work, author rename and foreign rename refusal | covered |
| command | `inspectPuzzleDraft` | `author-drafts.feature`, private creation/read and known-name refusal | covered |
| command | `validateDraft` | `playtest-drafts.feature`, complete and incomplete validation | covered |
| command | `beginPlaytest` | `playtest-drafts.feature`, author starts and Bob is refused | covered |
| command | `completePlaytest` | `playtest-drafts.feature`, private completion keeps ordinary progress unchanged | covered |
| command | `reopenApp` | `offline-work.feature`, created offline draft survives reopening | covered |
| world | `connectionReturns` | `offline-work.feature`, draft reaches author's tablet | covered |
| world | `_loseConnection` | Model-only loss of connection | model-only |
| invariant | `invDraftRemainsPrivate` | Known-name refusal, Bob's playtest refusal and no public discovery | covered |
| invariant | `invCreatedDraftIsKept`, `invOfflineDraftIsKept` | Incomplete save and offline reopening | covered |
| invariant | `invPlaytestKeepsAValidDraft`, `invCompletedPlaytestExists` | Valid private playtest and its completion | covered |
| invariant | `invPlaytestsNeverCountAsOrdinaryPlay` | Completed playtest has no ordinary completion | covered |
| invariant | `invConnectedDraftsAgree` | Offline draft reaches tablet on reconnection | covered |

C4: creation changes absent to present; a second creation represents another
aggregate, not a refused creation. Saving accepts complete/incomplete details
and metadata; foreign saving retains the author's work with the ownership
refusal. Reading leaves work intact, with Bob's privacy refusal. Validation
reports ready/correction without changing the draft. Author playtesting
changes absent or earlier practice to current practice; Bob is refused.
Completing practice keeps ordinary progress empty. These transitions are the
existing examples above. Incomplete playtest controls and completion without
a playtest are not offered: validation explains the missing details first,
and completing requires an existing playtest. Device loss is model-only;
reopening and reconnection retain accepted work.

## Private pack authoring

| Kind | Model name | Existing example | Status |
| --- | --- | --- | --- |
| command | `createPackDraft` | `author-packs.feature`, title and description | covered |
| command | `addPackPuzzle` | Append, another-game refusal and duplicate refusal in `author-packs.feature` | covered |
| command | `removePackPuzzle` | Removing Valley retains River/Harbor order | covered |
| command | `reorderPackPuzzle` | Moving Harbor before River retains Valley | covered |
| command | `createPackPuzzle` | New private Valley appears in the working pack | covered |
| command | `reopenApp` | Offline changed order survives reopening | covered |
| world | `connectionReturns` | Offline pack order reaches the tablet | covered |
| world | `_loseConnection` | Model-only loss of connection | model-only |
| invariant | `invPackContentsAreDistinct` | Duplicate addition refusal | covered |
| invariant | `invPackContentsBelongToItsGame` | Other-game addition refusal | covered |
| invariant | `invNewPuzzleBelongsToItsAuthor` | Create from pack opens the new private draft | covered |
| invariant | `invPackRemainsPrivate` | New private pack and unpublished-pack discovery refusal | covered |
| invariant | `invCreatedPackKeepsItsMetadata` | New pack title/description retained | covered |
| invariant | `invConnectedDraftsAgree`, `invOfflinePackIsKept` | Offline reopening and reconnection | covered |

C4: creation changes absent to present with an empty order; addition appends a
same-game puzzle or keeps the order with duplicate/other-game reasons;
removal keeps remaining order; moving an included puzzle changes only its
position; creating a private puzzle appends it. Removal and reordering
controls name included puzzles, so missing or identical choices are not
commands. The finite single pack and new puzzle represent chosen aggregates,
not product quotas. Reopening/reconnection keep the saved order.

## Concurrent choices in existing aggregates

| Kind | Model name | Existing example | Status |
| --- | --- | --- | --- |
| command | `saveEarlierPuzzleDraft` | `author-drafts.feature`, phone Valley and stale-tablet Harbor both retained | covered |
| invariant | `invDraftCopiesNeverChange` | Both copies remain after choosing Harbor | covered |
| command | `saveEarlierPackDraft` | `author-packs.feature`, separate phone/tablet whole orders | covered |
| invariant | `invPackDraftCopiesNeverChange` | Both complete orders retained without mixing | covered |
| command | `continueEarlierAttempt` | `offline-work.feature`, different continuations of the same attempt | covered |
| invariant | `invDifferentContinuationsAreKept` | Either saved continuation remains available | covered |

C4: these actions require an earlier saved choice and a genuinely different
edit/continuation; they append a recoverable choice without replacing the
chosen phone work. They model connected stale editors, as in the existing
examples, rather than inventing a winner for simultaneous disconnected work.
The ordinary choosing/resuming commands remain covered in the lifecycle audit.

C3: no published events added. C5: no new upstream reaction or borrowed term.
C6: creation, private inspection, validation, playtest beginning/completion,
pack creation/add/remove/reorder/create-from-pack, stale draft saves and stale
attempt continuation are now named commands, rather than aliases of save.
The other commands retain the lifecycle/recovery coverage maps.

## Execution and handoff

All five touched models typecheck with pinned Quint 0.32.0. Each independently
simulated 50 seeded histories of up to 40 steps with every invariant enabled,
seed 424242, TypeScript evaluator, without a violation. The stale-edit guards require different content, and both publication models
were simulated again after that final narrowing. This is model evidence, not
a bounded proof or product replay.

The ordinary gate reports only the two missing model bindings. The strict
run adds the same thirteen external duplicate wording findings recorded in
the earlier audits. No new feature phrases or code-test cases are required.
Commit the models separately as `spec:` before implementation. The implementer
must bind both new models and the three explicit stale-editor commands,
observe real public state, preserve literal regression histories, and run
product replay and bounded verification without editing this contract.
