<!--
Strict PR contract — enforced by `//#ci:pr-template` on every PR (see
`libs/tools/scripts/check-pr-body.ts`). Every `##` section below must keep its
heading and carry real content; the HTML comments are guidance and do not count
as content. Every checklist box must be checked before a human merges. Deleting
a section, a checklist line, or leaving a box unchecked fails CI.
-->

## Summary

<!-- 1–3 bullets: what changed, for a reviewer who knows this codebase. -->

## Why

<!-- The problem, its user-visible impact, and the linked issue (`Closes #N`) if any. -->

## Scope

<!--
Packages touched (`apps/*`, `libs/*`, `pkgs/*`) and, explicitly, what
is out of scope / deferred. Note any cross-package contract that moved.
-->

## Verification

<!--
Exact commands run and what was observed, e.g.
`bun run --filter @pkgs/sync-engine tc` → clean,
`bun run --filter @apps/client test` → 15 passed.
Name the surface actually exercised (sim scenario, browser tab, real device,
throwaway script) and — required — what this PR does NOT prove.
-->

## Risk

<!--
Risk level (low | medium | high), blast radius if it breaks, and the rollback
(revert, feature flag, migration reversal). Call out any deploy ordering, such
as migrate-before-deploy, and anything the deploy pipeline must do first.
-->

## Provenance

<!--
Who produced this and how much to trust it:
`Produced by:` human | `/pr-ready` agent (state the model when an agent).
`Open questions:` anything a human should decide before merging.
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
- [ ] No long-running local process still holds a machine-wide singleton port (EMQX `1883`/`8083`/`18083`, e2e `4177`/`4178`, wrangler `8788`).
- [ ] A human merges this PR — agents never merge (`gh pr merge`, auto-merge, merge queue).
