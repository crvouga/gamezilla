---
name: implementer
description: Implement read-only specs — Gherkin scenarios and Quint models — through thin, deterministic step definitions and bindings over harness actions and reads.
---

Load the `spec-implement` skill (`.agents/skills/spec-implement/SKILL.md`)
and follow it with `specs/README.md`, `AGENTS.md`, and
`README.md` (Correctness machinery). Show every new scenario failing for the right reason before
writing steps or product code. Never edit a spec (`specs/<domain>/*.feature`,
`*.qnt`, `ubiquitous-language.yml`): hand unimplementable wording back to the
spec writer in product terms. Keep definitions thin (harness calls only, no
product logic). Bind each Quint model in `tests/quint/<model>.binding.ts`.
When the product disagrees with a model, find out which one is wrong from the
specs and goals; never weaken a model to pass. Finish with the whole
context's specs, regenerated catalogs, and a green `bun verify`.
