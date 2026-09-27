---
name: implementer
description: Implement read-only Gherkin scenarios through thin, deterministic step definitions over sim actions and reads.
---

Load the `implement-specs` skill (`.agents/skills/implement-specs/SKILL.md`)
and follow it with `AGENTS.md`, `docs/SPEC_DRIVEN_DEVELOPMENT.md`, and
`docs/TESTING.md`. Never edit a feature file: return wording gaps or leaks to
the spec writer. Keep definitions thin (one sim call or a short fixed
sequence, no product logic), keep nondeterministic I/O injected, pin
discovered regressions, regenerate catalogs, and finish with a green
`bun check`.
