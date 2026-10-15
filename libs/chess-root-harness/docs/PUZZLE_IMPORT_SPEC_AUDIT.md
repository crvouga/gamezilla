# Spec audit — chess puzzle loading — 2026-10-14

Verdict: INCOMPLETE — final full-context verification is running.

## Scope

- `specs/chess/puzzle-ingest.feature`
- `specs/chess/puzzle-load-controls.feature`
- `specs/chess/puzzle-load-progress.feature`
- `specs/chess/puzzle-load-updates.feature`
- `specs/chess/puzzle-loading.qnt`
- The `add puzzles` and `broken puzzle` glossary entries, their bindings,
  and the puzzle-management access decision table.

## Per feature

No blocking prose, vocabulary, scenario-shape, or coverage findings.

| Feature | Non-blocking findings |
| --- | --- |
| `puzzle-ingest.feature` | B11: repeated team preconditions under the one-at-a-time, environment, and outcome rules. |
| `puzzle-load-controls.feature` | B11: repeated team preconditions under the availability and connection rules. B16: the offline-stop example has six steps. |
| `puzzle-load-progress.feature` | B11: repeated team preconditions under both rules. |
| `puzzle-load-updates.feature` | B11: repeated team and finished-addition preconditions. B16: the broken-update example has six steps. |

The explicit preconditions keep the examples independently readable. All
examples remain below the eight-step blocking limit.

## Named checks

| Check | Result and evidence |
| --- | --- |
| A0 | PASS: business choices and visible outcomes; CSV framing, compression, storage, and worker delivery stay in code tests. |
| A1 | PASS: nouns resolve through the chess glossary, its published borrows, and the kernel. |
| A2 | PASS: the chess glossary's avoided technical synonyms are absent from the feature prose. |
| A3 | PASS: existing `add puzzles` forms were expanded for the person's explicit start, stop, status, and upsert request; no new product term was coined. The first spec commit records that confirmation. |
| A4 | PASS: no new context borrow or Quint import. |
| A5 | PASS: no implementation vocabulary outside the existing business terms for connection and environment. |
| A6 | PASS: Alice and this environment are the step subjects. |
| B1 | PASS: capability titles. |
| B2 | PASS: every feature states When, want, and so. |
| B3 | PASS: every scenario belongs to a rule. |
| B4 | PASS: rules pair success with refusal, or explicitly explain why no counter-example exists. Failure illustrates the negative outcome of following an addition. |
| B5 | PASS: one When per example. |
| B6 | PASS: Given steps describe states. |
| B7 | PASS: each When is one command or world event. |
| B8 | PASS: displayed status, counters, controls, and playable puzzles; refusals name team access, an ongoing addition, or a missing connection. |
| B9 | PASS: no gestures or quoted application copy. |
| B10 | PASS: outcome titles, unique within chess. |
| B11 | WARN: explicit repeated preconditions listed above; no oversized or unused Background. |
| B12 | PASS: the four-row outline varies the business stage at which stopping is unavailable. |
| B13 | PASS: cast names and concrete puzzle counts. |
| B14 | PASS: one team precondition, stop command, and shared team-only explanation; strict duplicate gate required below. |
| B15 | PASS: chess domain tags and registered regression tags only. |
| B16 | WARN: two six-step examples; none exceeds eight. |
| B17 | PASS: all feature outcomes are observable; file-format and transaction properties remain package tests. |
| C1 | PASS: all commands and observable world events mapped below. |
| C2 | PASS: invariants mapped below; fixture accounting is model-only. |
| C3 | PASS: loading introduces no published cross-context domain event. Its work messages are an implementation mechanism. |
| C4 | PASS: legal and unavailable command stages mapped below. |
| C5 | PASS: the existing team-access decision is exercised by start and stop refusals and permission tests. No new upstream relationship. |
| C6 | PASS: every new When resolves to the `add puzzles` glossary entry's model actions or the existing connection actions. |
| D1 | PASS: product prose contains no repository path, package, or implementation identifier. |
| D2 | PASS: steps and model bindings call exported harness actions and reads; observed model values come from the displayed UI. |
| D3 | PASS: no imitation of expected product transitions in glue. Memo holds only setup values such as the earlier pool size and solver's space link. |
| D4 | PASS: the existing steps and Quint indexes discover the files. |
| D5 | PASS: injected clock and ports, virtual-time waits, no skipped or retried tests. |
| D6 | PASS: action and observation keys match the Quint model. |
| P1 | PASS: spec changes are isolated in spec commits; ownership gate required below. |
| P2 | PASS: wording and model repairs were made as spec-author handoffs, separately from implementation. |
| P3 | PASS: new definitions first failed as undefined steps; reused definitions were exercised unchanged. Real UI failures exposed the subscription and mutation-registration defects before their fixes. |
| P4 | N/A: no scenario was demoted or removed without preserving its claim. The ready-start example moved to the connection rule. |

