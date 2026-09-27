# Spec-driven development

Product acceptance behavior lives in specs, in one flat top-level tree:

```text
specs/<domain>/<feature>.feature   Gherkin: concrete scenarios
specs/<domain>/<model>.qnt         Quint: a feature's state under any sequence of actions
```

One directory per domain, no subdirectories, and every scenario tagged with
that directory's `@domain`. The package whose steps run a domain lists it in
its `package.json` `specDomains` (for example `@libs/friends` runs `friends`
and `spaces`) and adds `$TURBO_ROOT$/specs/<domain>/**` to its `test:e2e`
inputs in its `turbo.json`; `bun run spec:check` enforces all of this. Code
tests remain the right home for units, contracts, properties, and framework
mechanics.

## Two kinds of spec

A **feature** pins examples: this person does this, then sees that. A
**[Quint](https://quint-lang.org/) model** states the rules: what each action
does to the state a person can observe, from any state it is allowed in. It
replaces the product random walks ("monkeys") the suites used to run: Quint
draws the walks from the model, and the product must agree with the model
after every step — not merely avoid crashing.

A model is a module named after its file in snake_case
(`space-hosting.qnt` → `module space_hosting`), with:

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

## Roles

The spec writer edits only specs, generated step catalogs, `GLOSSARY.md`, and
documentation. They describe observable intent and never read implementation,
step-definition or binding source. A spec commit starts with `spec:` and
never contains implementation files.

The implementer treats specs as read-only. For a feature they add or reuse
typed step definitions and sim actions until the scenarios pass. For a model
they write its binding, `tests/quint/<model>.binding.ts`: one entry per model
action (`init` included) doing that action through exported sim actions, and
`observe`, which reads the model's state variables back out of the sim
without acting. When the product disagrees with a model, they find out from
the specs and goals which of the two is wrong; a wrong product is a bug (fix
it with a pinned regression, `docs/TESTING.md`), a wrong or ambiguous model
goes back to the spec writer. They never weaken a spec to pass.

The step auditor owns vocabulary quality: undefined, ambiguous, pending,
unused, UI-mechanical, and near-duplicate steps, and unbound models. The
generated catalogs are the public vocabulary for spec authors.

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

1. Read [`STEPS_CATALOG.md`](STEPS_CATALOG.md) and `GLOSSARY.md`.
2. Write intent-focused scenarios or a model in `specs/<domain>/`, scenarios
   tagged with that `@domain:<domain>` and any relevant `@goal:<section>:<number>`
   tags. A new domain needs an implementer to claim it in some package's
   `specDomains`.
3. Commit the spec-only change with a `spec:` subject.
4. Implement step definitions or the model's binding through exported sim
   actions and reads.
5. Run `bun run spec:check`, a focused `bun run spec --package <workspace>`,
   and finally `bun check`.

Useful commands:

```sh
bun run spec --tags '@goal:social:5'
bun run spec specs/friends/friend-block.feature
bun run spec specs/spaces/space-hosting.qnt
bun run spec --package @libs/friends -t 'ends the friendship'
bun run spec:catalog
bun run spec:check
bun run test:report
```

The package e2e runner generates temporary Bun test stubs in `.cache/spec/`.
Those files are never committed. A feature failure identifies the feature
line, matching definition, completed-step ledger, and sim calls made by the
failing step; a model failure, the trace step, the diverging variables, and
the sim calls.
