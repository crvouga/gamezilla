# Spec audit — puzzle loader choices — 2026-10-15

Verdict: PASS for the contract audit, with the warnings below. This is not
the full repository verification verdict.

Scope: `lichess-file-checking.feature`, `lichess-file-saving.feature`,
`puzzle-loading-return.feature`, the expanded `puzzle-load-controls.feature`,
`lichess-file-preparation.qnt`, `puzzle-loading-choices.qnt`, the puzzle
management decision table, and their step definitions and bindings.
The existing source, loading, progress and update contracts remain part of
the aggregate coverage. Navigation confirmation is covered separately by
`lichess-file-leaving.feature` and its model.

## Per feature

| Feature | Checks and evidence | Findings |
| --- | --- | --- |
| `specs/chess/lichess-file-checking.feature` | A0–A6: team, environment, connection and Lichess-file vocabulary; no new terms. B1–B10, B12–B15, B17, D1: a job story, three rules with successful and refused outcomes, one event per example, observable choices and explanations. | B11 warn: repeated team facts make the examples independent. B16 warn at lines 16 and 26: eight steps retain the known/unknown distinction and all unavailable choices. |
| `specs/chess/lichess-file-saving.feature` | A0–A6: the person chooses, saves, stops or tries again. B1–B10, B12–B15, B17, D1: five rules with positive and refused outcomes; file contents are person-supplied input, not asserted application copy. The repeated-save example is a later attempt after failure, not an automatic retry count. | B11 warn: repeated team facts. B16 warn at line 24: eight steps specify the progress indication and the four mutually unavailable actions. Other six/seven-step cases retain cross-environment or confirmation preconditions. |
| `specs/chess/puzzle-loading-return.feature` | A0–A6, B1–B10, B12–B15, B17, D1: three rules about returning, retained puzzles and the same file. The three-row outline varies business outcomes. The two unconditional preservation rules explain why no counter-example exists. | B11 warn: repeated team facts. B16 warn at line 9: six steps retain the earlier progress and absence preconditions. |
| `specs/chess/puzzle-load-controls.feature` | A0–A6, B1–B10, B12–B15, B17, D1: confirmation, cancellation, pending decisions, failures, connectivity and terminal results are observable. The unconditional restart rule declares its lack of a counter-example. | B11 warn: repeated team facts. B16 warn for six/seven-step confirmation and connection cases, where the preceding addition and retained-pool facts are necessary. |

A3: no new glossary term was added by this expansion. Existing Lichess-file,
adding-puzzles and stopping vocabulary now names the additional model actions.
A4: the models introduce no foreign model imports. A1/A2 were checked against
the Chess glossary, its declared borrows and the kernel. A5/A6 exclude neither
technical concepts nor invented actors through a glossary exception: Alice and
the team perform the commands, and file checks/additions finish or fail as
observable events. B14 is also checked by the strict duplicate gate.

## Coverage — preparing the Lichess file

Line references below are relative to `specs/chess/`. Every listed row is
covered unless marked model-only. Guards are in
`lichess-file-preparation.qnt:33–124`.

