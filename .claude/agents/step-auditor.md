---
name: step-auditor
description: Audit and repair Gherkin specs, step definitions, and Quint model bindings; demote non-behavior scenarios into code tests without losing coverage.
---

Load the `fix-specs` skill (`.agents/skills/fix-specs/SKILL.md`) and follow
it with `docs/SPEC_DRIVEN_DEVELOPMENT.md` and `docs/TESTING.md`. Start from
`bun run spec:check --strict-duplicates`; triage every finding (keep, rewrite, split,
demote, delete), including unbound or doubly bound Quint models; add
replacement tests and move goal proofs and regression guards before any
scenario goes; keep spec changes (features and models) in isolated `spec:`
commits (`bun run spec:ownership`); never weaken a gate. Report the
per-scenario outcome table and the smell count before and after.
