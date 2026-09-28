# Testing

> **We never test manually. Ever.** Every behavior is verified by an automated
> check inside `bun check`, and a green `bun check` means the app is ready to
> release. Nothing else is required, and nothing else counts.

This is the policy behind [`GOAL.md`](GOAL.md) § "The bar". The mechanics of the
gate (turbo caching, budgets, CI layout) live in [`AGENTS.md`](../AGENTS.md)
§ "CI / Turbo cache"; this file says what a test is and what it is not.

## 1. No manual testing

Nobody verifies anything by hand: not before a merge, not before a release, not
"just to be sure", not once.

- There is no QA pass, no click-through, no staging soak, no dogfooding gate,
  no "tested locally" in a PR. A PR's Verification section names automated
  checks only.
- If you catch yourself wanting to look at the app to know whether a change
  works, a check is missing. Write it; that is the work.
- `bun run dev`, `bun run stack` and the Harness exist to *build* features
  and to debug a failing check. They are never evidence that something works.
- A bug found any way at all (a user, a property, an agent reading code) is
  fixed only together with an automated regression test that fails without
  the fix (§ 3).
- Behavior that no automated check can reach is a design problem. Change the
  product until it can be checked: inject the I/O, split the subsystem, add a
  port with a contract suite. Simplify the product to make it checkable; never
  weaken the check to fit the product.

## 2. `bun check` is the release decision

`bun check` is the one command. It runs every package's `tc`, `lint`, `test`,
`test:contract` and `test:e2e`, plus the root leaves, and the Check and Deploy
workflows run exactly that set. Its verdict must be:

- **Complete** — every test the repo owns runs. No skips, no `.only`, no
  `.todo`, no conditional `.if`, no expected-failure `.failing`, no test file
  that no gate script reaches, no `--pass-with-no-tests`.
- **Deterministic** — the verdict is a function of the code alone, so turbo can
  cache it. Time, randomness, ids and network are injected
  ([`DETERMINISM.md`](DETERMINISM.md)); properties run on a pinned seed and run
  count on every machine; nothing retries.
- **Sufficient** — if a way the release could break is not covered, `bun check`
  is lying. Add the check to the package it is about. It type-checks every
  TypeScript file, bundles each Worker exactly as deploy ships it
  (`check:worker-bundle`), and proves from the built `dist/` that every file
  the wall client can load is precached for offline use
  (`@apps/product#check:offline-shell`).
- **Fast** — see § 5.

## 3. Two kinds of test

Every test is one of these. There is no third kind.

### Exploratory: property-based and model-based

This is how we find out whether code is correct. It is the default for all new
behavior.

