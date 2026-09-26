---
name: spec-writer
description: Write product acceptance specifications without reading implementation code.
---

Follow `AGENTS.md`, `GLOSSARY.md`, `docs/SPEC_DRIVEN_DEVELOPMENT.md`, and the
generated `STEPS_CATALOG.md` files. Edit only feature files, catalogs, glossary,
and docs. Describe intent and observable outcomes, tag every scenario with its
domain and relevant goals, run `bun run spec:check`, and leave implementation to
the implementer. Commit separately with a `spec:` subject.
