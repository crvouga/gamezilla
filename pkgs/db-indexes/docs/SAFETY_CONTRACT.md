# Automatic indexing safety contract

The requested technical contract lives in [contracts](../tests/contracts/),
outside business-facing product specs under [the repository boundary](../../../specs/README.md).
It exercises the public reconciler through an injected in-memory port. It does
not prove production adapters cannot block traffic or corrupt data; the unproven
obligations below must be closed before that claim. No manual testing counts.

## Executable inventory

| Contract | Capability |
| --- | --- |
| [ownership.feature](../tests/contracts/ownership.feature) | Ownership, primary/unique/operator protection, read-only planning |
| [retirement.feature](../tests/contracts/retirement.feature) | Exact expiry, use, reset/missing nonzero-baseline evidence, returning workload |
| [execution.feature](../tests/contracts/execution.feature) | Commit ambiguity, invalid builds, deferral/failure, recovery, idempotence |
| [budgets.feature](../tests/contracts/budgets.feature) | Deadline admission and resumable build limits |
| [planning.feature](../tests/contracts/planning.feature) | Admission thresholds, deduplication, table cap, migration on empty tables |
| [persisted-interruption.feature](../tests/contracts/persisted-interruption.feature) | Both sides of all five writes in a mixed create/clear/deprecate/drop/cleanup run |
| [index-retirement.qnt](../tests/contracts/index-retirement.qnt) | Workload and retirement interleavings |
| [index-interruption.qnt](../tests/contracts/index-interruption.qnt) | Interrupted builds and conditional recovery |

All run in the normal package `test`. Features are discovered automatically; a
model without an implementation binding fails inventory. Missing/ambiguous steps,
missing pinned checker, violated invariant, unexercised action, and missing
dangerous transition coverage fail checks. Each write-prefix example proves its
interruption was reached. Replay compares actual public state after every action,
including retirement timestamps and usage baselines, and repeats the longest
trace in fresh worlds for deterministic fingerprints.

## Bounds and aggregate coverage

| Model | Finite scope | Exhaustive bound | Implementation samples |
| --- | --- | --- | --- |
| Retirement | Two lookup paths, usage 0–3, days 0–60, advances 0/1/2/40, one operator index | 7 steps after init | 80 traces, at most 25 steps each |
| Interruption | One desired index; absent/invalid/valid; six creation outcomes | 4 steps after init | 80 traces, at most 25 steps each |

