<!--
Keep every `##` section with real content; the HTML comments are guidance.
Stay high level: everything above the checklist fits in ~120 words.
Check a box only when it is true.
-->

## Summary

<!-- 1–3 short bullets: the outcome, not the implementation. -->

## Why

<!-- One sentence: the problem it solves, plus `Closes #N` if any. -->

## Scope

<!-- One line of top-level areas touched; `Out:` only if non-obvious. -->

## Verification

<!--
One line: the surface exercised and its result (`bun check` → green).
One line — required: what this PR does NOT prove.
-->

## Risk

<!--
One line: low | medium | high, blast radius, rollback. Add deploy ordering
(e.g. migrate-before-deploy) only when there is some.
-->

## Provenance

<!--
One line: human | `/pr-ready` agent (model), plus any open question a human
must decide before merging.
-->

## Checklist

- [ ] CI (`bun check`) is green on this PR.
- [ ] Every touched package ran `bun run --filter <pkg> tc` and `test` locally.
- [ ] No check was weakened: no deleted or skipped tests, no loosened assertion, no `@ts-ignore`, no disabled lint rule.
- [ ] Changed behavior is covered by a test, or Verification states why it cannot be.
- [ ] No deprecated code left behind: replaced APIs are deleted and every call site migrated here.
- [ ] Nondeterministic I/O stays injected (Clock/Timers/http/createId/random); no bare `Date.now`, `setTimeout`, `fetch`, or `crypto.randomUUID` in product code.
- [ ] Schema changes use `defineTable` + a registered migration; no raw `CREATE TABLE` and no new `.sql` schema files.
- [ ] Domain removals are soft deletes (`deleted_at`); no `DELETE FROM` on domain tables.
- [ ] Client reads/writes go through local SQLite queries and mutations; no new data REST endpoint.
- [ ] Any new secret is registered in `@libs/secrets` and provisioned for dev and prd.
- [ ] Docs updated wherever behavior, conventions, or operations changed.
- [ ] No long-running local process still holds a machine-wide singleton port (EMQX `1883`/`8083`/`18083`, wrangler `8788`).
- [ ] A human merges this PR — agents never merge (`gh pr merge`, auto-merge, merge queue).
