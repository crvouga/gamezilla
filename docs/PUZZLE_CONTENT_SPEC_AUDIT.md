# Shared puzzle specification audit

Date: 2026-10-23. Context: Puzzles (`specs/puzzles/`).
Verdict: INCOMPLETE. New steps are undefined for the implementation handoff;
critical aggregate models and their coverage maps remain required. The strict
gate additionally reports existing near-duplicate wording in other contexts.
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

| Aggregate | Commands and transitions to model | Required invariants |
| --- | --- | --- |
| Puzzle publication | Create, edit, validate, publish, repeat publication, withdraw, reconnect | Valid editions; immutable earlier content; owner-only publication; no extra edition from a repeated publication |
| Pack publication | Edit ordered contents, publish, revise, withdraw | Distinct same-game contents; stable puzzle edition references; no private content in public packs |
| Attempt | Start, accept play, resume, undo, redo, restart, finish, reconnect | Valid saved game state; stable edition; personal access; completions from real accepted attempts; recoverable divergent play |
| Progression | Start a pack puzzle, continue, complete, select next, reconnect | Count each chosen edition once; completion survives restart/withdrawal; last active unfinished puzzle remains resumable |

Each model needs its own C1–C6 coverage map and implementation replay before
this audit can pass. Shared behavior will be tested through a single reusable
harness composition, with the real Numberlink app workflows covered as well.
