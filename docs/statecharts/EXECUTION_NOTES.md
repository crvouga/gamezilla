# Automated chart validation

`bun atlas:lint` compiles and checks the authored chart using the installed Atlas core. The current reproducible result is recorded in `.cache/product-statechart/analysis.json`; the source-derived catalog is in `.cache/product-statechart/contracts.json`.

| Check | Current result |
| --- | --- |
| Source shape | Exactly one authored chart, `specs/product.machine.json`, named `product` |
| State identity and sources | All 350 states have globally unique names, matching ids, descriptions and existing source references |
| Complete graph traversal | 1,530 reachable configurations; all 350 states and 906 transitions reached |
| Identity and access | No reachable guest or deleted-account configuration carries paid access |
| Guided journeys | All 47 journeys replay from the product's canonical initial configuration to their declared outcomes |
| Generated paths | 672 guided/generated paths collectively cover all 906 transitions; every planned sequence replays |
| Portable serialization | SCXML round-trip preserves states, nesting, initial states, transitions, metadata and rule cards |
| Compiled model integrity | The enriched JSON guide preserves the one authored topology and all journeys |
| Public routes | All 36 registered route patterns have a reachable chart owner; declared routes are read statically from the composed client and product entry |
| Source-derived catalog | 2,707 contract cards from 344 source files, including complete feature and decision documents, expanded scenarios, decision rows, models, glossary definitions and scope notes |
| Diagnostics | Zero structural or source-ownership findings; traversal completed |

These numbers describe the current source. After a change, regenerate the
reports and use their latest counts. The checker refuses a second chart,
duplicate names, unsupported state logic, missing sources, unreachable
states, invalid journeys, uncovered transitions and a changed SCXML replay.
A truncated exploration fails with reachability marked unknown; reaching the
configured budget does not count as completeness.

The repository's Verify workflow includes the `ci:statecharts` gate in both its PR and full verification task graphs. This repeats chart validation, source closure and public-route ownership automatically; new unowned contracts, forgotten screens or broken chart paths fail the gate. Route inspection uses TypeScript declarations without importing the product; missing dependencies or unresolved dynamic patterns fail rather than disappearing from the inventory. The consumer's standalone build and Atlas core's own automated checks also exercise the portable explorer, while application verification retains its separate obligations.

```sh
bun atlas:lint
bun atlas:build
bun atlas:viz
```

`atlas:build` runs the same validation and builds the standalone viewer at
`.cache/product-statechart-explorer`. `atlas:viz` runs validation and
serves the enriched chart from `.cache/product-statechart/specs`; it needs no
app server, database, provider simulator or product driver. The authored
machine, Atlas metadata and journeys all live in `specs/`.

The compiler's structural analysis uses Atlas's public graph and SCXML
interfaces. Contract cards come directly from the existing specifications:
complete feature and decision documents retain the surrounding rule and
policy text, Gherkin backgrounds are folded into examples, outline rows are
expanded, decision rows preserve their inputs and outputs, and borrowed
glossary terms resolve to their owning definition. A source contract without
a state owner fails compilation. The compiler removes old leaf-level check
headings rather than presenting traceability labels as screen assertions.

Chart traversal validates this finite observable projection. It does not execute the referenced Quint models, decide arbitrary permission inputs, verify runtime concurrency or produce screenshots of the application. No Atlas application driver or recognizer is registered, and no application run is claimed. Product evidence and release decisions remain governed by [full automated verification](../../README.md#correctness-machinery). Source disagreements and incomplete contracts remain visible in [SPEC_CONFLICTS.md](SPEC_CONFLICTS.md) and the [product inventory](../../specs/README.md#product-contract-inventory).
