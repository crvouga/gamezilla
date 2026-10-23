# Shared puzzle specification audit

Date: 2026-10-23. Context: Puzzles (`specs/puzzles/`).
Verdict: INCOMPLETE. The original 66 lifecycle scenarios have executable
bindings; two kept-copy examples await binding. Critical aggregate models
and their coverage maps remain required. The strict gate
additionally reports existing near-duplicate wording in other contexts.
This is not a release or completion claim.

## Example map

The request supplies the vocabulary: puzzle, draft, author, validation,
playtest, publication, edition (the stable published revision), pack,
attempt, completion and progression. The context borrows the existing game
and control terms. No new product boundary value is invented here.

| Capability | Allowed example | Boundary example |
| --- | --- | --- |
| Author drafts | Save incomplete work and metadata | Another person cannot read or rename it |
| Concurrent drafts | Choose either saved copy | A stale edit cannot silently replace newer work |
| Publish puzzles | Publish a valid titled draft | Missing details, title, or ownership refuse publication |
| Stable editions | Publish a new working draft | Editing or repeating an earlier publication cannot replace a later edition |
| Author packs | Append, reorder, remove or create puzzles | Another game or a duplicate cannot enter the pack |
| Publish packs | Publish ordered stable editions | Private, withdrawn or absent puzzles refuse publication |
| Retain pack content | An earlier published pack still plays its selected edition | Later puzzle edits and withdrawal cannot replace it |
| Playtests | Use actual game rules privately | Playtests do not count toward ordinary completion |
| Personal attempts | Start, resume, undo, redo and restart | Private content and another person's attempt remain inaccessible |
| Pack progression | Continue the last unfinished puzzle and finish the pack | Repeated completion never counts one edition twice |
| Offline work | Reopen and continue drafts, packs and available puzzles | A puzzle never available on the device explains how to get it |
| Reconnection | Keep drafts and completion on another device | Different accepted continuations both remain recoverable |

## Review

- A0–A6: business terms, actors Alice and Bob, ordinary devices and connection
  states; no storage, wire, queue, protocol or framework assertions. Generic
  validation refers to the puzzle details the person edits.
- B1–B10: capability features with job stories, scenarios under rules, one
  action each, observable outcomes and reasons on refusals. Quoted titles,
  descriptions, difficulty and ordered titles are person-supplied data.
- B11–B16: no unused backgrounds or outlines. Steps are brief; rules whose
  outcome always holds explain why there is no refusal counter-example.
  New phrasings concern the author-created lifecycle, distinct from the
  existing rated feed's actions.
- B17/D1: duplicate operation identities, compare-and-swap behavior, SQL
  transactions, solver search budgets and serialization belong to code and
  property tests rather than product prose.
- P1: contracts are committed separately from implementation. P3 evidence is
  recorded through the repository runner before step bodies are added.

## Aggregate coverage still required

The terminology audit keeps generic completion, attempt and edition words
local to Puzzles: they do not redefine unrelated contexts' ordinary uses.
Repeated setup and observation phrases reuse the existing catalog wording.
The repeated-completion example states that a new attempt has already started
before its single completion action. Numberlink's `drawn` form belongs to a
path, rather than to Chess's tied result.

| Aggregate | Commands and transitions to model | Required invariants |
| --- | --- | --- |
| Puzzle publication | Create, edit, validate, publish, repeat publication, withdraw, reconnect | Valid editions; immutable earlier content; owner-only publication; no extra edition from a repeated publication |
| Pack publication | Edit ordered contents, publish, revise, withdraw | Distinct same-game contents; stable puzzle edition references; no private content in public packs |
| Attempt | Start, accept play, resume, undo, redo, restart, finish, reconnect | Valid saved game state; stable edition; personal access; completions from real accepted attempts; recoverable divergent play |
| Progression | Start a pack puzzle, continue, complete, select next, reconnect | Count each chosen edition once; completion survives restart/withdrawal; last active unfinished puzzle remains resumable |

Each model needs its own C1–C6 coverage map and implementation replay before
this audit can pass. Shared behavior will be tested through a single reusable
harness composition, with the real Numberlink app workflows covered as well.

## Access decision table

`puzzle-content-access.dmn` makes the existing private-work rules explicit
for the six capabilities recorded in `conformance.yaml`. Its finite space is
three kinds of person, six choices and whether the target is their work:
36 cases. Creation and reading one's own collection allow either target
answer because neither acts on someone else's chosen draft. Editing,
playtesting, publication and continuing an attempt allow only one's own work.
The three rules partition that space without overlap. Each denial names the
reason: the work belongs to someone else. No new product term is introduced;
the existing published kinds of person are borrowed from Profile and Billing.

All 36 cases agree through policy resolution, real server replay and private
queries, and mounted client decisions. A server refusal must preserve every
stored row; the private query checks every returned owner. The 66 lifecycle
scenarios and seven decision-table checks pass together, and the standard
spec gate passes. The strict gate still reports the existing wording
duplicates outside Puzzles. Critical aggregate models remain open, so the
context's verdict remains INCOMPLETE.

## Choosing kept work

The authoring feature adds a successful choice of a kept copy and a refusal
when someone else chooses it. Existing title and kept-copy observations are
reused. One new setup fact describes two kept copies; the two new commands
name who chooses one. The author can continue the chosen content while both
sources remain available. Identity reuse, an intervening newer draft and a
repeated old choice are transaction/model checks, rather than new product
prose. The new command still needs the publication aggregate's lifecycle
model and coverage map. This does not close the context audit.

## Wording correction audit

- A4: completion, attempt and edition remain local, avoiding false ownership
  of generic prose in other contexts. Numberlink declares the existing path
  word's `drawn` inflection. No term or behavior has been added.
- B7: repeating a completed puzzle now states the restarted attempt in a
  Given; the When only completes it.
- B14: shared pack setup, puzzle discovery, draft-order observations and
  owner refusals reuse existing phrases. No outcome was removed.
- D4 handoff: delete the superseded step definitions and bind the new
  restarted-attempt Given. Re-run the 66 scenarios after rebinding.
- C6: all eight capability features remain unmodelled pending the four
  critical aggregate models above. This is still an incomplete audit.
