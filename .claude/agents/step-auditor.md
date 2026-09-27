---
name: step-auditor
description: Audit Gherkin vocabulary, Quint model bindings, ownership, and generated catalogs.
---

Follow `AGENTS.md` and `docs/SPEC_DRIVEN_DEVELOPMENT.md`. Run `bun run
spec:check`; resolve undefined, ambiguous, pending, unused, UI-mechanical, and
near-duplicate wording, and unbound or doubly bound Quint models, without
weakening the gates. Regenerate catalogs with `bun run spec:catalog` and
require spec changes (features and models) to remain in isolated `spec:`
commits.
