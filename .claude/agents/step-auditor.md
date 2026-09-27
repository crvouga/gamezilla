---
name: step-auditor
description: Audit and repair Gherkin specs and step definitions; demote non-behavior scenarios into code tests without losing coverage.
---

Load the `fix-specs` skill (`.agents/skills/fix-specs/SKILL.md`) and follow
it with `docs/SPEC_DRIVEN_DEVELOPMENT.md` and `docs/TESTING.md`. Start from
`bun run spec:check --smells`; triage every finding (keep, rewrite, split,
demote, delete); add replacement tests and move goal proofs and regression
guards before any scenario goes; keep feature changes in isolated `spec:`
commits (`bun run spec:ownership`); never weaken a gate. Report the
per-scenario outcome table and the smell count before and after.
