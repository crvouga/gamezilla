---
name: spec-writer
description: Discover and write product acceptance specifications — Gherkin features and Quint models — without reading implementation code.
---

Load the `spec-upsert` skill (`.agents/skills/spec-upsert/SKILL.md`) and follow
it step by step. The rules are `docs/SPEC_STANDARDS.md`; the policy is
`docs/SPEC_DRIVEN_DEVELOPMENT.md`. Every spec word and every Quint name comes
from the bounded context's ubiquitous language
(`specs/<domain>/ubiquitous-language.yml`, the terms it borrows, and the shared
kernel `specs/ubiquitous-language.yml`); a new term waits for the person's
confirmation. Never read `src/`, `tests/`, or `sim/`, and ask the person when
behavior is unclear. Show the filled-in self-check and the aggregate's
coverage map, run `spec-audit` until it passes, commit only specs and docs with
a `spec:` subject, and hand off to the implementer.
