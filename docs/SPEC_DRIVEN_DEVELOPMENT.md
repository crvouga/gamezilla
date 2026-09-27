# Spec-driven development

Product acceptance behavior lives in specs: Gherkin features and Quint
models. A feature file is the product's contract, written in the product's
language: **what people can do and what they observe**, as concrete examples. It never says how the product is built,
so it stays true through any rewrite of the implementation. Everything else
(units, algorithms, wire shapes, storage, performance, framework mechanics)
is a code test under [`docs/TESTING.md`](TESTING.md).

## Skills

Every agent working on specs loads the matching skill. The skills are the
procedure; this document is the policy.

| Skill | Role | Use for |
| --- | --- | --- |
| [`write-specs`](../.agents/skills/write-specs/SKILL.md) | spec writer | discovering and formulating new or changed behavior |
| [`implement-specs`](../.agents/skills/implement-specs/SKILL.md) | implementer | binding scenarios to thin step definitions, and models to bindings, over the sim |
| [`fix-specs`](../.agents/skills/fix-specs/SKILL.md) | step auditor | auditing existing specs and steps, rewriting bad BDD, and demoting non-behavior into code tests |
| [`port-bdd-to-gherkin`](../.agents/skills/port-bdd-to-gherkin/SKILL.md) | porter | moving legacy `@pkgs/sim` tests into features and Quint models with a parity ledger, then deleting them |

## Layout

Specs live in one flat top-level tree:

```text
specs/glossary.yaml                The shared kernel: terms every context may use
specs/<domain>/glossary.yaml       The context's ubiquitous language
specs/<domain>/<feature>.feature   Gherkin: concrete scenarios
specs/<domain>/<model>.qnt         Quint: a feature's state under any sequence of actions
specs/<domain>/events.qnt          Quint: the facts the context publishes to others
```

One directory per domain, no subdirectories, and every scenario tagged with
that directory's `@domain`. The package whose steps run a domain lists it in
its `package.json` `specDomains` (for example `@libs/friends` runs `friends`
and `spaces`) and adds `$TURBO_ROOT$/specs/<domain>/**` to its `test:e2e`
inputs in its `turbo.json`. Step definitions live in that package's
`tests/steps/` and are listed in generated `STEPS_CATALOG.md` files
([index](STEPS_CATALOG.md)); product terms are in each context's
`glossary.yaml`.

## Bounded contexts and ubiquitous language

Specs follow domain-driven design. Every `specs/<domain>/` is a **bounded
context**: one model of one part of the product, with its own **ubiquitous
language**. Every spec in the context — feature text, Quint names, the
feature's story — is written only in that language. Agents and ports cannot
misread a spec whose every word is defined.

| DDD concept | Where it lives |
| --- | --- |
| Bounded context | `specs/<domain>/` |
| Ubiquitous language | `specs/<domain>/glossary.yaml` |
| Shared kernel | `specs/glossary.yaml` (person, device, the app, connection, the team) |
| Aggregate and its invariants | `specs/<domain>/<aggregate>.qnt`: its actions are the commands, its `inv*` vals the invariants |
| Commands and domain events | Gherkin `When` (a command) and `Then` (what happened); past-tense Quint event types |
| Published language | `specs/<domain>/events.qnt`: `module events`, types and values only |
| Context integration | Gherkin in the consuming context, in borrowed terms; its Quint imports only `../<upstream>/events` |

Which context owns which concept, and what crosses each boundary, is the
[context map](CONTEXT_MAP.md).

Keep everything in product terms: "aggregate", "command" and "event" are
modeling ideas here, never classes, repositories or message queues.

### The glossary

```yaml
# specs/spaces/glossary.yaml
context: Spaces
purpose: >-
  Live places people host and join to play together.
terms:
  - term: space
    definition: >-
      A live place one person hosts and others join. It is open until its
      host ends it or leaves.
    avoid: [room, lobby room, session]  # synonyms people reach for
    model: [Place, place]                # the Quint names this term is
  - term: host
    definition: The person whose space it is.
    forms: [hosts, hosting, hosted]      # inflections (plurals are implied)
    model: [host, hostOf]
  - term: Plus member
    from: billing                        # borrowed: billing defines it
    model: [unlimited]                   # this context's own Quint name for it
  - term: checkmate
    source: FIDE Laws of Chess, Article 5.1.1
```

