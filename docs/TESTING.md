# Testing

> **We never test manually. Ever.** Every behavior is verified by an automated
> check inside `bun check`, and a green `bun check` means the app is ready to
> release.

Behavior tests are specs ([`specs/README.md`](../specs/README.md)); the
gate's mechanics (caching, budgets, workflows) are [`CI.md`](CI.md).

## 1. No manual testing

- No QA pass, click-through, staging soak or "tested locally". A PR's
  Verification section names automated checks only.
- `bun run dev`, `bun run stack` and the Harness are for building and
  debugging, never evidence. Wanting to look at the app means a check is
  missing: write it.
- A bug found any way at all is fixed only with an automated regression test
  that fails without the fix (§ 3).
- Behavior no check can reach is a design problem: inject the I/O, split the
  subsystem, add a port with a contract suite. Never weaken the check to fit
  the product.

## 2. `bun check` is the release decision

It runs every package's `tc`, `lint`, `test`, `test:contract` and
`test:spec` (in parts, `test:spec:<k>`), plus the root leaves; the Check and Deploy workflows run the
same set. Its verdict must be:

- **Complete** — no skips, `.only`, `.todo`, `.if`, `.failing`, no test file
  no gate script reaches, no `--pass-with-no-tests`.
- **Deterministic** — a function of the code alone, so turbo can cache it.
  Time, randomness, ids and network are injected
  ([`DETERMINISM.md`](DETERMINISM.md)); properties run on a pinned seed and
  run count everywhere; nothing retries.
- **Sufficient** — a way the release could break that no check covers makes
  `bun check` a liar. Add the check to the package it is about.
- **Fast** — § 5.

## 3. Two kinds of test

### Exploratory: property-based and model-based

The default for all new behavior.

| Shape | Use for | Tool |
| --- | --- | --- |
| **Property** | Pure functions: round-trips, idempotence, invariants, metamorphic relations, agreement with an oracle | `assertProperty` from `@pkgs/property` |
| **Model-based** | Stateful code: a reference model runs beside the real thing under generated commands and must agree after every step | `fc.commands` + `fc.modelRun` inside `assertProperty`; `defineSystem` / `system.explore` in `@pkgs/harness` |
| **Product model** | A product feature end to end | a Quint model in `specs/<domain>/` ([`specs/README.md`](../specs/README.md#quint-models)) |

- **`assertProperty` is the only entry point.** It pins the seed (`FC_SEED`,
  default `424242`) and run count (`PBT_NUM_RUNS`, default `40`). Raw
  `fc.assert` / `fc.check` / `fc.sample` / `fc.statistics` are banned. Build
  dependent inputs with `.chain` / `.map`, never by sampling inside a
  property.
- Name a property-only file `<topic>.property.test.ts`.
- State what must hold — against a model, an inverse, or a relation between
  runs — not what one run did.
- A binding that gives a `fingerprint` (a hash of the world's end state) has
  its longest trace replayed twice in fresh worlds; the fingerprints must
  agree.
- Hunt beyond the pinned seed with `bun run test:pbt:random`. Whatever it
  finds is pinned as a regression test before it is fixed.

### Regression: example-based

An example test pins one concrete case that must never change:

1. **A bug that happened.** The shrunk counterexample becomes an example test
   marked `// regression: <bug-id>` (or a `@regression:<bug-id>` scenario
   when the bug was observable) plus an entry in
   [`libs/tools/goal/known-bugs.json`](../libs/tools/goal/known-bugs.json).
   The guard is never a `*.property.test.ts`: a seed that reaches the bug
   today may not after a generator changes.
2. **A decided value.** A number or wire shape the product committed to (a
   spec, a vendor's wire format, a migration's output).

When a property subsumes an example that is neither, delete the example.

## 4. Where tests live

- Package tests live in `<pkg>/tests/` and import only the package's
  `exports`. `bun test` is the only runner.
- **Behavior tests are specs.** No `*.test.ts` lives under `tests/harness/`;
  that directory holds only the feature's harness composition, which composes
  only the slices it needs ([`FEATURE_SUBSYSTEMS.md`](FEATURE_SUBSYSTEMS.md)).
  No spec lives in `apps/`. A random walk (`.explore(`, `randomActions(`)
  runs only as a Quint model binding in `tests/quint/` (`spec:check`).
- Every tracked test file is reached by a gate script (`test`,
  `test:contract`, `test:spec`, or deploy's `test:integration`); no script
  runs zero files or uses `--pass-with-no-tests`, `--rerun-each` or
  `--retry`. A package with no tests has no `test` script.
- `test:contract` runs each port's shared suite against the real engine
  (Postgres, S3, EMQX); the sidecars boot themselves and nothing skips.

### One example app per package

A framework package (`@pkgs/sync-engine`, `@pkgs/room`, `@pkgs/matchmaking`,
…) is tested through **one** kitchen-sink example app that uses every
capability it offers, in `src/harness/example-app/` (or `tests/example-app/`
without a harness). Every test, property, model and spec of the package
drives it; a new capability grows it, and a variation configures it rather
than forking it. The package's spec context describes that app in business
words, never the package's mechanics.

## 5. Fast

- Everything runs in process: virtual time, in-memory SQL fabrics, happy-dom.
  Tests wait on the virtual clock or the real condition, never the wall; only
  `*.contract.test.ts` may touch it.
- Measure cost by counting work, not timing it (see
  `pkgs/permissions/tests/evaluate-cost.property.test.ts`).
- A property or model test that boots a system across many runs sets an
  explicit timeout (several times its idle cost) beside a comment giving that
  cost, since Bun's 5 s default is a wall clock.
- Keep a unit or property file well under a second. Raise `numRuns` only
  where the input space needs it, and say why.
- Split subsystems so a change reruns only the tests of what it touched.
  Every task has an enforced budget; make it faster before raising it.

## Enforcement

| Rule | Gate |
| --- | --- |
| No test under `tests/harness/`; one `example-app` per package | `libs/tools/scripts/behavior-tests.ts` (`lint`) |
| No skipped, focused, todo, conditional or expected-failure tests | `no-skipped-tests.grit` (`lint`) |
| Properties run only on the pinned seed | `no-unpinned-property.grit` (`lint`) |
| Tests never touch wall time, real timers or unseeded randomness | `no-wall-time-in-tests.grit` (`lint`) |
| Every test file runs; no silent-pass or retry flags | `libs/tools/scripts/test-scripts.ts` (`lint`) |
| Every TypeScript file is type-checked | `libs/tools/scripts/tc-scope.ts` (`lint`) |
| Every known bug has an example regression test | `libs/tools/goal/goal-manifest.ts` (`//#ci:goals` + `lint`) |
| Each Worker bundles under the upload limit | `libs/tools/scripts/check-worker-bundle.ts` (`check:worker-bundle`) |
| Every wall-client file is precached, under budget | `apps/product/scripts/check-offline-shell.ts` (`check:offline-shell`) |
| No verdict branches on `CI` | `no-ci-verdict.grit` (`lint`) |
| No bare nondeterministic I/O | `no-bare-io.grit` and friends (`lint`) |
| Budgets per task and per run | `libs/tools/scripts/check-budget.ts` (`turbo-ci-run`) |
