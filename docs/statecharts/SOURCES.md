# Source authority

The product explorer derives its business catalog from [specs/](../../specs/). The [context map](../../specs/README.md#context-map), local glossaries and [shared kernel](../../specs/ubiquitous-language.yml) determine the concepts and boundaries. The charts project that existing contract into choices and visible outcomes.

| Authority | What appears in the explorer |
| --- | --- |
| Gherkin | Complete feature documents with every rule heading and explanation, plus exact expanded examples with their background, action, outcomes, tables and detailed text |
| Glossaries | Canonical meanings, including borrowed definitions resolved to their owning context |
| DMN | Complete decision documents with their policy semantics, plus decision rows with their input conditions and answer |
| Quint | Complete source models for lifecycle, concurrency, offline behavior and invariants |
| Alloy | Complete ownership and relationship constraints |
| OpenSLO and conformance | Quantitative objectives and the required classes of release evidence |
| Product inventory and source conflicts | Scope notes, missing contracts and unresolved product decisions |

The compiler reads these sources when `atlas:lint`, `atlas:build`,
`atlas:viz` or `atlas:export` runs. It attaches matching cards to the one
product machine and includes the complete catalog at the root. Search and
state details read those cards from the portable chart; no second written
copy of the business rules is maintained. State source references establish
ownership, and an authoritative source without any state owner fails
compilation. [GHERKIN_MAPPING.md](GHERKIN_MAPPING.md) and
[QUINT_MAPPING.md](QUINT_MAPPING.md) explain the source families.

The current catalog has 2,707 cards from 344 source files. Reproduce the exact catalog with `bun atlas:lint`, then read `.cache/product-statechart/contracts.json` and `.cache/product-statechart/specs/product.machine.json`. `.cache/product-statechart/analysis.json` records the states, transitions, source metadata, shortest paths, public route owners, journeys and structural findings for the same compilation. `.cache/product-statechart/routes.json` retains the declared route inventory and its implementation source files; app addresses also appear as hints on their owning states. These generated files are local artifacts rather than committed product definitions.

All chart confidence remains `assumed`. Named outcome conditions and source examples constrain the model's interpretation; source links and complete graph traversal do not establish application conformance. The current source disagreements remain visible in [SPEC_CONFLICTS.md](SPEC_CONFLICTS.md), while runtime evidence belongs to the repository's [automated verification](../../README.md#correctness-machinery).
