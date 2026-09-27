# Spec-driven development

Product acceptance behavior lives in Gherkin. A feature file is the product's
contract, written in the product's language: **what people can do and what
they observe**, as concrete examples. It never says how the product is built,
so it stays true through any rewrite of the implementation. Everything else
(units, algorithms, wire shapes, storage, performance, framework mechanics)
is a code test under [`docs/TESTING.md`](TESTING.md).

## Skills

Every agent working on specs loads the matching skill. The skills are the
procedure; this document is the policy.

| Skill | Role | Use for |
| --- | --- | --- |
| [`write-specs`](../.agents/skills/write-specs/SKILL.md) | spec writer | discovering and formulating new or changed behavior |
| [`implement-specs`](../.agents/skills/implement-specs/SKILL.md) | implementer | binding scenarios to thin step definitions over the sim |
| [`fix-specs`](../.agents/skills/fix-specs/SKILL.md) | step auditor | auditing existing specs and steps, rewriting bad BDD, and demoting non-behavior into code tests |

## Layout

```text
specs/<domain>/<feature>.feature
```

One directory per domain, no subdirectories, and every scenario tagged with
that directory's `@domain`. The package whose steps run a domain lists it in
its `package.json` `specDomains` (for example `@libs/friends` runs `friends`
and `spaces`) and adds `$TURBO_ROOT$/specs/<domain>/**` to its `test:e2e`
inputs in its `turbo.json`. Step definitions live in that package's
`tests/steps/` and are listed in generated `STEPS_CATALOG.md` files
([index](STEPS_CATALOG.md)); product terms are in
[`GLOSSARY.md`](../GLOSSARY.md).

## What belongs in a spec

A scenario earns its place when **a person, or the team running the product,
could observe the outcome from outside**, and the example is one the product
owner would recognize as a rule of the product.

