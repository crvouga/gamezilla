# Puzzle publication recovery audit

Date: 2026-10-24. Scope: `publication-recovery.feature` and
`publication-recovery.qnt` in Puzzles. This extends the existing save,
publication, withdrawal and connection contracts; it adds no vocabulary.
Verdict: INCOMPLETE. The initial examples and model need implementation
conformance and their complete transition audit. The broader C6 gaps remain
listed in [the lifecycle audit](PUZZLE_LIFECYCLE_SPEC_AUDIT.md).

## Example map

Context: Puzzles. Aggregate: publication recovery. The actor is Alice on her
phone and tablet; Bob discovers only a successful public pack. The pack's
chosen River and Valley editions remain fixed; only River's availability
changes. The feature states the job story.

| Rule | Permitted example | Refused or contrasting example |
| --- | --- | --- |
| Returning online publishes only a still-valid pack | Offline publication with both chosen puzzles still available | The tablet has withdrawn River before the phone returns; no public pack appears and the private draft remains |
| A private offline choice waits without losing work | First choice, repeated choice, reopening and a corrected fresh choice retain the pack privately | No counter-example: a publication reaches other people only after a connection returns |
| Correcting availability permits another publication choice | River is published again, then Alice chooses publication afresh | Publication still refuses while River remains withdrawn; correcting River alone never publishes the pack |

The model names the existing commands `publishPack`, `withdrawChosenPuzzle`,
`republishChosenPuzzle` and `reopenApp`, plus `connectionReturns` and the
model-only loss of connection. Its observable publication choices are draft,
waiting, published and refused. A refusal stays refused when availability
changes until Alice chooses publication again. A pack already published
retains its chosen editions after withdrawal, as the existing pack contract
requires.

## Writer review

- A0–A6: ordinary publication and retained private work; named actors and
  kernel phone/tablet/connection language. No transport, queue, protocol,
  storage or implementation assertion. Every domain word resolves to the
  existing Puzzles glossary or kernel. Only model-name metadata is added.
- B1–B3: capability title, one job story and named rules.
- B4: availability and fresh-choice rules have success and refusal; the
  private waiting rule has its explicit no-counter-example explanation.
- B5–B10: one When per scenario, setup facts, observable outcomes and a
  refusal reason; no quoted interface copy, imperative gestures or technical
  values. River, Valley and Rivers remain the established example data.
- B11–B13/B15: no background or outline; the existing domain tag only.
- B14: publication, reconnection, pack discovery, kept order and the
  unavailable-puzzle reason reuse existing catalog wording. New Given
  phrases distinguish an offline publication choice and a competing tablet
  withdrawal. The added refusal-reading Then explicitly checks that the
  person can read the refusal while editing the kept draft; it is stronger
  than only checking the operation's returned reason elsewhere.
- B16: the longest examples have seven steps. Setup facts establish competing
  choices or a corrected offline choice; the outcomes separately protect the
  reason, contextual explanation, kept draft and absence of public content.
- B17/D1: no case depends on a particular implementation. Failure-code
  serialization and rejection bookkeeping remain code tests, not Gherkin.
- P1: feature, model and glossary metadata belong in a separate `spec:`
  commit; implementers do not edit them.

## Coverage and handoff

| Kind | Model name | Existing term | Evidence / handoff |
| --- | --- | --- | --- |
| command | `publishPack` | publish | `publication-recovery.feature:31`, 39, 53, 64 and 87; existing `publish-packs.feature` |
| command | `withdrawChosenPuzzle` | withdraw | Existing pack-reference withdrawal example; the competing tablet withdrawal is a setup fact here |
| command | `republishChosenPuzzle` | publish | Existing publication-after-withdrawal example; corrected availability is a setup fact here |
| command | `reopenApp` | the app | `publication-recovery.feature:22`, 46, 79; existing offline draft reopening |
| world | `connectionReturns` | connection | `publication-recovery.feature:7`, 13 |
| world | `_loseConnection` | — | Model-only scheduling; its header describes the offline promise |
| invariant | `invPublicationKeepsDraft` | draft, save | `publication-recovery.feature:13`, 64, 79 |
| invariant | `invDiscoveryRequiresPublication` | discover | `publication-recovery.feature:7`, 13, 31 |
| invariant | `invRefusedPackStaysPrivate` | draft, discover | `publication-recovery.feature:13`, 79, 87 |
| invariant | `invRefusalNeedsAnotherChoice` | publish | `publication-recovery.feature:71` contrasts correction alone with a fresh choice at 64 |
| invariant | `invConnectedAvailabilityAgrees` | discover | Reconnection examples; the tablet and phone must observe the same availability |
| invariant | `invOfflineDraftIsKept` | draft, save | Existing offline pack-reopening example |

The eleven examples distinguish an immediate known refusal from a publication
refused on returning online. Draft → waiting is the first offline choice;
waiting → waiting is repetition; waiting → published/refused is reconnection;
refused → waiting/published is a fresh corrected offline/online choice; and
refused → refused is another choice while River remains withdrawn. Existing
pack-publication examples cover draft → published/refused and published →
published repetition. Reopening has examples for every publication choice.
Connected withdrawal and republication are already illustrated by the stable
pack-reference and publication-after-withdrawal contracts. The final audit
must check these citations against the implemented bindings and the complete
context map. There is no new domain event or upstream policy in this aggregate.

## Regression handback

The implementer's first complete recovery run exposed three defects using
the literal Rivers pack containing River and Valley. The existing examples
are tagged to retain those inputs: publication refusal details were lost,
the waiting choice was hidden after offline reopening, and a fresh choice
after River became available could not complete. This handback changes tags
only; every rule, model transition and scenario sentence stays the same.

Run each new example before binding it. Use the real reference app screens
and ordinary local mutations, with the other device changing the chosen
puzzle through those same definitions. Keep fault controls and data access
below the exported harness boundary. The new contextual-refusal assertion
must observe the notice while the draft is open, not infer visibility from a
stored rejection. Preserve the complete private draft and test a fresh
publication after availability is corrected. Then run the whole context,
catalog, spec gate, bounded proof and full verification.

## Initial execution

Quint 0.32.0 typechecks the aggregate. All six invariants hold during fifty
seeded simulations of up to forty steps (424242, TypeScript evaluator).
This is model-only evidence, not product replay or bounded proof.

The feature ran before any new binding: one example passes through existing
definitions (reopening an already published pack); the other ten fail on
undefined steps, with no setup or compilation failure. The gate accepts the
model's language and aggregate shape. Its expected handoff is the missing
model binding and new wording. The strict gate also reports the same thirteen
wording pairs outside Puzzles. Input fingerprints were refreshed after adding
the aggregate. No implementation file changes belong in this `spec:` commit.
