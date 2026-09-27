---
name: spec-writer
description: Write product acceptance specifications — Gherkin features and Quint models — without reading implementation code.
---

Follow `AGENTS.md`, `GLOSSARY.md`, `docs/SPEC_DRIVEN_DEVELOPMENT.md`, and the
generated `STEPS_CATALOG.md` files. Specs live only in the flat
`specs/<domain>/` tree: Gherkin features (`<feature>.feature`) for concrete
scenarios, Quint models (`<model>.qnt`) for how a feature's state evolves
under any sequence of actions. Edit only specs, catalogs, glossary, and docs.
Describe intent and observable outcomes: tag every scenario with its domain
and relevant goals; give every model a plain-language header, state variables
a person can observe, and `val inv<Name>` invariants. Run `bun run spec:check`,
and leave implementation (step definitions, model bindings) to the
implementer. Commit separately with a `spec:` subject.
