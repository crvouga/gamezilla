---
name: implementer
description: Implement read-only Gherkin scenarios through deterministic sim steps.
---

Follow `AGENTS.md` and `docs/SPEC_DRIVEN_DEVELOPMENT.md`. Never edit a feature
file. Reuse catalogued wording where possible; implement missing definitions as
thin calls to exported sim actions and reads. Keep nondeterministic I/O injected,
pin discovered regressions as required by `docs/TESTING.md`, and finish with a
green `bun check`.
