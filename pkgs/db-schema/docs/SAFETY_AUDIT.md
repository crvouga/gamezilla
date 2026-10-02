# Safety contract audit — 2026-10-01

Verdict: **FAIL for the central spec gate; INCOMPLETE for release conformance**.
The bounded-context layout and reference model checks pass. No manual
verification was performed.

Scope: four Gherkin contracts in the `db-schema` and `db-indexes` bounded
contexts, three new Quint models, their validity runners and
[the aggregate coverage map](SAFETY_CONTRACT.md#model-coverage-map).
The existing schema-safety model also moved into `specs/db-schema/`; its
model semantics and implementation replay are unchanged.

## Feature evidence

| Feature | Expanded examples | Evidence |
| --- | --- | --- |
| [server reconciliation](../../../specs/db-schema/server-reconciliation.feature) | 25 | Official Gherkin parser; one action and observable package outcomes |
| [local recovery](../../../specs/db-schema/client-recovery.feature) | 24 | Official parser; includes every durable rebuild boundary and ambiguous recovery |
| [declared indexes](../../../specs/db-schema/schema-indexes.feature) | 8 | Official parser; separates schema/index phases and required-coverage failure |
| [automatic indexes](../../../specs/db-indexes/automatic-indexes.feature) | 32 | Official parser; exact retirement boundary, protected objects and stale evidence |

All 89 expanded examples contain one action and at most five steps.
Every scenario is under a rule; each outline has at most six example rows.
Quoted values are fixture data. Every feature carries its context's
`@domain` tag. Each context has a glossary, a context-map entry, conformance
registration and exactly one owning package in `specDomains`. Expanded
outline titles now include the varied value and are unique.

All spec definitions live in `specs/`; package directories contain runners
and bindings. Both package test caches include their external context files.
Catalogs were regenerated through the standard catalog command.

## Model evidence

| Model | Invariants | Concrete witness runs | Exhaustive bound |
| --- | --- | --- | --- |
| [transaction](../../../specs/db-schema/reconciliation-transaction.qnt) | 7 | 4 | 10 actions |
| [rebuild](../../../specs/db-schema/rebuild-recovery.qnt) | 5 | 4 | 10 actions |
| [indexes](../../../specs/db-indexes/index-reconciliation.qnt) | 7 | 7 | 10 actions |

All models typecheck, all witnesses pass and all invariants hold in bounded
Apalache verification. Each also samples 100 traces of up to 30 actions using
the pinned seed. The runners reject missing invariants, zero witness runs,
empty samples and declared actions never taken by those samples.

All new actions and invariants have mappings in the coverage map. That map
also names the finite scopes, legal state paths, recovery assumptions and
obligations outside model scope. Uniqueness, engine-level lock behavior,
arbitrary payload types and unsupported SQLite objects remain dialect checks,
rather than pretending the reference models cover them.

## Gates and findings

Package typechecks, lint, naming and whitespace checks pass. The schema/index
package suite passes 148 tests with no failures, using the relocated files.
These results do not make the central spec gate green.

`bun run spec:check` now discovers these contexts and reports:

- D4: both packages need `tests/steps/index.ts` and `tests/quint/index.ts`
  composition entries for full implementation conformance.
- D6/C6: the three new models have no implementation replay bindings. The
  relocated existing schema-safety model retains its evolution-gate binding.
- Undefined steps: all 89 new examples require implementation bindings;
  there are 349 expanded-step findings, not 349 distinct requirements.
- A5: the gate's product-oriented implementation-word checks reject technical
  schema-contract terminology (71 findings). The intended-reader distinction
  is now explicit in the rulebook; automated checks still need corresponding
  context-aware validation rather than a blanket exception to safety checks.
- Model shape: the gate requires offline-device connectivity for each of the
  three new transaction/recovery/index protocols (six findings). Their
  reference validity checks pass, but the central shape policy must be
  reconciled with these protocol subjects before claiming gate conformance.
- Prose smells: 16 technical server-word findings remain under the same
  product-oriented check.

Language, context ownership, cache inputs, catalog freshness, domain tags and
expanded scenario uniqueness have no remaining findings. No checker was
bypassed or suppressed. The three existing near-duplicate wording warnings
in the platform and sync-engine steps remain; strict duplicate checking also
rejects those. Full remote `bun check` has not been obtained for these
uncommitted changes.

## Implementation triage

**UNBOUND**: all 89 new Gherkin examples and all new model replay bindings.
Their parser/model tests prove reference-contract validity; no adapter
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
