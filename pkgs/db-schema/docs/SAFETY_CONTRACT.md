# Reconciliation safety contract

Framework safety is technical: the examples below are package documentation,
and the Quint files are fixtures for package model tests. They are not
business specifications or claims of adapter conformance. Product behavior
remains in `specs/`, as required by [the spec standard](../../../specs/README.md).

These contracts define desired safety, including requirements not yet proven
against implementation. Current dialect policy is in
[the package briefing](../README.md#safety-model).

## Canonical contracts

| Subject | Examples | Reference model |
| --- | --- | --- |
| Server declaration, evolution, backfill, locking | [server reconciliation](../../../pkgs/db-schema/docs/SERVER_RECONCILIATION.md) | [reconciliation-transaction.qnt](../../../pkgs/db-schema/tests/quint/reconciliation-transaction.qnt), existing [schema-safety.qnt](../../../pkgs/db-schema/tests/quint/schema-safety.qnt) |
| Local shared data, rebuilds, recovery, settings | [client recovery](../../../pkgs/db-schema/docs/CLIENT_RECOVERY.md) | [rebuild-recovery.qnt](../../../pkgs/db-schema/tests/quint/rebuild-recovery.qnt) |
| Declared indexes, invalid builds, uniqueness, budgets | [declared indexes](../../../pkgs/db-schema/docs/SCHEMA_INDEXES.md) | Ordinary build lifecycle abstracted by [index-reconciliation.qnt](../../../pkgs/db-indexes/tests/quint/index-reconciliation.qnt); uniqueness remains a dialect contract obligation |
| Automatic indexes, ownership, retirement, stale evidence | [automatic indexes](../../../pkgs/db-indexes/docs/AUTOMATIC_INDEXES.md) | [index-reconciliation.qnt](../../../pkgs/db-indexes/tests/quint/index-reconciliation.qnt) |

The documented examples are implementation obligations, not executed
scenarios. Syntax checks still parse every documented example. Model tests
check reference protocols only. The existing
schema-safety binding checks the evolution gate, rather than SQL execution.

## Terms and fixtures

| Term | Meaning in this contract |
| --- | --- |
| Reconciliation | Compare the current catalog with a declaration and safely reach the declared shape; no ordered migration history is an input. |
| Acknowledged | The application has reported a write as durable. Attempted or rolled-back writes are not acknowledged. |
| Authoritative copy | A durable copy containing the exact identifiers and values whose preservation must be proven before another copy is removed. |
| Retirement | A permanent schema tombstone, or the distinct quiet-window lifecycle of an automatic index, as named by the relevant feature. |
| Owned index | An ordinary index whose complete identity is proven eligible for automatic management. Its spelling alone is insufficient. |
| Budget | A finite configured limit on lock waiting, execution, total work, batch size, or resource consumption. A deadline prevents new work; it alone does not bound an operation already in flight. |
| Success | The promised required work is verified complete. Deferred, failed, unknown, and invalid required coverage do not satisfy that result. |

Adapters use one kitchen-sink ledger example, with receipts, referencing
invoices, package-private bookkeeping and an upload queue sharing a database.
No separate example application per scenario. Value fixtures include NULL,
empty string, zero, false, Unicode, large supported integers, exact supported
timestamps, nested JSON, binary values where supported, soft-deleted rows,
and unsent queued writes. Observe values by row identifier; equal row counts
are insufficient evidence. Explicit local retirement is an intentional
projection, subject to the unsent-value preservation/refusal examples.

## Failure and availability evidence

The features name required outcomes. Implementation evidence must cover these
independently injected boundaries:

| Boundary | Required evidence home |
| --- | --- |
| Declaration validation; complete catalog read; planning | Server preflight contracts |
| Lock acquisition; each DDL statement; each backfill batch; commit acknowledgement | Server transaction fault contracts |
| Original staging; replacement creation; partial copy; validation; publication; cleanup | Local recovery fault contracts |
| Recovery interrupted at those same durable boundaries | Local repeated-recovery contracts |
| Index build start; invalid artifact; completion; metadata write; retirement drop | Declared/automatic index fault contracts |
| Usage/demand changes between planning, checking and execution | Coordinated concurrent index contracts |
| Lock/statement timeout; total deadline; full storage; oversized local copy | Adapter availability/resource contracts |

A failed statement differs from lost acknowledgement after commit: include
both. Inspect durable state through a fresh connection, without relying on
the failed process's memory or cached plan. Resolve unknown commit outcomes
through durable state before resuming.

Configurations need finite work/lock limits. Check the injected clock one
tick before, exactly at, and one tick after each configured deadline.
Production budgets are deployment decisions; this contract invents no latency
target. The 30-day retirement example pins the documented default. The model
uses two abstract ticks to expose the quiet-window boundary cheaply.

## Model coverage map

Mappings concern reference-model coverage, not adapter coverage. Named
scenarios live in the canonical contracts above.

### Transaction protocol

| Model obligation | Example or classification |
| --- | --- |
| `acquire`, `refuseContender`, `invKnownOwner`, `invNoStaleCommit` | A second reconciler observes the first reconciler's committed result; Exhausting the configured lock budget aborts safely |
| `stageAdd`, `commit`, `invOriginalColumnPresent`, `invRowsPreserved` | Additive changes preserve every existing row |
| `stageBackfill`, `applicationWrite`, `invAcknowledgedValues`, `invExactValues` | Copying into a new column leaves both history and filled values intact; A failed batch is resumable without overwriting intervening writes |
| `stageRetire`, `invRetirementFrozen` | Retirement preserves server values for an older application; the existing schema-safety model also covers frozen logical types and permanent tombstones |
| `abort` | A failing schema transaction publishes none of its partial changes |
| `refuseUnsafe` | Unsafe drift refuses the entire plan; destructive snapshot evolution examples |

Legal path: unlocked → locked → committed/unlocked or aborted/unlocked.
A second owner cannot acquire a held lock. A staged edit is never published.

### Local rebuild protocol

| Model obligation | Example or classification |
| --- | --- |
| `applicationWrite`, `invNoAcknowledgedDataLoss` | A pending application write cannot race the copy and be lost |
| `stage`, `createReplacement`, `copyRow`, `validate`, `publish`, `cleanup` | A row-preserving rebuild removes only the retired column; fresh recovery examples at every durable boundary |
| `invReadyIsComplete` | Equal row counts cannot hide a changed value or identifier |
| `failCopy` | A failed copy leaves the original table authoritative |
| `crash`, `recover` | A fresh reconciliation recovers after each durable boundary; A second interruption during recovery remains recoverable |
| `conflictingCopy`, `refuseAmbiguous`, `invAmbiguousHolds` | Ambiguous recovery refuses to guess which values to discard |
| `invSettingsRestored` | Connection settings are restored on every exit |
| `invKnownPhase` | Model bookkeeping; concrete witnesses pin the legal phase path |

Legal path: ready → staged → copying → validated → published → ready.
Publication before exact validation and cleanup before publication are
disabled. A crash stops service; unambiguous recovery returns to ready.
Ambiguous recovery remains stopped and keeps both copies. Foreign-key
definitions, retired-column projections, queued payloads and initial settings
other than the chosen model pair remain adapter-check obligations.

### Automatic index protocol

| Model obligation | Example or classification |
| --- | --- |
| `startBuild`, `finishBuild`, `failBuild`, `invBuildStateDisjoint` | An interrupted build is repaired before success is reported; A failed replacement cannot remove the last usable access path |
| `changeDemand`, `beginRetirement`, `cancelRetirement` | A replacement build completes before the old index can disappear; Renewed workload demand cancels retirement |
| `tick`, `planDrop`, `executeDrop`, `invEveryDropProvenSafe` | Only the complete quiet window permits a drop; Two reconcilers cannot use stale evidence to drop a required index |
| `useOld`, `refreshWindow` | Usage during retirement restarts the full quiet window |
| `loseEvidence`, `restoreEvidence` | Missing or regressed evidence cannot authorize deletion |
| `crash`, `restart` | A fresh run converges after each index-change boundary |
| `exhaustBudget`, `invFiniteBudgets` | An exhausted deadline starts no further index action |
| `reportSuccess`, `invSuccessIsTruthful` | Required deployment indexes cannot be silently skipped |
| `invProtectedUnchanged`, `invOnlyOwnedObjects` | Protected or ambiguous objects are never modified; An owned-looking index on the wrong table cannot be adopted |
| `invDomainDataUnchanged` | Domain rows remain unchanged during tuning |

Build path: absent → invalid/building → valid. Fresh recovery can complete
an invalid build. Retirement: retained → retiring → removed, or retiring →
retained on renewed demand. Stale execution retains the index. New demand
after lawful removal is pending until valid coverage is built; the model
does not promise instant coverage for a previously absent workload.

## Bounds and assumptions

The three new models contain 19 invariants and 15 deterministic witness runs.
Each is typechecked, sampled with 100 traces of up to 30 actions on the pinned
seed, and exhaustively checked through 10 actions with pinned Apalache.
Witnesses reach commit, abort, contention, intervening writes, both recovery
branches, ambiguity, eligible deletion, stale refusal, replacement recovery
and quiet-window reset. Disabling all useful work cannot pass these witnesses.

Finite scopes: two transaction workers and two rows; one extra local write;
two ordinary owned indexes and six protected classes; three generations,
three observed uses and three budget units. These are proof scopes, never
production limits. The original schema-safety model separately covers
logical types, frozen retirements and older copies.

Safety holds across modeled interruptions within the checked bound. Eventual
recovery assumes faults stop, work is finite, resources suffice and recovery
can execute. Witnesses demonstrate finite recovery paths. There is no proof
of unbounded temporal liveness, engine bugs, arbitrary SQL, disk corruption,
physical query performance or production availability from these models.

## Implementation handoff and release verdict

Authored-contract review and gate findings: [SAFETY_AUDIT.md](SAFETY_AUDIT.md).

Authoring is complete when syntax, witnesses and model invariants pass and
gaps are explicit. Release safety additionally requires the feature steps
and model traces to run against public harnesses over actual reconcilers.

| Obligation | Current evidence status |
| --- | --- |
| New Gherkin syntax and single-action examples | Automatic package tests |
| Quint types, witnesses, sampling, bounded exhaustive invariants | Automatic package tests |
| Existing evolution-gate trace replay and dialect contracts | Existing tests; see [TESTING.md](TESTING.md) |
| New feature execution against adapters | **UNBOUND**: every new scenario needs an implementation binding |
| New transaction/rebuild/index trace replay against adapters | **UNBOUND**: every new action and observation needs a binding |
| Stale retirement coordination; supported workload union | **UNPROVEN** against implementation |
| Finite in-flight limits, large-copy deferral, storage exhaustion | **UNPROVEN** against implementation |
| Unsent retired-column values, ambiguous recovery, unsupported attached objects | **UNPROVEN** against implementation |
| Live concurrent Postgres DDL and durable SQLite recovery | Extend existing contract suites; existing pins do not prove the full new contract |
| Release verdict for these obligations | **INCOMPLETE**, never a safety PASS with missing bindings/evidence |

Bind features through one exported kitchen-sink harness per package. Bindings
call public actions and compare observations after every model step; they
must not reproduce reconciliation rules to manufacture an oracle. Keep pure
planner checks, fault contracts and live-engine conformance distinct.
Simulators check port behavior; concurrent DDL and durability need real-engine
evidence in the existing contract gates. Fault tests never use production.

Implementation gaps must fail for the intended safety reason before fixing.
Never relax the contract, ignore errors or label partial work successful to
obtain a pass. Follow [the regression policy](../../../AGENTS.md#hard-rules)
for concrete product bugs.

```sh
bun test pkgs/db-schema/tests/quint/reconciliation-contracts.test.ts pkgs/db-indexes/tests/quint/index-contracts.test.ts
```

Existing package `test` tasks include the runners and hash their context
specifications. Gherkin/Quint additions are dev-only. Reconciliation behavior is unchanged.
