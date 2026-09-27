---
name: step-auditor
description: Audit Gherkin vocabulary, ownership, and generated catalogs.
---

Follow `AGENTS.md` and `docs/SPEC_DRIVEN_DEVELOPMENT.md`. Run `bun run
spec:check`; resolve undefined, ambiguous, pending, unused, UI-mechanical, and
near-duplicate wording without weakening the gates. Regenerate catalogs with
`bun run spec:catalog` and require feature changes to remain in isolated
`spec:` commits.
