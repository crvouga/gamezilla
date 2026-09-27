---
name: port-bdd-to-gherkin
description: Port legacy behavior tests written directly against the bespoke `@pkgs/sim` API (`system.run` + `s.apply` / `s.read` / `s.until`, `test.each` seed sweeps, `randomActions` / `explore` monkeys) into Gherkin features and Quint models, following BDD practice. Use when asked to port, migrate, or rewrite sim / e2e / behavior tests to Gherkin, `.feature` files, Quint, specs, or BDD, for one test file, a package (`@pkgs/sync-engine`, `@pkgs/room-sim`, `@pkgs/matchmaking-sim`, `@apps/product`), or the whole repo.
---

# Port legacy sim tests to Gherkin + Quint

Legacy behavior tests call the sim algebra straight from `bun:test`:

```ts
await using s = await exampleSystem.run({ seed: 3, args: { clientCount: 0 } });
await s.apply(addClient, 'alice');
await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'shared' });
await expectInSync(s);
expect(await s.read(liveNote, 'bob', 'n1')).toMatchObject({ body: 'shared' });
```

The port rewrites them as specs:

- **Gherkin `.feature`**: concrete examples, one business rule per
  scenario, written in the domain's own words.
- **Quint `.qnt` model**: the rules for *any* sequence of actions. It
  replaces seed sweeps, `randomActions`, `explore`, and product "monkeys".
  Quint draws the walks, and the product has to match the model after every
  step.

Both run on the same `@pkgs/sim` systems through thin step definitions and
model bindings. The sim stays the engine. Only the test's surface moves to
specs.

Read these before writing anything:
- [`references/gherkin-style.md`](references/gherkin-style.md): the BDD rules
  every feature has to follow, with before/after examples from this repo.
- [`references/quint-style.md`](references/quint-style.md): model shape,
  bindings, and when to reach for a model.
- [`references/bootstrap.md`](references/bootstrap.md): only if the runner
  infrastructure is missing (step 0).

## 0. Check the infrastructure

```sh
ls pkgs/gherkin pkgs/quint 2>/dev/null; grep -n '"spec' package.json
```

If `@pkgs/gherkin` and `@pkgs/quint` exist, use them as they are and follow
their READMEs. If they don't, **stop and confirm with the user** before you
bootstrap. Bootstrapping is a cross-cutting change (new packages, catalog
deps, turbo inputs). The plan is in `references/bootstrap.md`: bring over the
product-agnostic packages from `backup/quint-test-caching-merged`. Do not
build a third runner, and never use cucumber-js (the sim preloads need
`bun test`).

## 1. Inventory the legacy tests

```sh
git ls-files | grep -E '\.test\.tsx?$' \
  | xargs grep -lE 's\.apply\(|await using .* = await .*\.run\(|\.explore\(|randomActions'
```

Sort every legacy `test(...)` into exactly one bucket:

| Legacy shape | Destination |
| --- | --- |
| Scripted `s.apply` / `s.read` / `s.until` example of one behavior | Gherkin scenario |
| One `test` that walks through several phases (act → assert → act → assert) | Several scenarios. Earlier phases become past-tense `Given` state |
| `test.each([seeds])` / seed loops making the same claim | **Not** a Scenario Outline. If the claim is "for any interleaving", it goes in a Quint model. Otherwise write one scenario and let the world's seed (`FC_SEED`) be the seed |
| `randomActions`, `system.explore`, `product-explore`, fuzz, "monkey" | Quint model + binding |
| `defineProperty` standing invariants on the system | Keep them on `defineSystem`, because they run under every scenario and trace. Mirror them as `val inv<Name>` when they are observable |
| Determinism / replay / recording / report mechanics, `@pkgs/sim` self-tests, `sim-report`, `sql-client-sim`, `db-indexes` | **Stay code tests.** These are framework contracts, not product behavior |
| Unit, contract, or property tests that never open a sim | Out of scope. Leave them |
| Pinned regression for a past bug | A scenario named for the behavior (not the bug id) |

Write a **parity ledger** (scratchpad, and later the PR body) with one row per
legacy test: `legacy file › test name` → `claim in one sentence` →
`destination (feature › scenario | model › invariant/action | stays)`. Each
legacy claim must land somewhere or get an explicit reason for dropping it.
Nothing disappears silently.

## 2. Decide where the specs live

| Suite | Specs | Steps / bindings |
| --- | --- | --- |
| Product behavior (`apps/product/tests/**`) | `specs/<domain>/<feature>.feature`, `specs/<domain>/<model>.qnt`: flat tree, one dir per domain, every scenario tagged `@domain:<domain>` | The owning package's `tests/steps/*.steps.ts`, `tests/quint/<model>.binding.ts`. That package lists the domain in `package.json` `specDomains` |
| Framework `@pkgs/*` sims (`sync-engine`, `room-sim`, `matchmaking-sim`, …) | `pkgs/<pkg>/tests/features/*.feature`, `pkgs/<pkg>/tests/quint/*.qnt` (pkgs stay app-agnostic and self-contained) | `pkgs/<pkg>/tests/steps/`, `pkgs/<pkg>/tests/quint/` |