| Kind | Action or invariant | Evidence |
| --- | --- | --- |
| C1 command | `checkLichessFile` | `lichess-file-checking.feature:46`, `:54`, `:62`, `:70`, `:78` |
| C1 world event | `finishCheckingLichessFile` | `lichess-file-checking.feature:8` |
| C1 world event | `failCheckingLichessFile` | `lichess-file-checking.feature:35`, `:62`, `:78` |
| C1 command | `chooseLichessFile` | `lichess-file-saving.feature:8` |
| C1 command | `saveLichessFile` | `lichess-file-saving.feature:24`, `:82`, `:122` |
| C1 world event | `finishSavingLichessFile` | `lichess-file-saving.feature:41`, `:56` |
| C1 world event | `failSavingLichessFile` | `lichess-file-saving.feature:74` |
| C1 command | `askToStopSavingLichessFile` | `lichess-file-saving.feature:91` |
| C1 command | `cancelStoppingLichessFile` | `lichess-file-saving.feature:98` |
| C1 command | `confirmStoppingLichessFile` | `lichess-file-saving.feature:105` |
| C1 world event | `anotherEnvironmentSavesLichessFile` | Model-only at `lichess-file-preparation.qnt:94`: it has no local effect until checking or saving discovers the file. Discovery is illustrated at `lichess-file-checking.feature:70` and `lichess-file-saving.feature:48`, `:56`. |
| C1 command | `addPuzzles` | `saved-puzzles.feature`, `puzzle-load-controls.feature:54` |
| C1 command | `returnToLichessFile` | `puzzle-loading-return.feature:34`, `:41`, `:51` |
| C1 world events | `loseConnection`, `comeBackOnline` | `lichess-file-saving.feature:130`, `lichess-file-checking.feature:89`, `:97`, `:105` |
| C2 invariant | `invLichessFileChoices` | `lichess-file-checking.feature:16`, `:26`, `:35`, `:78`, `:89`; `lichess-file-saving.feature:91`, `:98` |
| C2 invariant | `invOnlyCompleteLichessFilesAreAvailable` | `lichess-file-saving.feature:34`, `:41`, `:74`, `:105`, `:130`; `puzzle-loading-return.feature:34` |
| C2 invariant | `invOfflineFileAvailabilityPreserved` | `lichess-file-checking.feature:97`; the interrupted-check regression and offline-save example |
| C4 legal | Checking → known saved / known missing / failed; failed → checking again | `lichess-file-checking.feature:8`, `:35`, `:46`, `:54`, `:62` |
| C4 legal | Known missing → chosen; chosen / failed / stopped → saving | `lichess-file-saving.feature:8`, `:24`, `:82`, `:105`; `lichess-file-saving.feature:113` covers a subsequent attempt after stopping |
| C4 legal | Saving → saved / failed / stopped; asking → cancelling / confirming | `lichess-file-saving.feature:41`, `:74`, `:91`, `:98`, `:105` |
| C4 legal | Returning → fresh check; offline → checking on return online | `puzzle-loading-return.feature:34`, `:41`, `:51`; `lichess-file-checking.feature:105` |
| C4 refused | Unknown / checking / failed checks do not offer a first upload | `lichess-file-checking.feature:16`, `:26`, `:35`, `:89` |
| C4 refused | Checking and saving disable conflicting choose / save / add / check actions | `lichess-file-checking.feature:16`, `:26`; `lichess-file-saving.feature:24` |
| C4 refused | No chosen file, missing complete file, offline, or outside team | `lichess-file-saving.feature:15`, `:34`, `:130`, `:137`; `lichess-file-checking.feature:113`; existing saved-source and offline-start refusals |
| C4 refused | Existing complete file prevents replacement by an earlier choice or later save | `lichess-file-saving.feature:48`, `:56`; `lichess-file-checking.feature:70` |

Actions hidden by their state have no independently exercisable command:
choosing during a check/save, saving a complete shared file, or confirming
without an open confirmation. Their absence is the refusal surface. World
completion/failure events are not person-invoked commands in excluded states.

## Coverage — stopping an addition

The existing `puzzle-loading.qnt` continues to own starting, accepting batches,
terminal outcomes, later additions, counts and pool preservation. The choices
model focuses on a running addition in each of idle, confirmation, pending-stop
and failed-stop stages. Its guards are in `puzzle-loading-choices.qnt:28–94`.