## Coverage — puzzle loading aggregate

Addresses are relative to `specs/chess/`.

| Kind | Model name or transition | Illustration | Status |
| --- | --- | --- | --- |
| command | `addPuzzles` | `puzzle-ingest.feature:9`; `puzzle-load-updates.feature:9` | covered |
| world event | `addSomePuzzles` | `puzzle-load-progress.feature:9` | covered |
| world event | `finishAddingPuzzles` | `puzzle-ingest.feature:57` | covered |
| world event | `failAddingPuzzles` | `puzzle-ingest.feature:64`; `puzzle-load-progress.feature:16` | covered |
| command | `stopAddingPuzzles` | `puzzle-load-controls.feature:8` | covered |
| command | `followAddingPuzzles` | `puzzle-load-controls.feature:24`; `puzzle-load-progress.feature:39` | covered |
| world event | `loseConnection` | No separate visible outcome; it changes the precondition for start, stop, and observation. | model-only |
| world event | `comeBackOnline` | `puzzle-ingest.feature:71`; `puzzle-load-progress.feature:26,33` | covered |
| invariant | `invPuzzleLoadingStatus` | The unavailable-stage outline and the start, finish, failure, and stop examples show every recognized stage. | covered |
| invariant | `invPuzzlePoolPreserved` | `puzzle-load-controls.feature:8`; `puzzle-load-progress.feature:16`; `puzzle-load-updates.feature:15` | covered |
| invariant | `invConnectedPuzzleLoadingIsCurrent` | `puzzle-load-progress.feature:26,33`; `puzzle-ingest.feature:71` | covered |
| invariant | `invStoppedPuzzlesStayPut` | `puzzle-load-controls.feature:8`; queued/stale-worker regression in `puzzle-load-job.test.ts` | covered |
| invariant | `invPuzzleCounts` | The model's `Bookkeeping` comment: bounds describe the chosen fixture. | model-only |
| transition | start from ready | `puzzle-load-controls.feature:54` | covered |
| transition | start from finished | `puzzle-ingest.feature:29` | covered |
| transition | start from failed | `puzzle-ingest.feature:35` | covered |
| transition | start from stopped | `puzzle-load-controls.feature:46` | covered |
| illegal | start while adding | `puzzle-ingest.feature:22` | covered |
| illegal | start offline | `puzzle-load-controls.feature:60` | covered |
| transition | stop while adding | `puzzle-load-controls.feature:8` | covered |
| unavailable | stop from ready, finished, failed, stopped | `puzzle-load-controls.feature:30` (four example rows) | covered |
| illegal | stop offline | `puzzle-load-controls.feature:67` | covered |
| transition | follow every connected stage | `puzzle-load-controls.feature:24,30` | covered |
| transition | follow while offline | `puzzle-load-progress.feature:39` | covered |
| policy | start or stop without team access | `puzzle-ingest.feature:14`; `puzzle-load-controls.feature:15` | covered |

No missing rows.

## Binding and mechanism evidence

The old status-row setters, fabricated puzzle insertion, memo-only refusal,
and memo-only second environment were removed. The replacement uses the
real upload route, central permission guard, mutation replay, object store,
worker consumers, sync notifications, and UI controls. A second harness owns
an independent environment. Retention assertions open the real solver view.
The Quint observer reads status and counts from rendered components.

Package tests cover CSV and Zstandard streaming, bounded parts, quoted and
split UTF-8 records, cancellation, valid complete chess lines, duplicate
positions and IDs, updates, tombstones, malformed/missing source, concurrent
starts, stopping queued/stale work, cleanup, and private management fanout.
The navigation regression traverses Chess → Settings → Developer, chooses
an actual two-part file through the driver, and checks the running controls.

## Verification

- Focused loading features and PR-profile model checks: 35 passed.
- All eight generated model traces and model checks: 12 passed.
- Puzzle-loading model proof: passed.
- Changed-package verification: 33 tasks passed; private status fanout and
  shared permission packages: 11 tasks passed.
- Strict spec gate, ownership, and full repository verification: final
  verdicts recorded after the final run.

## Triage

No blocking spec change remains. The repeated preconditions and two six-step
examples are readability warnings. Unrelated multiplayer timeouts in the
broader suite are reported as verification blockers, never counted as a pass.
