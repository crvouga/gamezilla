---
name: spec-implement
description: Make Gherkin scenarios and Quint models in specs/<domain>/ pass — red first, then thin deterministic step definitions over the package's harness actions and reads (or the live world for health and journeys), then the smallest product change — without editing a word of the spec. Use when a spec: commit needs implementing, scenarios are undefined or failing, steps need rebinding after a spec rewrite, or spec-audit demotes a scenario to a code test.
---

# Spec implement

You make the spec true **without changing a word of it**, through step
definitions so thin that the behavior lives in the product and the harness. The
rules are [`specs/README.md`](../../../specs/README.md) (D1–D6,
P1–P4); test rules are [`README.md`](../../../README.md#correctness-machinery).

## Hard rules

- **Never edit a `.feature`, `.qnt` or `ubiquitous-language.yml`** (P2).
  If a scenario cannot be implemented as written — ambiguous, leaks
  implementation, contradicts another scenario or the model, or needs a step
  no harness action can honestly perform — stop and hand it back (§ Hand back).
- **Red before green** (P3). No step body or product code before you have
  seen the scenario fail for the right reason.
- **Never weaken a check to go green.** A failing scenario means the product
  or the harness is wrong; find which (`debug-trace` skill).
- **Bind through the harness only** (D2). The harness is this repo's port: steps
  call exported `harness/` actions and reads; selectors, test IDs, DOM, HTTP and
  storage stay below it.

## Procedure

### 1. Red

1. Read the scenarios, the context's glossary, and the package's catalog
   ([index](../../../docs/STEPS_CATALOG.md); `bun run spec:catalog` refreshes it).
2. Run them: `bun run spec specs/<domain>/<file>.feature` (or
   `--package <workspace> -t '<scenario name>'`).
3. Show the output. Each new scenario must fail as one of:
   - **undefined step** — the wording has no definition yet;
   - **failing `Then`** — defined, but the product doesn't do it yet.

   A compile error, a missing import, a throwing `Given`, or a setup
   timeout is **not** red: fix the scaffolding (never the scenario) and
   re-run until the failure is one of the two above.
4. A scenario that **passes** before you write anything: either an existing
   definition already covers it (fine — say so) or it checks nothing. If a
   deliberately broken product (invert the key read locally) still passes
   it, hand it back.

### 2. Bind the steps (D2–D5)

For each undefined step, in order:

1. **Reuse.** Search the catalogs for the exact phrase. The spec writer
   reused it if it existed (B14); if a near-duplicate definition exists,
   hand the wording back rather than add a second one.
2. **Add a thin definition** in the package that runs the domain
   (`tests/steps/*.steps.ts`, registered in `tests/steps/index.ts`, the one
   composition point, D4):
   - `Given` builds state with the fastest honest harness setup action
     (`setupFriendsPair`), never by replaying the UI. It may assert only
     that the state it just built took effect (a precondition guard).
   - `When` performs the one event through the path a person uses
     (`w.s.apply(action, …)`). No assertions.
   - `Then` reads what the person sees (`w.s.read`, `w.s.until(read, {
     maxMs })`) and asserts. No actions except bringing the observer's view
     into focus.
3. **If no harness action or read exists**, add one to the owning package's
   `harness/` (exported, typed, one purpose, named after the glossary term) and
   call it. The UI selectors and gestures live there.
4. **Quint model**: write `tests/quint/<model>.binding.ts` — one `actions`
   entry per model action (`init` included) through exported harness actions,
   and `observe` reading the model's variables back through harness reads of
   what people see, never stored rows (D2), without acting; keys are the
   model's names (D6).

Good:

```ts
Then(
  "{actor}'s friends list stops showing {person} within {int} seconds",
  async (w, actor: Actor, person: string, seconds: number) => {
    await w.s.apply(openFriendsList, actor);
    await w.s.until((surf) => friendRowVisible(surf, actor, person), {
      pred: (visible) => !visible,
      maxMs: seconds * SECOND_MS,
    });
  }
);
```

Bad — selectors in the step (D2), a loop recomputing the rule (D3), wall
time (D5):

```ts
Then("{actor} has no puzzle on the board", async (w, actor: Actor) => {
  const cells = await w.page.$$('[data-testid="board-square"]');
  let pieces = 0;
  for (const c of cells) if (await c.getAttribute('data-piece')) pieces++;
  await new Promise((r) => setTimeout(r, 500));
  expect(pieces).toBe(0);
});
```

Rules for every definition: expression strings are plain literals
(the catalog reads them statically; comments go above the call); parameter
types `{actor}`, `{person}`, `{username}`, `{int}`, `{string}` and friends
from `@libs/harness/spec/parameter-types` — add a type rather than parse
strings; state lives on the world (`w`, `w.memo`), never at module level;
steps never call other steps.

### 3. Green, then refactor (TDD inner loop)

1. Run the one scenario. If its `Then` fails because the product lacks the
   behavior, write the **smallest product change** that makes it pass,
   test-first at the unit level where [`README.md`](../../../README.md#correctness-machinery) asks for it.
2. Green → refactor product, harness and steps with the scenario still green.
   Re-run after each refactor.
3. Next scenario. Repeat 1–3 until every scenario in the handoff passes.
4. A bug you found on the way: an observable one gets a `@regression:<id>`
   scenario (request it from `spec-upsert`); an internal one gets an
   example test marked `// regression: <id>`; both get a
   `libs/tools/goal/known-bugs/<id>.json`.

### 4. Whole context, then gates

1. Run **every** spec of the bounded context, not only the new ones:
   `bun run spec --package <workspace>` (it runs all its `specDomains`).
2. `bun run spec:catalog`, then `bun run spec:check --strict-duplicates`.
   Delete definitions nothing uses.
3. `bun run spec:ownership`, then `bun check-pr`.
4. Commit separately from the `spec:` commit (P1).

## Demote a scenario (when `spec-audit` says B17)

1. Write the replacement code test at the home the policy table gives it
   (property, model-based, contract, example regression).
2. Prove it guards the same thing: break the behavior locally, watch the new
   test fail, restore.
3. Move ties (P4): `@goal` → a `test` proof in
   `libs/tools/goal/goal-checks.json`; `@regression` → an example test with
   `// regression: <id>` and `regressionTest` in `known-bugs/<id>.json`.
4. Commit that. Then hand the scenario's removal to `spec-upsert` as a
   `spec:` commit; rebind or delete its steps after.

## Hand back

Stop and send `spec-upsert`:

```text
Scenario: specs/<domain>/<file>.feature:<line> "<title>"
Problem:  <in product words — e.g. "the scenario says Bob sees the note at
          once, but the offline rule says notes wait for the connection">
Rule:     <standard ID it breaks, if any>
Suggest:  <a wording that would be implementable>
```

Never "fix" the feature yourself, and never land a partial binding that
skips the scenario.

## Checklist before you commit

- [ ] Red shown for every new scenario (undefined or failing `Then`).
- [ ] No spec file changed.
- [ ] Every definition: harness calls only (D2), no product logic (D3), Given
      builds / When acts / Then asserts, virtual time only (D5).
- [ ] No duplicate or unused definitions; catalogs regenerated.
- [ ] The whole context's specs, `spec:check --strict-duplicates`,
      `spec:ownership` and `bun check-pr` are green.
