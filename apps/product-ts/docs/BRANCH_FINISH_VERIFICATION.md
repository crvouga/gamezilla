# Branch finish verification — 2026-10-09

Verdict: partial checks pass; full verification remains red. This record
supplements [the launch audit](LOCAL_FIRST_LAUNCH_AUDIT.md), not the product
definition. Release policy remains in [the repository briefing](../../../README.md#correctness-machinery).
Nothing was verified by hand. No model, invariant, search bound, deadline,
task budget or assertion was removed or relaxed.

## Completed fixes

The username proof uses array-encoded maps, concrete type inference and
per-transition invariant queries. Its eleven invariants still run at the
original four-step bound and 240-second deadline. Independent invariant
groups retain every target. The package's three model checks pass; username
changes completed in 194.2 seconds.

The private check-artifact publisher no longer publishes tasks that exceeded
their unchanged local budget, even when the task process exited successfully.
Its regression pins the actual 496-second matchmaking task and its 300-second
budget. Seven artifacts previously published by the failed full run were
moved out of the reusable store, not deleted; their fourteen files are
recoverable in `/tmp/<namespace>-over-budget-artifacts.HqlkOJ` on this machine.

Both fixes have example regressions and individual known-bug records.
An adversarial proof-runner test confirms that per-transition scheduling
still rejects a counterexample in a later invariant group.

## Current automated evidence

| Check | Result |
| --- | --- |
| `@libs/profile-harness-ts verify:models` | All 3 models pass at unchanged bounds and deadlines |
| `@libs/profile-harness-ts test` | 9 pass, 593 assertions |
| `@pkgs/quint-server-ts test` | 88 pass, 189 assertions |
| Artifact publication and model-option parser tests | 13 pass, 27 assertions |
| Profile and both Quint package type checks | Pass |
| Profile and both Quint package lint checks | Pass |
| `@libs/tools-harness-ts tc` | Fails in the existing Atlas integration and pinned dependency |
| Last full `bun verify` | Fails; 267 successful tasks out of 316 reported tasks, not a passing aggregate |

The last full run used a 1,094-task plan. It stopped at the chess model-check
task: `custom-game-play` temporal checking, multiplayer bounded checking and
custom-game induction exceeded their respective existing solver deadlines.
Eight executed tasks also exceeded their unchanged task budgets, including
the failed chess task and seven zero-exit tasks. A zero exit is not a passing
budget verdict. The summary and logs are retained in this machine's archive:
`$TMPDIR/check-run-0KAQRr/diagnostics.tar.gz`.

The successful isolated profile checks were run after that full failure.
They do not attest a new full verification result.

## Remaining blockers

The tools package expects Atlas exports `pathKey` and `configKey`, plus
`PlannedPath` fields absent from the pinned Atlas checkout
`e82f93dd6a2182d0d4e8681bb1e53db8dd3ecaa8`. Atlas source also fails the
repository's strict optional-property checks. Its gitlink and checkout agree;
this is not an uninitialized or stale submodule checkout. Dependency source
was not patched and type rules were not weakened.

Chess proof cost, the full gate's other task-budget failures, and the launch
audit's remaining coverage and conformance gaps still require resolution.
This handoff does not claim launch readiness, a complete spec audit, live
browser conformance or deployment. The PR remains open for human review;
no agent merged it.
