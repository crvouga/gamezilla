# Numberlink specification audit

Date: 2026-10-23.
Scope: `specs/numberlink/` and its rule-harness bindings.
Verdict: INCOMPLETE. The strict whole-repository gate reports existing
near-duplicate steps in other domains. The Numberlink context is still
unmodelled (warning). All 19 new rule scenarios now pass after their initial
undefined-step run. No assembled-app verification or release claim is made here.

## Example map

Context: Numberlink. Story: a person wants consistent path rules and completion
that follows the chosen coverage. Vocabulary comes from the implementation
request: Numberlink, puzzle, board, cell, endpoint, pair, path, coverage,
completion, clearing, solution; joining and ending have their ordinary path
meanings, distinct from entering or closing a space.

| Rule | Permitted example | Refused or contrasting example |
| --- | --- | --- |
| Start at an endpoint; continue orthogonally | A1 B1 C1, and its reverse | B1 C1, A1 C1, A1 B2 |
| Paths occupy distinct cells | A1 B1 remains a partial path | Revisiting A1, entering another endpoint, crossing B2 |
| Stop at the matching endpoint | A1 B1 C1 | A1 B1 C1 C2 |
| Full coverage completes every pair and cell | Both rows connected | A third row left uncovered; a partial second path |
| Endpoint-only coverage is explicit | Both pairs connected with a row uncovered | A partial second path |
| Replace or remove one path independently | Shorten or remove the first path; keep the second | Invalid replacements are covered by drawing refusals |
| Clearing retains the definition | Paths disappear; endpoints and coverage remain | Clearing an empty drawing has the same outcome |

## Language and scenario review

- A0–A6: business-readable path rules; Alice is the only actor. Numberlink
  vocabulary is defined locally. Quoted values name examples, pairs and cells.
- B1–B10: capability titles and job stories; scenarios are under rules, have
  one action, and state outcomes. Refusals give a reason and retain the drawing.
- B11: backgrounds apply to every scenario beneath them. Crossing uses its own
  board and therefore does not share the two-row background.
- B12–B15: no outlines, unknown tags, technical tables or alternative wording
  for existing Numberlink steps. There were no earlier Numberlink steps.
- B16: the redraw example has seven steps including its background; the extra
  assertions establish that the other path remains and completion changes.
- B17/D1: malformed encodings, dimension and endpoint validation tables,
  exhaustive solver agreement and serialization remain property/code tests.
- P3: both features ran through the repository runner before bindings existed:
  19 failed, zero passed, each on an undefined step; no compile/setup failure.
- D2–D5: bindings call exported deterministic harness actions and reads. Setup
  facts have separate wording from assertions. Steps contain no SQL, transport,
  selectors or rule computations. The world records actions through one
  `defineSystem` with virtual time.

Current rule evidence: the context has 19 passing scenarios and no failures;
its harness and rule packages pass typechecking and lint. The changed core
framework packages' existing tests pass as part of 15 successful Turbo tasks.

## Coverage still required

The Numberlink rules context has no aggregate model yet (unmodelled warning).
The shared publication, pack, attempt and progression state machines and their
implementation bindings remain required by the request. These rule features
do not claim app navigation, persistence, publication, editing tools or
cross-device behavior. Those need their own shared contracts and assembled-app
verification before the goal can be complete.

After binding, rerun the context, catalogs, strict audit and full verification.
Update this report with current evidence; an initial red run is not a pass.