| Kind | Action or invariant | Evidence in `puzzle-load-controls.feature` |
| --- | --- | --- |
| C1 command | `askToStopAddingPuzzles` | `:77` |
| C1 command | `cancelStoppingPuzzles` | `:84` |
| C1 command | `confirmStoppingPuzzles` | `:91`, `:112`, `:120`, `:127` |
| C1 world event | `finishStoppingPuzzles` | `:105`, `:142` |
| C1 world event | `failStoppingPuzzles` | `:112`, `:150` |
| C1 world events | `finishAddingPuzzles`, `failAddingPuzzles` | `:120`, `:127`; return examples `puzzle-loading-return.feature:17`, `:25` |
| C1 command | `followAddingPuzzles` | `:24`, `:30`, `:105`; returning examples |
| C1 world events | `loseConnection`, `comeBackOnline` | `:134`, `:142`, `:150`; existing `puzzle-load-progress.feature` offline/online examples |
| C2 invariant | `invRecognizedPuzzleLoadingChoices` | `:77`, `:84`, `:98`, `:105`, `:112`; model shape/type/invariant proofs check all stage values |
| C2 invariant | `invConnectedStopChoiceKeepsCurrentResult` | `:91`, `:105`, `:112`, `:120`, `:127` |
| C2 invariant | `invOfflineStopChoiceKeepsLastResult` | `:142`, `:150` |
| C4 legal | Idle → confirming → idle / stopping; failed → idle / stopping | `:77`, `:84`, `:91`, `:112`; `:158` covers cancelling failed stops |
| C4 legal | Stopping → succeeded / failed; succeeded → dismissed | `:105`, `:112`; `:165` follows and dismisses completed stops |
| C4 legal | Finish/fail before confirmation preserves finished/failed outcome | `:120`, `:127` |
| C4 legal | Finish/fail while offline becomes visible on returning online | `:142`, `:150`; drawn traces exercise reconnecting after each outcome |
| C4 refused | Ready / finished / failed / stopped cannot offer another stop | `:30` outline |
| C4 refused | A pending stop cannot be confirmed again | `:98` |
| C4 refused | Offline start / ask / confirm; person outside team | `:15`, `:60`, `:67`, `:134` |

C3: Chess has no `events.qnt`; this expansion introduces no cross-context
domain event. C5: the access table covers account/team membership for checking,
saving, adding and stopping; the existing access examples and new outsider
examples assert denials. Connectivity uses the kernel vocabulary. No additional
upstream relationship is introduced. C6: all new When vocabulary resolves to
these models, the existing source/loading models, or the borrowed connectivity
actions. No scenario contradicts their guards.

## Steps and verification

D2–D5: step files and bindings use exported harness actions/reads and framework
registration. DOM, HTTP controls and synchronization live in the harness source,
not the step bodies. Expectations assert observations; no product-state branch
calculates an expected result. There is one registration entry, no sleeps,
skips or retry runner. D6: binding keys match the public model actions; all
bound actions are drawn. P1–P2: spec changes are in separate `spec:` commits;
the ownership gate passes.

Automated evidence at this revision:

- Strict spec gate: `bunx turbo run @libs/tools#ci:specs -- --strict-duplicates`
  passes. The wrapper currently forwards the bare flag to Turbo, so the task
  invocation is used to deliver it to the checker.
- Combined focused feature/model run: 81 passed, zero failures, including the
  four pinned model regressions. No browser click-through was used as proof.
- Deeper replay: all 144 drawn traces pass, with 156 total model/proof/regression checks and zero failures. Three additional transition examples first failed on undefined steps, then passed.
- Typechecking and lint pass for Chess client, Chess harness, shared harness
  and UI packages. Model shape, type, invariant and bound-action checks pass.
- The statechart check passes, including ownership of the concurrent departure contracts.
- The selected-file regression reproduces the literal `network error` from a native file stream before either CSV or Zstandard upload. Bounded slice reads pass both cases, with cancellation and device-read error checks.
- The model-task registration check first found 20 contracts assigned to 17 proof parts. All 20 parts are now registered, and the existing registration regression passes with the multiplayer budget assigned to its current index.
- The deeper random run failed on the earlier registration count, a window-inference property timeout (seed `276816522`), and the concurrent toolchain/image version mismatch in `libs/infra-server/tests/population-release.test.ts` (seed `-638220406`). That run is not a passing nightly verdict.
- The previous full `bun check-pr` stopped on a stale generated translation
  catalog. Focused results do not substitute for a green full gate.

## Summary

| Checks | Blocking | Warnings |
| --- | --- | --- |
| A0–A6 | 0 | 0 |
| B1–B17 | 0 | B11 repeated preconditions; B16 six-to-eight-step examples described above |
| C1–C6 | 0 | 0 |
| D1–D6, P1–P2 | 0 | 0 |

No contract triage remains in this scope. Full repository verification remains
required before declaring the implementation ready. The final full run was
stopped after the nightly run established the concurrent toolchain/image
mismatch; its passing puzzle-loading proof is useful evidence, not a green
whole-repository verdict.
