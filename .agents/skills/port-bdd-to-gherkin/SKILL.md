---
name: port-bdd-to-gherkin
description: Port legacy behavior tests written directly against the bespoke `@pkgs/sim` API (`system.run` + `s.apply` / `s.read` / `s.until`, `test.each` seed sweeps, `randomActions` / `explore` walks) into Gherkin features and Quint models, then delete them. Orchestrates write-specs, implement-specs, and fix-specs with a parity ledger so no legacy claim is lost. Use when asked to port, migrate, or rewrite sim / e2e / behavior tests to Gherkin, `.feature` files, Quint, or specs, for one file, a package (`@pkgs/sync-engine`, `@pkgs/room-sim`, `@pkgs/matchmaking-sim`, `@pkgs/auth-sim`, `@pkgs/db-indexes`, a product lib), or the whole repo.
---

# Port legacy sim tests to Gherkin + Quint

Legacy behavior tests drive the sim straight from `bun:test`:

```ts
await using s = await exampleSystem.run({ seed: 3, args: { clientCount: 0 } });
await s.apply(addClient, 'alice');
await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'shared' });
await expectInSync(s);
expect(await s.read(liveNote, 'bob', 'n1')).toMatchObject({ body: 'shared' });
```

This skill moves each such test to its proper home: a Gherkin scenario, a
Quint model, or (when it isn't behavior) a code test. Then it deletes the
legacy file. The sim stays the engine, and only the test's surface changes.

The policy lives in [`docs/SPEC_DRIVEN_DEVELOPMENT.md`](../../../docs/SPEC_DRIVEN_DEVELOPMENT.md).
Its "What belongs in a spec" table decides every destination, and
`bun run spec:check` enforces it. This skill is the **porting procedure** on
top of three role skills. Load each one when its phase starts:

| Phase | Skill |
| --- | --- |
| Word features and models | `write-specs` |
| Bind steps and model bindings over the sim | `implement-specs` |
| Audit the result, and demote non-behavior | `fix-specs` |

Status and remaining scope: [`docs/SPEC_MIGRATION_INVENTORY.md`](../../../docs/SPEC_MIGRATION_INVENTORY.md).
Product packages (Section A) are done. The framework-level sims
(`pkgs/sync-engine`, `pkgs/room-sim`, `pkgs/matchmaking-sim`,
`pkgs/auth-sim`, `pkgs/db-indexes`) are the open wave. Update that doc as
you port.

## 1. Inventory

```sh
git ls-files | grep -E '\.test\.tsx?$' \
  | xargs grep -lE 's\.apply\(|await using .* = await .*\.run\(|\.explore\(|randomActions'
```

Sort every legacy `test(...)` into exactly one destination:

| Legacy shape | Destination |
| --- | --- |
| Scripted example of something a person could observe (Alice's edit reaches Bob's other device, signing in offline fails cleanly) | **Gherkin scenario** in `specs/<domain>/` |
| One `test` that runs several phases (act → assert → act → assert) | **Several scenarios**, one per rule. Earlier phases become `Given` facts |
| `test.each` over seeds, seed loops, `randomActions`, `explore`, walks or "monkeys" | **Quint model.** Seeds never go in Gherkin. Quint draws the walks from `FC_SEED` |
| Stateful internals: convergence, exactly-once, idempotent replay, rebase order, fault recovery, fanout caps | **Quint model** over the package's own actors, run package-locally (see step 2) |
| Standing `defineProperty` checks on the system | **Stay on `defineSystem`** (they run under every scenario and trace). Mirror them as `val inv<Name>` when a model observes that state |
| Same-seed-twice determinism, replay, hash canonicality, `@pkgs/sim` / `sim-report` / `sql-client-sim` self-tests | **Stay code tests**, as framework contracts |
| Storage rows, wire frames, error codes (`NO_HARD_DELETE`, malformed frames) | **Contract test** asserting through the package's reads (`docs/TESTING.md`) |
| A past bug | A scenario tagged `@regression:<id>` if the bug was observable behavior. Otherwise an example regression test |

Write a **parity ledger** in the scratchpad (it goes in the PR body later).
It has one row per legacy test, with these columns:

1. `legacy file › test name`
2. **the claim in one plain sentence, in product or domain words, not code**
3. the destination (`specs/x/y.feature › Rule › Scenario`, `model.qnt › inv/action`, `stays: <test file>`)

Every legacy claim lands somewhere, or is dropped with a stated reason.

## 2. Where framework-package specs go

`pkgs/*` must stay app-agnostic, and `spec:check` bans architecture words
("server", "client", "sim") and implementation words in step text. So:

- **Behavior a person could observe** gets a Gherkin feature in
  `specs/<domain>/`, and the package claims that domain in its
  `package.json` `specDomains`. The domain is named for the capability
  (`sync`, `rooms`, `matchmaking`, `sign-in`), never for gamezilla. The
  wording uses people and devices: "Alice edits a note on her phone",
  "Bob's laptop shows it within 5 seconds". Steps live in the package's own
  `tests/steps/` on `@pkgs/gherkin`. A `pkgs/` package never imports
  `libs/sim-harness` steps.
- **Internal invariants** get a Quint model in `pkgs/<pkg>/tests/quint/<model>.qnt`,
  with its binding beside it. The model runs from the package's `test` through
  `@pkgs/quint/bun-test` `runQuintModel`, in the same way as
  `pkgs/quint/tests/bun-test.test.ts`. This is the "model-based property test"
  the policy asks for. Its variables are the package's public observables (a
  client's live rows, the server's rows, a room's hash), not queues or epochs.
- Turbo inputs: add `$TURBO_ROOT$/specs/<domain>/**` to the task that runs
  them.

## 3. Specs first: a spec-only `spec:` commit

The `write-specs` role must not read implementation or tests. **You** read
the legacy code, and the spec writer gets only the ledger's claim column,
the glossary, and the step catalogs. When fanning out, give that job to a
separate agent with exactly those inputs, and let it load `write-specs`.
Work from the claims, never from the legacy code: a line-by-line port
reproduces the imperative script that BDD exists to remove.

For models, follow [`references/QUINT_STYLE.md`](references/QUINT_STYLE.md).
Run `quint typecheck` and `bun run spec:check`, then commit specs, glossary,
and docs alone, with a `spec:` subject.

## 4. Implement

Load `implement-specs`. Steps and bindings are thin calls to exported sim
actions and reads (`w.s.apply` / `w.s.read` / `w.s.until`). A missing
stimulus becomes a `defineAction` or read in the package's `src/sim/`,
exported via `./sim`. Package-local World openers and DSLs that wrap
`defineSystem` are not allowed (AGENTS.md). If the product and the spec
disagree, decide which one is wrong. **Never weaken a spec or a model to
pass.**

## 5. Prove parity, then delete

1. `bun run spec --package <workspace>` (and the package's `test` for its
   local models) runs green.
2. **Sabotage check**, once per feature and model: temporarily break the
   behavior it claims (skip the retry dedup, drop the tombstone merge). The
   new spec must fail with a readable message. Then revert. A spec that
   still passes proves nothing, so fix the step or the binding.
3. Delete the ported legacy files **in the same change**. No `.skip`, no
   dual-running, no "kept for migration" copies (AGENTS.md). Update the
   package `test*` scripts, the turbo inputs, the READMEs that named the old
   files, and `docs/SPEC_MIGRATION_INVENTORY.md`.
4. Load `fix-specs` and audit the new features and steps. Then run
   `bun run spec:catalog`, `bun run spec:check`, the package's `tc` / `test`,
   and `bun check`. Show the output, and never claim green without it.

## Fan-out for a whole wave

Use one worktree per package, in this order: `sync-engine` → `room-sim` →
`matchmaking-sim` → `auth-sim` → `db-indexes`. In each worktree the porter
writes the ledger, then a `write-specs` agent, then an `implement-specs`
agent, then a `fix-specs` agent. Port one package end to end, deleting its
legacy tests, before starting the next.

## Done when

- [ ] Every legacy test in scope has a ledger row, and the ledger is in the
      PR body.
- [ ] No ported legacy file remains, and no script references one.
- [ ] Every former seed sweep or walk is a Quint model whose traces take
      every bound action.
- [ ] A sabotage check failed each new feature and model.
- [ ] Spec changes are in `spec:` commits, separate from the implementation.
- [ ] `spec:check` and `bun check` are green (output shown).
