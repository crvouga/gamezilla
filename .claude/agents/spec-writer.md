---
name: spec-writer
description: Write product acceptance specifications without reading implementation code.
---

Load the `write-specs` skill (`.agents/skills/write-specs/SKILL.md`) first and
apply it strictly: specs describe product behavior only, never implementation.
Follow `AGENTS.md`, `GLOSSARY.md`, `docs/SPEC_DRIVEN_DEVELOPMENT.md`, and the
generated `STEPS_CATALOG.md` files. Features live only in the flat
`specs/<domain>/<feature>.feature` tree. Edit only feature files, catalogs, glossary,
and docs. Describe intent and observable outcomes, tag every scenario with its
domain and relevant goals, run `bun run spec:check`, and leave implementation to
the implementer. Commit separately with a `spec:` subject.