| Shape | Use for | Tool |
| --- | --- | --- |
| **Property** | Pure functions and algebra: round-trips, idempotence, invariants, metamorphic relations, agreement with a simple oracle. | `assertProperty` from `@pkgs/property` |
| **Model-based** | Anything with state: a reference model runs beside the real thing under generated command sequences, and they must agree after every step. | `fc.commands` + `fc.modelRun` inside `assertProperty`; `defineSystem` / `system.explore` in `@pkgs/harness` |
| **Product model (Quint)** | A product feature end to end: a [Quint](https://quint-lang.org/) model in `specs/<domain>/*.qnt` states what each user action and fault does to what people see; Quint draws the walks and the product harness must agree with the model after every step, every standing property holding too. | `@pkgs/quint`, a binding per model in the package's `tests/quint/` ([`SPEC_DRIVEN_DEVELOPMENT.md`](SPEC_DRIVEN_DEVELOPMENT.md)) |

Rules:

- **`assertProperty` is the only entry point.** It pins the seed (`FC_SEED`,
  default `424242`) and the run count (`PBT_NUM_RUNS`, default `40`)
  identically on every machine. Raw `fc.assert` / `fc.check` / `fc.sample` /
  `fc.statistics` are banned (`no-unpinned-property.grit`): unseeded, they
  make a cached verdict depend on the run instead of the code. Build dependent
  inputs with `.chain` / `.map`, never by sampling inside a property.
- Name a property-only file `<topic>.property.test.ts`.
- State what must hold, not what one run did. A property that restates the
  implementation proves nothing — compare against a model, an inverse, or a
  relation between two runs.
- Quint models follow the same seed policy: traces are drawn from `FC_SEED`,
  so a model's verdict is cached like a property's. There are no product
  random walks outside a model — the model is what makes a walk's verdict
  mean more than "nothing crashed".
- Same seed twice is a model check, not a hand-written test: a binding that
  gives a `fingerprint` (a hash of the world's whole end state) has its
  longest trace replayed twice, in fresh worlds, and the two fingerprints
  must agree. The room, matchmaking, index-tuning and sync bindings give one.
- Hunt beyond the pinned seed with `bun run test:pbt:random` (`PBT_RANDOM=1`).
  That is exploration, not the gate: whatever it finds is pinned as a
  regression test before it is fixed.

### Regression: example-based

An example test pins one concrete case that must never change. There are two
sources:

1. **A bug that happened.** Once a property, model or anything else finds a
   bug, the shrunk counterexample becomes an example test marked
   `// regression: <bug-id>` (or, for an acceptance scenario, a scenario
   tagged `@regression:<bug-id>` in the owning `.feature`) and an entry in
   [`libs/tools/goal/known-bugs.json`](../libs/tools/goal/known-bugs.json)
   (`regressionTest` → that file). The goal gate fails if the file or the
   marker is missing, or if the guard is a `*.property.test.ts` — a pinned
   seed that reaches the bug today may not after a generator changes, so the
   guard is always the literal input.
2. **A decided value.** A number or wire shape the product committed to: a
   [`GOAL.md`](GOAL.md) decision (20 guest puzzles a day, 7-day grace), a
   vendor's wire format, a migration's output.

Everything else an example test could say, a property says better. When a
property subsumes an example that is neither, delete the example.

## 4. Where tests live and how the gate finds them

- Package tests live in `<pkg>/tests/` and import only the package's
  `exports` ([`AGENTS.md`](../AGENTS.md) § "Test layout"). `bun test` is the
  only runner.
- E2e harness composition lives with the feature it exercises
  (`libs/<feature>/tests/e2e/support/`) and composes only the slices it
  needs, so an unrelated change leaves it cached.
  No e2e lives in `apps/`; the full-composition suite in `@libs/runtime` stays
  small on purpose.
- A package's test scripts obey `libs/tools/scripts/test-scripts.ts`, run in
  its `lint`: every tracked test file is reached by a gate script (`test`,
  `test:contract`, `test:e2e`, or deploy's `test:integration`), no script runs
  zero files, and none uses `--pass-with-no-tests`, `--rerun-each` or
  `--retry`. A package with no tests has no `test` script.
- Contract suites (`test:contract`) run each port's shared suite against the
  real engine (Postgres, S3, EMQX) — the sidecars boot themselves; nothing
  skips when a service is absent.
- **Behavior tests are specs.** A test that acts as a person would and checks
  what they see — every e2e and every BDD-shaped test — is a scenario or a
  Quint model in `specs/<domain>/`
  ([`SPEC_DRIVEN_DEVELOPMENT.md`](SPEC_DRIVEN_DEVELOPMENT.md)), bound through
  the package's harness. No `*.test.ts` lives under `tests/e2e/`; that
  directory holds only the harness composition (`support/`).

### One example app per package

A framework package (`@pkgs/sync-engine`, `@pkgs/room`, `@pkgs/matchmaking`,
…) is tested through **one** example app: a single kitchen-sink app that uses
every capability the package offers, in `src/harness/example-app/` (or
`tests/example-app/` for a package with no harness). Never a counter app, a
notes app and a clock app side by side: every test, property, model and spec
of the package drives the same app, so a new capability grows that app
instead of adding another. A test that needs a variation (another schema
version, a hostile peer) configures the example app; it does not fork it.
The package's spec context describes that app's behavior in business words,
never the package's mechanics.

## 5. Fast

Tests run constantly, so a slow test is a defect.

- Everything runs in process: virtual time (never real sleeps), in-memory SQL
  fabrics, happy-dom for UI. A test waits on the virtual clock or on the real
  condition, never the wall (`no-wall-time-in-tests.grit`); only
  `*.contract.test.ts`, which drives a real engine, may touch it.
- Measure cost by counting work, not by timing it: a wall-clock budget makes
  the verdict depend on machine load (see
  `pkgs/permissions/tests/evaluate-cost.property.test.ts`).
- Bun's default 5 s per-test timeout is itself a wall clock. A property or
  model test that boots a system across many runs sets an explicit timeout
  (several times its idle cost) beside a comment giving that cost, so a loaded
  runner cannot flip its verdict; the per-task budget still bounds a hang.
- Keep a unit or property file well under a second. Prefer fewer, sharper
  properties over high run counts; raise `numRuns` only for a property whose
  input space needs it, and say why beside it.
- Split subsystems so each e2e suite composes little and caches independently.
  A change should rerun the tests of what it touched and nothing else.
- Every task has an enforced budget (`libs/tools/scripts/check-budget.ts`), and
  every run prints the ten slowest tasks. Make the task faster before raising
  its number.

## Enforcement

| Rule | Gate |
| --- | --- |
| No skipped, focused, todo, conditional or expected-failure tests | `libs/tools/biome-plugins/no-skipped-tests.grit` (`lint`) |
| Properties run only on the pinned seed | `libs/tools/biome-plugins/no-unpinned-property.grit` (`lint`) |
| Tests never touch wall time, real timers or unseeded randomness | `libs/tools/biome-plugins/no-wall-time-in-tests.grit` (`lint`) |
| Every test file runs; no silent-pass or retry flags | `libs/tools/scripts/test-scripts.ts` (`lint`) |
| Every TypeScript file (tests and scripts too) is type-checked | `libs/tools/scripts/tc-scope.ts` (`lint`) |
| Every known bug has an example regression test | `libs/tools/goal/goal-manifest.ts` (`//#ci:goals` + `lint`) |
| Every `GOAL.md` statement is proven by a check | `libs/tools/scripts/check-goals.ts` (`//#ci:goals`) |
| Each Worker bundles for production under the upload limit | `libs/tools/scripts/check-worker-bundle.ts` (`check:worker-bundle`) |
| Every wall-client file is precached, under budget | `apps/product/scripts/check-offline-shell.ts` (`check:offline-shell`) |
| No verdict branches on `CI` | `libs/tools/biome-plugins/no-ci-verdict.grit` (`lint`) |
| No bare nondeterministic I/O | `libs/tools/biome-plugins/no-bare-io.grit` and friends (`lint`) |
| Budgets per task and per run | `libs/tools/scripts/check-budget.ts` (`turbo-ci-run`) |
