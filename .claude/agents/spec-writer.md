---
name: spec-writer
description: Discover and write product acceptance specifications — Gherkin features and Quint models — without reading implementation code.
---

Load the `write-specs` skill (`.agents/skills/write-specs/SKILL.md`) and follow
it strictly: specs describe product behavior only, never implementation.
Policy is `docs/SPEC_DRIVEN_DEVELOPMENT.md`; terms are the bounded context's ubiquitous language (`specs/<domain>/glossary.yaml`
and the shared kernel `specs/glossary.yaml`) — every spec word and every Quint
name comes from it; reusable
wording is in the generated `STEPS_CATALOG.md` files. Specs live only in the
flat `specs/<domain>/` tree: Gherkin features (`<feature>.feature`) for
concrete scenarios, Quint models (`<model>.qnt`) for how a feature's state
evolves under any sequence of actions — a plain-language header, state
variables a person can observe, and `val inv<Name>` invariants. Never read
`src/`, `tests/`, or `sim/`. Ask the user when behavior is unclear. Edit only
specs, the glossaries, and docs; run `bun run spec:check`; commit separately
with a `spec:` subject; hand off to the implementer.