Tests stay black-box against package `exports` (AGENTS.md test layout). Steps
import sim actions and reads from `@pkgs/<pkg>/sim` or the product sim
entry, never deep `src/` paths.

## 3. Write the specs first (spec-only commit)

Work from the parity ledger's **claims**, not from the legacy code. Porting
the code line by line reproduces the imperative UI script BDD is meant to
remove. Before you write:

1. Read the step catalogs (`STEPS_CATALOG.md` / `bun run spec:catalog` if
   present) and `GLOSSARY.md`. Reuse existing wording before you invent any.
2. Write the features according to `references/gherkin-style.md`. Write any
   models according to `references/quint-style.md`.
3. `quint typecheck <model>.qnt` for every model. Run the spec lint
   (`bun run spec:check` if present).
4. Commit only specs, catalogs, and the glossary, with a `spec:` subject.

When fanning out, run the spec writer and the implementer as **separate
agents**. The spec writer gets the ledger claims and the catalogs, but no
step, binding, or sim source. The implementer treats specs as read-only.

## 4. Implement steps and bindings

- A step is **one sim call or a short fixed sequence** of exported sim
  actions and reads: `w.s.apply(action, …)`, `w.s.read(read, …)`,
  `w.s.until(pred)`. UI mechanics (tap, handle, route) belong inside sim
  actions in `src/sim/`, never in step text.
- If you need a stimulus or read that doesn't exist yet, add a
  `defineAction` or a plain read function in the package's `src/sim/` and
  export it through `./sim`. Package-local World openers or step DSLs that
  wrap `defineSystem` are banned (AGENTS.md).
- The world opens the existing system (`exampleSystem.run`, `openSim`, …)
  with the seed from `FC_SEED` and reports on. Waits use `s.until` /
  `s.never` / `s.advanceTime` on virtual time, never wall timers.
- `biome` `useMaxParams` (max 4) is load-bearing. A step body gets the world
  plus at most 3 expression args. For more, use a data table or a custom
  parameter type. No `biome-ignore`.
- Quint binding: one entry per model action (`init` included), each done
  through `s.apply`, plus `observe`, which reads the model's variables back
  without acting.
- If product and spec disagree, work out from the specs and product intent
  which one is wrong. A product bug gets fixed and pinned. A wrong spec goes
  back to the spec writer. **Never weaken a spec or model to get green.**

## 5. Prove parity, then delete the legacy tests

1. Run the new suite for the package (`bun run spec --package <ws>` /
   `test:e2e`, or the package's features entry) until it passes.
2. **Sabotage check**, at least once per feature and model: temporarily break
   the behavior the scenario claims (skip the upload retry, drop the tombstone
   merge, …). Confirm the new scenario or trace fails with a readable
   message, then revert. If a scenario still passes with the behavior broken,
   it proves nothing, so fix the step.
3. Delete the ported legacy `*.test.ts(x)` files **in the same change**.
   Dual-running, `.skip`, or "kept for migration" copies are not allowed
   (AGENTS.md, no deprecated code). Update the package's `test*` scripts, the
   `turbo.json` inputs (`$TURBO_ROOT$/specs/<domain>/**`), and the README test
   sections that named the old files.
4. Gates: the spec lint, the package's `tc` / `test`, then `bun check`.
   Report failures with their output, and don't claim green without it.

## Fan-out for a large port

Use one agent per package or domain, each in its own worktree:
spec writer → implementer → auditor (the auditor runs the spec lint and
catalog, and removes near-duplicate or UI-mechanical wording). Port one
domain at a time end to end, deleting legacy tests along the way, rather than
writing every spec first. Order: `pkgs/sync-engine` → `pkgs/room-sim` →
`pkgs/matchmaking-sim` → `apps/product` domains (auth/profile, chess,
spaces/friends, runtime shell/topology).

## Done when

- [ ] Every legacy test in scope appears in the parity ledger with a
      destination, and the ledger is in the PR body.
- [ ] No ported legacy test file remains, and no test script references one.
- [ ] Features pass every rule in `gherkin-style.md`, with no seeds, selectors,
      or ms sleeps in step text.
- [ ] Every former seed sweep, `randomActions`, or `explore` is a Quint model
      whose traces take every bound action.
- [ ] A sabotage check failed the new spec for each feature and model.
- [ ] Spec changes sit in `spec:` commits apart from the implementation.
- [ ] Spec lint and `bun check` are green (output shown).
