# Draft editing specification audit

Date: 2026-10-24. Verdict: INCOMPLETE. The strict gate retains thirteen
B14 wording pairs outside Puzzles. The new scenarios and model are an
implementation handoff: their missing bindings are expected at this stage.
There are no other scoped blocking findings; one B16 warning is retained.

## Scope and example mapping

Context: Puzzles. Aggregate: `specs/puzzles/draft-editing.qnt`, the current
editing choices of one private puzzle or pack. Existing authoring and
publication models continue to own creation, ownership, publication and
concurrent saved copies. This model adds the editing choices they lacked.

The job story is in `edit-draft-history.feature:3`. Commands are saving an
edit, undo, redo and reopening the app. Losing a connection is model-only;
returning online has the observable consequence of the author's other
device keeping the restored draft. Existing terms supply the vocabulary.
The request explicitly includes shared builder Undo/redo in section 5;
the existing undo/redo definitions now include draft edits. No term is added.

| Rule | Positive example | Boundary or negative example |
| --- | --- | --- |
| Undo restores an earlier edit without deleting copies | Title, puzzle-detail and pack-order undo | An unchanged draft has no earlier edit |
| Redo restores an undone choice until another edit replaces it | Title, puzzle-detail and pack-order redo | A different title removes redo; the unchanged draft offers none |
| Offline editing keeps undo and redo | Offline undo, offline redo and the restored title reaching the tablet | No connection-based refusal; earlier/undone edit requirements still apply |
| Reopening keeps work and starts fresh editing choices | Edited and undone titles remain kept | Earlier-only, undone-only and both available choices end on reopening |

## Per-feature verification

`specs/puzzles/edit-draft-history.feature`: zero scoped blocking findings,
one warning. All sixteen scenarios describe one person's observable draft
work; quoted names and orders are supplied content.

| Verification | Evidence and outcome |
| --- | --- |
| A0, A5 | Every feature line and model header concerns Alice's private work, undo, redo, kept copies and her connection. No implementation or UI-mechanic vocabulary. |
| A1, A2 | Puzzle, pack, draft, title, save, undo and redo resolve in `specs/puzzles/ubiquitous-language.yml`; app, phone, tablet and connection resolve in the kernel. No avoided synonym is introduced. |
| A3, A4 | No added term or foreign import. Existing undo/redo terms are extended to the authoring behavior expressly requested. |
| A6 | Alice is the acting person; a pack draft is the subject of order assertions. |
| B1, B2 | Capability title and one When/wants/so job story. |
| B3, B4 | Every scenario belongs to one of four rules. The first two have positive and refusal examples; the last two have explicit No counter-example explanations. |
| B5–B9 | Each scenario has one When. Givens state prior work; Thens describe available choices and kept content. Quotations name content, not app copy. |
| B10–B13 | Outcome titles, one shared owning-draft Background under the reopening rule, no outline, and plausible puzzle names. |
| B14 | Existing ownership, saving, rename, pack-order, reopening and reconnection phrases are reused from the generated Puzzles catalog. New phrases describe the previously absent draft-editing choices or facts needed to establish them. Step-body comparison remains an implementation check. |
| B15 | Only `@domain:puzzles` is used. |
| B16 | The first scenario has six steps: one undo must preserve its visible result, both saved copies and the remaining editing choices. Every other scenario has at most five steps including its Background. The eight-step cap is respected. |
| B17, D1 | No storage, transport, algorithm, formula, package or code identifier appears in feature prose. History arithmetic, snapshot isolation and no-op equality belong to code properties. |

## Aggregate coverage

| Kind | Model name | Term | Illustrated by | Status |
| --- | --- | --- | --- | --- |
| command | `saveAuthoringDraft` | save | `author-drafts.feature:22`, saved metadata; `author-drafts.feature:28`, incomplete work; `edit-draft-history.feature:67`, a different title retained | covered |
| command | `undoDraftEdit` | undo | `edit-draft-history.feature:7`, title undo and retained copies; detail/order and offline examples | covered |
| command | `redoDraftEdit` | redo | `edit-draft-history.feature:41`, restored title; detail/order, partial-redo and offline examples | covered |
| command | `reopenApp` | the app | `edit-draft-history.feature:103`, edited title kept with fresh choices; undone and partial-choice examples | covered |
| world | `connectionReturns` | connection | `edit-draft-history.feature:91`, offline undo reaches the tablet | covered |
| world | `_loseConnection` | connection | The model's `/// Model-only` explanation; offline Givens establish its effect | model-only |
| invariant | `invCurrentDraftHasKeptCopy` | draft | `edit-draft-history.feature:7`, undo preserves both copies, plus restored and reopened work | covered |
| invariant | `invUndoHasEarlierEdit` | undo | Unchanged draft, last-undo and partial-undo choice assertions | covered |
| invariant | `invRedoHasUndoneEdit` | redo | Unchanged draft, replaced redo, last-redo and partial-redo assertions | covered |
| invariant | `invConnectedDraftsAgree` | connection | `edit-draft-history.feature:91`, restored phone work reaches the tablet | covered |

C3: no domain event is added. C5: no upstream policy reaction is added;
existing author-only draft access remains in the earlier authoring contract.
C6: each new When uses existing undo/redo, save, draft, app or connection
language and names a modeled command or world event. There is no uncovered
new command.

C4: saving different work adds an earlier choice and clears redo; unchanged
work adds neither. Undo requires an earlier choice and may leave another;
redo requires an undone choice and may leave another. The first and partial
undo/redo examples cover those boundaries. Fresh and replaced choices are
not offered. Reopening clears earlier-only, undone-only and combined choices
without changing the saved draft. Offline commands keep the same rules;
reconnection shares the restored work. Puzzle details and pack order are
content, rather than separate editing lifecycle statuses.

## Gate and model evidence

Pinned Quint 0.32.0 typechecks the model. The TypeScript evaluator completed
50 seeded histories of up to 24 steps with all four invariants enabled,
seed 424242, without a violation. This is simulation evidence; bounded
verification and implementation replay remain required.

The ordinary spec gate reported the new undefined steps and missing
`draft-editing` binding. The strict gate also reports the existing thirteen
external B14 pairs. Neither result is a passing conformance claim.
No conflict markers occur under `specs/`.

D2–D6 remain the implementer's checks for new step and model bindings.
They must use exported harness actions and reads, with real authoring
controls, mutations and kept-copy observations. No expected state may be
manufactured from the model. Preserve the contract during implementation.

P1: this handoff contains only specifications and this audit document, in a
`spec:` commit. P2 ownership verification and final generated catalogs must
be refreshed after binding.
