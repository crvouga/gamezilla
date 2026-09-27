# Spec-driven development

Product acceptance behavior lives in Gherkin in one flat top-level tree:

```text
specs/<domain>/<feature>.feature
```

One directory per domain, no subdirectories, and every scenario tagged with
that directory's `@domain`. The package whose steps run a domain lists it in
its `package.json` `specDomains` (for example `@libs/friends` runs `friends`
and `spaces`) and adds `$TURBO_ROOT$/specs/<domain>/**` to its `test:e2e`
inputs in its `turbo.json`; `bun run spec:check` enforces all of this. Code
tests remain the right home for units, contracts,
properties, model walks, and framework mechanics.

## Live domains: journeys and health

Two domains describe the *deployed* product rather than code under test:

- `specs/journeys/` — the critical journeys. `@libs/runtime` runs them
  against the simulated app in `bun check` (`specDomains`), and
  `@apps/product` runs the same scenarios in a real browser against every
  production environment (`liveDomains`) as synthetic monitoring.
- `specs/health/` — live-resource health checks: DNS, TLS, the Workers,
  Postgres, the bucket, the broker, traces, secrets, billing keys and
  infrastructure drift. Only `@apps/product` runs them (`liveDomains`).

`bun run health` (and `//#deploy`'s last step) is `@apps/product#health`: it
runs every `liveDomains` feature against the environment `SECRETS_ENV` names.
Tags choose where a scenario runs live:

| Tag | Live run |
| --- | --- |
| `@production` | only against production environments (critical journeys, live-mode billing) |
| `@oauth-relay` | only against the relay environment |
| `@observability` | skipped when `OBSERVABILITY_ENABLED=0` |
| `@browser` | needs a real browser; the simulation stops at that step as a host limit |

A domain is run by at most one package through `specDomains` and at most one
through `liveDomains`.

## Roles

The spec writer edits only `.feature` files, generated step catalogs,
`GLOSSARY.md`, and documentation. They describe observable intent and never
read implementation or step-definition source. A spec commit starts with
`spec:` and never contains implementation files.
How to write a spec — strict BDD, behavior only, no implementation details
(no vendors, protocols, storage, internals, UI mechanics or test harness) —
is the [`write-specs`](../.agents/skills/write-specs/SKILL.md) skill. It
applies to the live domains too: a health check states the promise the live
product keeps, never the resource that keeps it.

The implementer treats feature text as read-only. They add or reuse typed step
definitions and sim actions until the scenarios pass. If wording is missing or
ambiguous, they return that gap to the spec writer instead of silently changing
the feature.

The step auditor owns vocabulary quality: undefined, ambiguous, pending,
unused, UI-mechanical, and near-duplicate steps. The generated catalogs are the
public vocabulary for spec authors.

## Workflow

1. Read [`STEPS_CATALOG.md`](STEPS_CATALOG.md) and `GLOSSARY.md`.
2. Write intent-focused scenarios in `specs/<domain>/`, tagged with that
   `@domain:<domain>` and any relevant `@goal:<section>:<number>` tags. A new
   domain needs an implementer to claim it in some package's `specDomains`.
3. Commit the feature-only change with a `spec:` subject.
4. Implement step definitions through exported sim actions and reads.
5. Run `bun run spec:check`, a focused `bun run spec --package <workspace>`,
   and finally `bun check`.

Useful commands:

```sh
bun run spec --tags '@goal:social:5'
bun run spec specs/friends/friend-block.feature
bun run spec --package @libs/friends -t 'ends the friendship'
bun run spec:catalog
bun run spec:check
```

The package e2e runner generates temporary Bun test stubs in `.cache/spec/`.
Those files are never committed. Failures identify the feature line, matching
definition, completed-step ledger, and sim calls made by the failing step.
