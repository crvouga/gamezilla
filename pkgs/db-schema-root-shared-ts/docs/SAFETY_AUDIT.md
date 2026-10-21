# Safety contract audit — 2026-10-01

Verdict: **INCOMPLETE for adapter safety conformance**.

The technical contracts are package documentation, not business specs (A0,
B17). Their reference protocols are package model-test fixtures. The original
schema-safety fixture remains replayed against the evolution gate. No spec
gate is bypassed, and no connectivity behavior is added to a database
protocol merely to satisfy the product model shape check.

The documented examples cover server reconciliation (25), local recovery
(24), declared indexes (8), and automatic indexes (32). They are desired
implementation obligations and do not execute against adapters. Coverage is
mapped in [SAFETY_CONTRACT.md](SAFETY_CONTRACT.md#model-coverage-map).

## Model evidence

| Model | Invariants | Concrete witness runs | Exhaustive bound |
| --- | --- | --- | --- |
| [transaction](../../../pkgs/db-schema-root-shared-ts/tests/quint/reconciliation-transaction.qnt) | 7 | 4 | 10 actions |
| [rebuild](../../../pkgs/db-schema-root-shared-ts/tests/quint/rebuild-recovery.qnt) | 5 | 4 | 10 actions |
| [indexes](../../../pkgs/db-indexes-root-harness-ts/tests/quint/index-reconciliation.qnt) | 7 | 7 | 10 actions |

All models typecheck, all witnesses pass and all invariants hold in bounded
Apalache verification. Each also samples 100 traces of up to 30 actions using
the pinned seed. The runners reject missing invariants, zero witness runs,
empty samples and declared actions never taken by those samples.

All new actions and invariants have mappings in the coverage map. That map
also names the finite scopes, legal state paths, recovery assumptions and
obligations outside model scope. Uniqueness, engine-level lock behavior,
arbitrary payload types and unsupported SQLite objects remain dialect checks,
rather than pretending the reference models cover them.

## Implementation triage

**UNPROVEN**: all 89 documented examples and all new adapter replay bindings.
Their model tests prove reference-protocol validity; no adapter
conformance result can be inferred. The exact remaining evidence classes
are listed in [the implementation handoff](SAFETY_CONTRACT.md#implementation-handoff-and-release-verdict).

One existing expectation needs explicit reconciliation: the package README
requires a retired target to exist, while the existing planner test named
“a tombstone absent from the catalog is materialized, not drift” expects
creation. The new populated-database refusal examples follow the fail-closed
documented policy. Existing green tests alone cannot settle that discrepancy.

Bind first and demonstrate the expected failures. Then resolve product/port
gaps without weakening preservation, ownership, refusal or truthful-result
requirements. New pure model checks cannot authorize a production safety
claim while these obligations are unproven.