| The check is about… | Home |
| --- | --- |
| What a person can do and see: flows, rules, permissions, what persists, offline behavior, what other people see and when | **Gherkin scenario** |
| A promise the team observes about a live environment (reachable, secure, payments real only in production, unchanged by hand) | **Gherkin in `specs/health/`** |
| A flow that must never break anywhere people use the app | **Gherkin in `specs/journeys/`** |
| A pure computation: formula, parser, validation table, ordering, math | **property test** (`assertProperty`) |
| Stateful correctness across sequences: sync, convergence, exactly-once, idempotence, fault recovery | **model-based or sim/monkey property** |
| Storage rows, wire formats, request shapes, which component calls which | **contract or e2e test** asserting through the package's reads |
| One literal case that must never change (a bug's input, a decided value) | **example regression test**, or a `@regression:<id>` scenario when the bug was observable behavior |
| Timing, load, bundle size, budgets | **gate script** |

When one idea has both a behavior and exhaustive cases, keep **one** scenario
for the rule people see ("a hint costs half credit") and put the full
case table or invariant in a property test.

## Rules for a feature file

The gate (`bun run spec:check`) fails on:

- undefined, ambiguous, pending, or unused steps; a duplicate scenario name
- a missing or foreign `@domain`, an unknown `@goal`, or a goal proven by a
  feature where no scenario is tagged with it
- UI mechanics in step text (tap, click, button, dialog, …)
- implementation words in step text (API, database, Postgres, token, DNS,
  TLS, Worker, OAuth, callback, cache, …: `IMPLEMENTATION_WORDS` in
  `@pkgs/gherkin`)
- a narrator ("I", "my", "the user") instead of a named person or role
- a scenario with no `Then`, or a `Given` after the scenario has acted
- stale step catalogs
- a BDD smell (`@pkgs/gherkin/smells`):
  - a scenario with more than 8 steps, or more than 3 `When`s
  - a scenario that acts again after a `Then`, outside `specs/journeys/`
  - a step naming architecture ("server", "client", "backend", "sim")
  - a feature with no description

It warns on near-duplicate step wording (`--strict-duplicates` fails on it).
The smell thresholds are judgment calls made strict so the specs stay clean;
if one blocks a scenario that really is one rule, restate earlier steps as
`Given` facts before reaching for a longer scenario.

Style the gate can't check (the skills cover it): declarative intent rather than
procedure, one rule per scenario, `Given` as facts rather than actions,
essential and concrete data, glossary terms, feature descriptions that say
why the capability matters.

## Roles

- **Spec writer** (`write-specs`). Edits only `.feature` files,
  `GLOSSARY.md`, and docs. Never reads implementation, step definitions, or
  sim code. Describes behavior, not what the code happens to do. Asks when
  the behavior is unclear. A spec commit starts with `spec:` and contains no
  implementation files.
- **Implementer** (`implement-specs`). Treats feature text as read-only. Adds
  or reuses thin, typed step definitions over exported sim actions and reads
  until the scenarios pass. Returns missing or ambiguous wording to the spec
  writer instead of changing it.
- **Step auditor** (`fix-specs`). Owns vocabulary and spec quality: undefined,
  ambiguous, unused, UI-mechanical, leaky, and near-duplicate steps; smells;
  and scenarios that should be code tests. Rewrites go through spec commits;
  demotions keep every goal proof and regression guard intact.

## Live domains: journeys and health

Two domains describe the *deployed* product rather than code under test:

- `specs/journeys/`: the critical journeys. `@libs/runtime` runs them
  against the simulated app in `bun check` (`specDomains`), and
  `@apps/product` runs the same scenarios in a real browser against every
  production environment (`liveDomains`) as synthetic monitoring.
- `specs/health/`: the promises a live environment keeps, stated as what
  people or the team observe (people reach the app securely, live updates
  reach people, payments are real only in production). Which resource
  keeps each promise is the step definitions' business. Only `@apps/product`
  runs them (`liveDomains`).

`bun run health` (and `//#deploy`'s last step) is `@apps/product#health`: it
runs every `liveDomains` feature against the environment `SECRETS_ENV` names.
Tags choose where a scenario runs live. They select a run; they don't describe
behavior:

| Tag | Live run |
| --- | --- |
| `@production` | only against production environments (critical journeys, live-mode billing) |
| `@oauth-relay` | only against the relay environment |
| `@observability` | skipped when `OBSERVABILITY_ENABLED=0` |
| `@browser` | needs a real browser; the simulation stops at that step as a host limit |

A domain is run by at most one package through `specDomains` and at most one
through `liveDomains`.

## Goals and regressions

- `@goal:<section>:<n>` tags a scenario that proves a [`GOAL.md`](GOAL.md)
  statement; `libs/tools/goal/goal-checks.json` lists the feature as a
  `spec` proof. Moving that proof to a code test updates the manifest to a
  `test` proof in the same change.
- `@regression:<bug-id>` pins a bug that was observable behavior, with its
  `libs/tools/goal/known-bugs.json` entry pointing at the feature. A bug in
  internals is guarded by an example test marked `// regression: <bug-id>`
  instead.

## Workflow

1. **Discover** (`write-specs`): rules, one concrete example per rule, open
   questions answered by a person, not guessed.
2. **Formulate**: read the catalogs and `GLOSSARY.md`, write the scenarios,
   and run `bun run spec:check` (undefined steps are the handoff; nothing
   else may fail). Commit with a `spec:` subject.
3. **Automate** (`implement-specs`): bind steps, then run `bun run spec
   --package <workspace>` and `bun run spec:catalog`.
4. **Gate**: `bun run spec:ownership` (feature files change only in
   `spec:` commits), then `bun check`.

To clean up existing specs, run `fix-specs`: audit, triage, rewrite through
`spec:` commits, demote to code tests, rebind.

Useful commands:

```sh
bun run spec --tags '@goal:social:5'
bun run spec specs/friends/friend-block.feature
bun run spec --package @libs/friends -t 'ends the friendship'
bun run spec:catalog
bun run spec:check
bun run spec:check --strict-duplicates
bun run spec:ownership
```

The package e2e runner generates temporary Bun test stubs in `.cache/spec/`.
Those files are never committed. Failures identify the feature line, matching
definition, completed-step ledger, and sim calls made by the failing step.