- A term has a `definition`, an outside `source` (chess rules come from the
  FIDE Laws of Chess and are cited, not redefined), or `from: <domain>`, which
  borrows the upstream context's definition and `avoid` and makes the
  dependency visible. A borrowed term's `model` names are this context's own:
  the lender's Quint names never cross the boundary; only its published
  `events.qnt` does.
- Definitions say what the product does, never how it is built: "a draw
  offer lapses when the opponent moves" belongs; "a draw offer is stored
  until the next move event" does not.
- A term enters the glossary in the same `spec:` commit that first uses it.
  The language leads the specs without having to be finished up front.
- The shared kernel stays small: a term belongs there only when every
  context means exactly the same thing by it.

### What the gate enforces

`bun run spec:check` (`libs/tools/scripts/spec-glossary.ts`,
`@pkgs/gherkin/glossary`) fails when:

- a context has no `glossary.yaml`, or a term has no definition, source or
  lender, is defined twice, redefines a kernel term, or borrows a term its
  lender does not define;
- a feature's prose (name, story, rules, scenario names, steps; not example
  tables) uses a synonym a glossary says to `avoid`;
- a feature uses a term another context defines without borrowing it —
  rephrase in this context's language, borrow it, or define this context's
  own meaning;
- a Quint spec declares a product-facing name — a type, a variant, a `var`,
  an `action`, a `val` or a `def` — that is not a `model` name of a term in
  its vocabulary (own, borrowed, kernel) or of an imported `events` module.
  Exempt: `init` and `step`, `inv*` invariants, `SCREAMING_CASE` example
  data and bounds, and model helpers prefixed `_` (checking machinery a
  reader should not take as product vocabulary);
- a Quint spec imports anything but `./events` or `../<domain>/events`, or
  an `events.qnt` declares state or actions;
- a glossary names a `model` no Quint spec in its context declares.

What the gate cannot see — a word used but never defined, or used in a
different sense than its definition — is the spec reviewer's job
(`fix-specs`): read the diff beside the glossary and flag every term used
but not defined. An undefined term becomes a glossary addition the person
approves, so the language grows deliberately rather than by accident.

### Stories and rules

