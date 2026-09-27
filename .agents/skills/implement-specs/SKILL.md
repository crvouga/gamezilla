---
name: implement-specs
description: Bind Gherkin scenarios in specs/<domain>/*.feature to thin, deterministic step definitions over sim actions and reads (or the live world for health and journeys). Use when a spec: commit needs implementing, when scenarios are undefined or failing, or when step definitions need rebinding after a spec rewrite. Never edits feature text.
---

# Implement specs

Your job is to make the scenarios pass **without changing a word of them**,
through step definitions so thin that the behavior lives in the product and
the sim, never in the glue. Policy:
[`docs/SPEC_DRIVEN_DEVELOPMENT.md`](../../../docs/SPEC_DRIVEN_DEVELOPMENT.md).
Test rules: [`docs/TESTING.md`](../../../docs/TESTING.md).

## Hard rules

- **Feature text is read-only.** If wording is missing, ambiguous, or leaks
  implementation, stop and hand it back to the spec writer (`write-specs`)
  with the scenario, the problem, and a suggested behavioral wording. Never
  "fix" a feature in an implementation commit.
- **Never weaken a check to go green.** A failing scenario means either the
  product or the sim is wrong. Find which (see the `debug-trace` skill).
- **Deterministic only.** Sim steps run on virtual time: wait with
  `w.s.until(read, { maxMs })`, never sleep, `setTimeout`, or read the wall
  clock. Only live steps (`apps/product/tests/steps/`) touch real I/O, marked
  `// @io-wall-ok`, and they poll with `eventually` + `wallWait`.
- **No skipped, pending, or conditional steps**, and no retries. A step the
  host can't perform throws `hostLimit(reason)` from `@pkgs/gherkin/registry`
  (for example a real-browser-only step in the sim).

## Anatomy of a good step definition

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

- **One sim call, or a short fixed sequence.** `w.s.apply(action, …)` to act,
  `w.s.read(read, …)` / `w.s.until(…)` to observe. Actions and reads are
  exported from the owning package's `sim/`. The UI selectors, test IDs, and
  gestures live there, never in the step.
- **Given builds state.** Prefer the fastest honest route: a sim setup action
  such as `setupFriendsPair`, not replaying the UI. A precondition guard is
  fine (throw if setup didn't take), but no product assertions.
- **When performs the one event** through the same path a person uses (sim
  actions over the real UI). No assertions.
- **Then observes and asserts** through reads of what the person sees. No
  actions, except bringing the observer's view into focus, as in
  `openFriendsList` above. Assert on what a person can see, not on storage
  rows. If the only way to check is a storage read, the scenario is probably
  a code test (see `fix-specs`).
- **No logic.** No branching on product rules, no loops that recompute
  expected values, no re-implementing the product. The expected value comes
  from the scenario text or a decided constant.
- **Steps never call other steps.** Share a helper function or a sim action.
- **State lives on the world** (`w`, `w.memo` for live runs), scoped to one
  scenario. No module-level mutable state. Setup that a spec rewrite dropped
  from a `Given` becomes a memoized helper the steps call.
- **Parameter types**: use `{actor}`, `{person}`, and `{username}` (from
  `@libs/sim-harness/spec/parameter-types`), plus `{int}` and `{string}`.
  Add a parameter type rather than parsing strings inside a step. Optional
  text such as `attempt(s)` or `(still )` is fine. Alternation that changes
  meaning is not.
- **Expression strings are plain literals.** The catalog and `spec:check`
  read them statically. Put comments above the call, never inside the
  argument list.

## Ownership and reuse

- Steps live in the package that runs the domain (`specDomains` or
  `liveDomains`), in `tests/steps/*.steps.ts`, registered in
  `tests/steps/index.ts`. A package reuses another's steps by importing its
  `steps/…` export, never by copying.
- **Reuse before adding.** Search the catalogs
  ([`docs/STEPS_CATALOG.md`](../../../docs/STEPS_CATALOG.md)). If the scenario's
  wording is a near-duplicate of an existing definition, raise it with the
  spec writer. Don't add a second definition.
- **Delete what nothing uses.** `spec:check` fails on unused definitions.
  When a rewrite retires wording, move the body to the new wording, then
  delete the old one.
- A new domain needs a package to claim it: add it to `specDomains` in
  `package.json` and `$TURBO_ROOT$/specs/<domain>/**` to the `test:e2e`
  inputs in `turbo.json`.

## Workflow

1. Read the scenarios and catalogs. List undefined steps (`bun run
   spec:check`).
2. For each step, reuse, or add a thin definition over an existing sim action
   or read. If none exists, add the action or read to the owning package's
   `sim/` (exported, typed, one clear purpose) and call it.
3. Run the narrowest scenario (`bun run spec specs/<domain>/<file>.feature`,
   or `--package <workspace> -t '<name>'`) until it passes.
4. If a scenario keeps failing and the product is right, the sim is wrong.
   Fix the sim, never the scenario.
5. Pin any bug you found per `docs/TESTING.md`. Pin an observable bug as
   `@regression:<id>`, and send the spec writer a `spec:` request for it. Pin
   an internal bug as `// regression: <id>` in a code test. Either way, add
   the `known-bugs.json` entry.
6. `bun run spec:catalog`, `bun run spec:check`, then `bun check`. Commit
   separately from the `spec:` commit.

## Review checklist

- [ ] No feature text changed.
- [ ] Each definition is a sim call or a short fixed sequence, with no
      product logic.
- [ ] Given builds state, When acts, Then observes. Assertions appear only in
      Then (plus precondition guards).
- [ ] No selectors, test IDs, sleeps, wall time, or module state in steps.
- [ ] No duplicate or near-duplicate definitions. Unused definitions are
      deleted.
- [ ] Catalogs are regenerated, and `spec:check` and `bun check` are green.
