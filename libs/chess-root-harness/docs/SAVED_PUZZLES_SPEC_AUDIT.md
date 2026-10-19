# Spec audit — saved Lichess file — 2026-10-15

Scope: `specs/chess/saved-puzzles.feature`, `puzzle-source.qnt`, the new
Lichess file glossary entry, and the existing puzzle-loading contract.

Contract review: no blocking language or coverage findings. All five new
scenarios first failed on their missing steps, then passed through the
implemented UI. `bun run spec:verify` passes with every binding present.
The strict duplicate check also passes through the package-owned task:
`bunx turbo run @libs/tools#ci:specs -- --strict-duplicates`.

## Named checks

| Checks | Evidence |
| --- | --- |
| A0–A2, A5–A6 | A person saves a familiar file, reuses it in another environment, or is told to provide it or return online. No storage, infrastructure, UI mechanics, or implementation identifiers appear in the feature. Actors and environment are kernel terms; adding puzzles is Chess vocabulary. |
| A3 | “Lichess file” is the exact noun supplied in the person's request to share and reuse that file. The spec commit records that confirmation. |
| A4 | No new foreign terms or model imports. |
| B1–B10 | One job story; two rules with positive and refusal examples; one When per scenario; Given facts; observable offers, refusal reasons, and addition status; no quoted app copy. |
| B11 | Warning: repeated team preconditions keep each example independently readable. |
| B12–B15 | No outlines, fabricated example values, duplicate new commands, or unsupported tags. New phrases distinguish saved-file availability and saving from the existing environment-import actions. |
| B16 | Warning: the offline-save example has six steps to retain the team, missing-file, and offline preconditions. |
| B17, D1 | Cross-environment reuse is observable. Bucket names, credentials, conditional writes, file encoding, and storage adapters belong in code and infrastructure checks. |
| D2–D6 | Thin steps call exported harness actions and observable reads. The new source model checks availability, importing and connectivity through the UI. Existing loading controls, progress and update scenarios pass. Source and loading model proofs pass, as do all 30 drawn product traces. |
| P1–P2 | This contract is committed separately from implementation. |

## Coverage — puzzle source

| Kind | Model name / transition | Evidence | Status |
| --- | --- | --- | --- |
| command | saveLichessFile | First-file saving example | covered |
| command | addPuzzles | Another environment reuses the saved file | covered |
| command | followAddingPuzzles | Saved file offered without another file choice | covered |
| connection | loseConnection / comeBackOnline | Existing puzzle-load-controls and puzzle-load-progress connection examples | covered |
| invariant | invLichessFileNeededOnlyWhenMissing | Missing-file refusal and saved-file offer examples | covered |
| invariant | invAddingPuzzlesHasLichessFile | Adding without a saved file is refused | covered |
| invariant | invOfflineFileAvailabilityPreserved | Offline-save refusal retains the missing file; existing offline-start refusal retains an available file | covered |
| transition | missing → saved | First-file saving example | covered |
| unavailable | save while saved | Another file is not offered | covered |
| illegal | save while offline | Connection-needed refusal | covered |
| transition | add while saved | Cross-environment addition | covered |
| illegal | add while missing | Asked to provide a file; no addition | covered |
| illegal | add while offline | Existing puzzle-load-controls offline-start refusal | covered |
| transition | follow while saved / missing | Saved-file offer / missing-file refusal | covered |

The source aggregate complements `puzzle-loading.qnt`: the latter continues
to own one ongoing addition per environment, progress, stop, failure,
restarting, pool preservation, and offline observation. Team access remains
the existing puzzle-management decision table. No new upstream policy or
domain event is introduced. Reusing action vocabulary across the two
aggregates is intentional: one user action exercises both contracts.

The existing loading model now treats a later addition from the saved file
as an update of the same puzzles, rather than choosing a new file on every
start. Its commands, status transitions and coverage remain unchanged.

A deeper replay found an old delivery consuming the harness worker action
after a stopped job. The literal trace is pinned as
`puzzle-load-stale-delivery`; the worker action now targets the active job's
part. The existing failed-load restart example is pinned as
`puzzle-load-retry-shared-source`: its simulated outage now restores the same
source bytes before a later load. No product assertion was relaxed.

The final combined run passes all 55 checks: the saved-file and ingest
scenarios, all 30 drawn source/loading traces, the pinned regression and
model shape, type, invariant and action checks. Its Atlas report collection
also succeeds. The full repository gate remains the release verdict.