A feature's description is its story, in the context's language. Prefer a
job story, which names the situation rather than a persona: "When a game is
heading for a draw, a player wants to end it by agreement, so both players
can move on." `Rule:` lines may use EARS phrasing ("While a draw offer is
pending, when the opponent moves, the offer lapses").

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
| How a feature's observable state evolves under any sequence of actions | **Quint model** (`specs/<domain>/<model>.qnt`) |
| Stateful internals across sequences: sync, convergence, exactly-once, idempotence, fault recovery | **model-based property test** |
| Storage rows, wire formats, request shapes, which component calls which | **contract or e2e test** asserting through the package's reads |
| One literal case that must never change (a bug's input, a decided value) | **example regression test**, or a `@regression:<id>` scenario when the bug was observable behavior |
| Timing, load, bundle size, budgets | **gate script** |

When one idea has both a behavior and exhaustive cases, keep **one** scenario
for the rule people see ("a hint costs half credit") and put the full
case table or invariant in a property test.

## Two kinds of spec

A **feature** pins examples: this person does this, then sees that. A
**[Quint](https://quint-lang.org/) model** states the rules: what each action
does to the state a person can observe, from any state it is allowed in. It
replaces the product random walks ("monkeys") the suites used to run: Quint
draws the walks from the model, and the product must agree with the model
after every step — not merely avoid crashing.

A model is an aggregate: a module named after its file in snake_case
(`space-hosting.qnt` → `module space_hosting`), every product-facing name
in its context's ubiquitous language, with:

- a header comment in plain product language: who is in it, what they can do,
  what they see;
- state variables a person can observe (a derived observable — what a lobby
  lists — is a variable every action updates through one helper);
- `action init` and `action step`, the step choosing among the model's
  actions, whose arguments are `nondet` values named for the action's
  arguments;
- invariants as `val inv<Name>`, checked while traces are drawn.

Quint reads `x' = a and b` as `(x' = a) and b`: bracket an assignment's
right-hand side. An `init` that can never hold draws empty traces, which the
runner refuses. `next` is a Quint builtin, so an action cannot be called that.

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
- a word outside the context's ubiquitous language (see
  [the glossary rules](#what-the-gate-enforces))
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

- **Spec writer** (`write-specs`). Edits only specs (`.feature` and `.qnt`
  files, and the contexts' `glossary.yaml`), and docs. Never reads implementation, step
  definitions, bindings, or sim code. Describes behavior, not what the code
  happens to do. Asks when the behavior is unclear. A spec commit starts with
  `spec:` and contains no implementation files.
- **Implementer** (`implement-specs`). Treats specs as read-only. Adds or
  reuses thin, typed step definitions over exported sim actions and reads
  until the scenarios pass. For a model they write its binding,
  `tests/quint/<model>.binding.ts`: one entry per model action (`init`
  included) doing that action through exported sim actions, and `observe`,
  which reads the model's state variables back out of the sim without acting.
  When the product disagrees with a model, they find out from the specs and
  goals which of the two is wrong; a wrong product is a bug (fix it with a
  pinned regression, `docs/TESTING.md`), a wrong or ambiguous model goes back
  to the spec writer. Returns missing or ambiguous wording to the spec writer
  instead of changing it, and never weakens a spec to pass.
- **Step auditor** (`fix-specs`). Owns vocabulary and spec quality: undefined,
  ambiguous, unused, UI-mechanical, leaky, and near-duplicate steps; smells;
  unbound models; and scenarios that should be code tests. Rewrites go
  through spec commits; demotions keep every goal proof and regression guard
  intact.

## How a model runs

The package's `test:e2e` turns each model into one bun test file:

1. Quint draws traces from the model (`quint run --mbt` on its bundled
   TypeScript backend — no download, no network). The seed is the property
   seed, `FC_SEED` (default `424242`), so the traces, and so the verdict, are
   a function of the code; `PBT_RANDOM=1` explores other seeds. A model that
   breaks one of its own invariants fails here.
2. Each trace is one test: a fresh sim, then every state's action through the
   binding with the values Quint drew, then the product's state must equal
   the model's (re-read on the sim's virtual clock for up to 15 s, so
   asynchronous convergence gets the time a person would give it). Every
   action is an `s.apply`, so the system's standing properties hold after
   every step too.
3. One more test fails when no trace takes some bound action: a walk that
   never exercised something proved nothing about it.

A failing trace prints the step, the variables that differ (model vs
product), the sim calls the step made, and the whole trace; the drawn traces
are in `<package>/.cache/sim-report/quint/<model>/`.

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

## Reports

Every `test:e2e` run writes its package's report bucket
(`<package>/.cache/sim-report`): each scenario's and each trace's step
timeline — Gherkin steps and Quint trace steps, with the sim calls under them
— the drawn traces, and JUnit. Turbo caches the bucket with the verdict, so
the report of the last run of any version of the code is wherever that run's
cache is. `bun run test:report` renders the current code's: suites whose code
ran before (on any machine sharing the remote cache) restore their bucket,
changed suites run, and every bucket folds into one `sim-report/index.html`.
`--frames` adds UI frames to every step (a slower run with its own cache
entry).

## Workflow

1. **Discover** (`write-specs`): rules, one concrete example per rule, open
   questions answered by a person, not guessed.
2. **Formulate**: read the catalogs and the context's `glossary.yaml`, add
   any new term to it, write the scenarios or
   a model in `specs/<domain>/`, and run `bun run spec:check` (undefined steps
   and unbound models are the handoff; nothing else may fail). A new domain
   needs an implementer to claim it in some package's `specDomains`. Commit
   with a `spec:` subject.
3. **Automate** (`implement-specs`): bind steps or the model's binding, then
   run `bun run spec --package <workspace>` and `bun run spec:catalog`.
4. **Gate**: `bun run spec:ownership` (specs change only in `spec:`
   commits), then `bun check`.

To clean up existing specs, run `fix-specs`: audit, triage, rewrite through
`spec:` commits, demote to code tests, rebind.

Useful commands:

```sh
bun run spec --tags '@goal:social:5'
bun run spec specs/friends/friend-block.feature
bun run spec specs/spaces/space-hosting.qnt
bun run spec --package @libs/friends -t 'ends the friendship'
bun run spec:catalog
bun run spec:check
bun run spec:check --strict-duplicates
bun run spec:ownership
bun run test:report
```

The package e2e runner generates temporary Bun test stubs in `.cache/spec/`.
Those files are never committed. A feature failure identifies the feature
line, matching definition, completed-step ledger, and sim calls made by the
failing step; a model failure, the trace step, the diverging variables, and
the sim calls.
