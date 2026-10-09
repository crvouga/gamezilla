# Explore the whole product

`bun atlas:viz` opens the product model without starting Gamezilla or its local services. Choose **gamezilla-product**, then **Explore freely** to choose what happens next. **Explore the whole product** is a guided journey through the composed capabilities; shorter journeys explain refusals, recovery and particular outcomes.

```sh
bun atlas:viz
bun atlas:run
bun atlas:lint
```

`atlas:viz` compiles the chart and starts the lightweight Atlas viewer. It watches the specifications and authored charts, recompiling valid changes while preserving the last valid model after a rejected update. `atlas:run` validates the same model and builds a standalone explorer in `.cache/product-statechart-explorer`. `atlas:lint` runs the structural checks without starting a viewer.

Free exploration shows the states active together, available events grouped by **Person chooses**, **Outside outcome** and **Time passes**, and the states entered or left after each choice. Search finds choices, states and business rules. **Find a route** searches from the current configuration and can follow the resulting path. Undo, redo, reset and choice history let you compare branches; **Share** copies an address that restores the exploration.

Open a state to read its capability's exact source-derived examples and decisions. Gherkin cards include their background, every expanded example row, supplied tables and detailed outcomes. Complete feature documents retain rule headings, explanations and scenario context. Decision cards show the conditions and answer, with the complete decision documents preserving their policy semantics. Glossary cards explain the canonical terms, including borrowed definitions. Models, structural constraints, objectives, the product inventory and unresolved source disagreements remain available in the same searchable catalog. These cards explain the contract; opening them does not claim their acceptance checks passed.

[product.machine.yaml](product.machine.yaml) is the single authored root. Its parallel branches keep the current person and this device's place explicit. All 35 modules compose into one enriched chart, with 350 states, 906 transitions and 47 guided journeys. The compiler attaches 2,707 source-derived contract cards at capability boundaries and produces one `product.machine.json` for the viewer. Every one of the 36 registered public route patterns has a reachable state owner, including the profile editor's alternative addresses, parameterized links and the not-found screen. The [composition map](STRUCTURE.md) explains where each module belongs.

Opening a puzzle, Custom Game or multiplayer capability observes its retained attempt, choices, search, game or result. Navigation does not create a replacement record. Refusals preserve the relevant choices; finished games retain their outcomes and offer review, rematch or another game. Shared facts refer to the current person, viewed space or selected relationship, as described in [INTERACTIONS.md](INTERACTIONS.md).

Outcome names include their conditions, such as the current person's permission, agreed readiness, ownership or a deadline. The chart presents those branches for exploration. Actor identity, entity data, ratings, clocks and competing choices remain governed by the referenced specifications. The root separates account identity from device navigation and prevents a guest or deleted account carrying paid access.

The testing-tool branch includes independently scoped room, notes, matchmaking, chessboard and maintenance contracts. Its **inspection scope** branch also identifies current diagnostic and component-reference surfaces whose complete observable contracts still need definition. Read these gap descriptions before assuming a capability is specified; [SPEC_CONFLICTS.md](SPEC_CONFLICTS.md) and the authoritative [product contract inventory](../../specs/README.md#product-contract-inventory) retain the open decisions.

The authority remains [specs/](../../specs/). [INVENTORY.md](INVENTORY.md) describes source coverage, [SOURCES.md](SOURCES.md) explains how the compiler derives the catalog, and [EXECUTION_NOTES.md](EXECUTION_NOTES.md) records the automated chart checks. Complete source ownership and graph traversal establish the exploration model's structure. Application conformance and release decisions require the repository's [automated product verification](../../README.md#correctness-machinery).

Each command also writes the enriched portable chart to `.cache/product-statechart/product.scxml`, the source catalog to `.cache/product-statechart/contracts.json`, and the graph analysis to `.cache/product-statechart/analysis.json`. `bun atlas:export` validates and exports the same enriched product chart, including its inline business cards, as SCXML.
