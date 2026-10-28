<!--
Keep every `##` section with real content; the HTML comments are guidance.
Stay high level: everything above the checklist fits in ~120 words.
Verify a box only when it is true.
-->

## Summary

<!-- 1–3 short bullets: the outcome, not the implementation. -->

## Why

<!-- One sentence: the problem it solves, plus `Closes #N` if any. -->

## Scope

<!-- One line of top-level areas touched; `Out:` only if non-obvious. -->

## Verification

<!--
One line: the automated verifications exercised and their result (`verify:end` →
green). Never a manual step — we do not test by hand.
One line — required: what this PR does NOT prove.
-->

## Risk

<!--
One line: low | medium | high, blast radius, rollback. Add release ordering
(e.g. migrate-before-release) only when there is some.
-->

## Provenance

<!--
One line: human | `/pr-ready` agent (model), plus any open question a human
must decide before merging.
-->

## Checklist

- [ ] CI (`verify:end`) is green on this PR.
- [ ] No verification was weakened: no deleted or skipped tests, no loosened assertion, no `@ts-ignore`, no disabled lint rule.
- [ ] Changed behavior is covered by a property- or model-based test; every bug fixed has an example regression test (`// regression: <id>`) registered as `libs/tools-harness-ts/goal/known-bugs/<id>.json`. Nothing was verified by hand.
- [ ] No deprecated code left behind: replaced APIs are deleted and every call site migrated here.
- [ ] Nondeterministic I/O stays injected (Clock/Timers/http/createId/random); no bare `Date.now`, `setTimeout`, `fetch`, or `crypto.randomUUID` in product code.
- [ ] Schema changes use `defineTable` + a registered migration; no raw `CREATE TABLE` and no new `.sql` schema files.
- [ ] Domain removals are soft deletes (`deleted_at`); no `DELETE FROM` on domain tables.
- [ ] Client reads/writes go through local SQLite queries and mutations; no new data REST endpoint.
- [ ] Any new secret is registered in `@libs/secrets` and either seeded for every environment or written by OpenTofu (`libs/infra-shared-ts/tofu/stacks/foundation/secrets.json`).
- [ ] Person-facing changes meet the definition of done in `docs/SELF_SERVICE_READINESS.md` and update its matrix row; no copy sends a person to support.
- [ ] Docs updated wherever behavior, conventions, or operations changed.
- [ ] No long-running local process still holds a machine-wide singleton port (EMQX `1883`/`8083`/`18083`, wrangler `8788`).
- [ ] Merged by a human only once every verification is green; never `--admin` or merge queue. Merging releases.