The retirement model uses a one-day window to explore interleavings; Gherkin
separately pins the default thirty-day boundary. These are bounded safety checks,
not unbounded liveness proofs. Recovery assumes a stable manifest, faults ending,
further runs, and enough repair/build budget. Permanent failures or infinite
workload changes cannot imply convergence. Sampled replay is not exhaustive
implementation verification ([Quint's evidence boundary](https://quint.sh/docs/simulator)).
`HarnessDb` drops metadata with indexes; independent persistence in an adapter
still needs separate evidence. This fixture is not every possible workload.

| Aggregate obligation | Coverage and evidence |
| --- | --- |
| Retirement actions `declare`, `tune`, `use`, `daysPass`, `keepOwnIndex` | Returning/obsolete workload, use/expiry and ownership examples; every action exercised by database replay |
| Absent → indexed; indexed → retiring; retiring → indexed/absent/renewed window | Successful build, new retirement, returning workload, expiry, observed use; creation/start/cancellation/removal/hold required in traces |
| `invStateConsistent` | Model-only bookkeeping plus bound observations; verification and every sampled state |
| `invObservedUsePreserved` | Expired-window use example; held states required in traces |
| `invDropsAuthorized` | Expiry/reset/missing-use/returning-workload examples; pre-action drop evidence audited by model |
| `invForeignPreserved` | ownership.feature and operator-index replay |
| Interruption actions `attempt`, `recover`, `repeat` | Execution examples; all six outcomes, recovery from absent/invalid/valid, and repetition required in traces |
| Absent → absent/invalid/valid with interrupted/deferred/failed/completed reports | Pre/post/invalid interruption, contention, rejection, successful build examples |
| Absent/invalid/valid → completed-valid; valid → valid | Fresh recovery and no-write repetition examples |
| `invKnownState` | Model-only bookkeeping plus bound observations; verification and every sampled state |
| `invNoFalseCompletion`, `invCrashRemainsUnfinished` | Interrupted/deferred/failed outcome examples |
| `invProtectedIndexSurvives` | Protected index checked after every harness action |

No product events or permissions cross these technical models. `init`/`step`
are runner plumbing. One reconciler, stable within-run observations and bounded
configuration are assumptions; excluded cases remain explicit below.

## Outstanding mandatory safety evidence

These obligations for the no-outage/no-data-loss claim are **UNPROVEN**, not
passing coverage. A confirmed defect needs a literal failing-input pin and
known-bug entry under [the regression policy](./TESTING.md#adding-a-regression).

| ID | Required outcome and adversarial case | Missing evidence |
| --- | --- | --- |
| S1 | Concurrent DDL refusal must yield instead of blocking application traffic | Postgres `runCreateOrDrop` falls back to non-concurrent DDL; live contention and traffic preservation contract |
| S2 | Missing/untrustworthy usage must not prove no use: zero baseline/missing row, reset/reuse, unavailable statistics | Core substitutes zero for missing usage; SQLite reports zero scans. The nonzero-baseline example proves only a narrower case |
| S3 | Removal must use current usage/workload authority: use after planning/during refresh, stale run after new workload | Core race fixtures and adapter serialization/fencing; model covers use between runs |
| S4 | Constraints, schema and definition identity must remain protected if an index changes after planning | Exclusion protection and schema identity cannot be described by current `IndexInfo`; adapter introspection/execution contracts |
| S5 | Deferred/failed replacement or incomplete workload must not authorize unsafe retirement | Replacement-order and authoritative-manifest contracts |
| S6 | Maintenance must preserve actual rows, values, constraints and acknowledged concurrent writes across crashes | Real Postgres/SQLite snapshots and concurrent-write contracts; counts alone are insufficient |
| S7 | Real work must be bounded and invalid settings refused before writes: stalled planning, NaN/infinity, negative estimates, backwards clock, repair starvation | Core validation and port cancellation/resource contracts; current budgets check estimated admission |
| S8 | Independent persistence boundaries must recover: orphan metadata, real process death during concurrent build, disk full | Adapter fault contracts; simulated ambiguity is not database/process durability |
| S9 | Overlapping reconcilers must not duplicate builds, lose metadata or drop desired indexes | Two-run model and core/live bindings; present models contain one reconciler |
| S10 | Hostile workload input must not alter data or escape a namespace: malformed SQL, fingerprints, quoted identifiers, predicates, collisions | Existing naming/indexability properties cover portions; dialect DDL/workload-language contracts remain |

This ledger is an implementation handoff, not a machine-enforced gate for S1–S10.
A green core suite does not close these rows. The release verdict remains
`bun check`; neither this document nor a local package run claims that verdict.

## Audit and commit boundary

Every scenario binds, every public model action is exercised, dangerous
transitions are required, and observations use public package/harness exports.
Business-only vocabulary/glossary/offline-device rules do not apply to this
explicitly requested technical contract. Product specs were not changed.

Repository `spec:check --strict-duplicates`: **INCOMPLETE** for this work because
three existing shared/sync-engine duplicate step pairs fail outside this package.
No global spec-audit PASS is claimed.

The [ownership gate](../../../libs/tools/scripts/check-spec-ownership.ts) treats
every `.feature` as spec text. Commit the six features alone with a
`spec(db-indexes):` subject; commit package-local models, bindings, dependencies,
harness code and package docs separately. Never stage both groups together.
