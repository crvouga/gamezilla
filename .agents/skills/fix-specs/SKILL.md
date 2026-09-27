---
name: fix-specs
description: Audit and repair bad BDD in specs/ and tests/steps/ — leaky or imperative wording, script-like or multi-rule scenarios, fat step definitions — and demote scenarios that are not product behavior into the right code test (property, model, contract, example regression) without losing goal proofs or regression guards. Use for spec reviews, cleanup, `spec:check --smells` debt, or when a scenario tests internals.
---

# Fix specs

Bad BDD costs twice. Its scenarios break when the implementation changes, and
they still don't describe the product. This skill finds it, decides the
right home for each case, and moves it there without losing coverage.

Targets: good specs follow [`write-specs`](../write-specs/SKILL.md), good
steps follow [`implement-specs`](../implement-specs/SKILL.md), and good code
tests follow [`docs/TESTING.md`](../../../docs/TESTING.md). The "what belongs
in a spec" table in
[`docs/SPEC_DRIVEN_DEVELOPMENT.md`](../../../docs/SPEC_DRIVEN_DEVELOPMENT.md)
decides every triage call.

## 1. Audit

Scope to what you were asked for (one feature, one domain, or all of
`specs/`). Collect:

```sh
bun run spec:check --smells     # hard errors + every smell with file:line
bun run spec:check --strict-duplicates   # near-duplicate step wording
```

Then read each in-scope feature and its step definitions and record every
smell below. Also note each scenario's `@goal` and `@regression` tags, and
look them up in `libs/tools/goal/goal-checks.json` and
`libs/tools/goal/known-bugs.json`.

### Spec smells

| Smell | Looks like | Usual fix |
| --- | --- | --- |
| Implementation leak | "the server holds 3 rated attempts", "the API answers", "the bucket is…" | rewrite to what a person observes, or demote |
| Imperative script | a person's every gesture spelled out; long `And` runs | lift to intent ("Alice signs in") |
| Multi-rule scenario | `When…Then…When…Then` outside journeys; a name with "and" joining two outcomes | split: one scenario per rule |
| Long scenario | over 8 steps, over 3 `When`s | lift `Given`s to facts, split rules, drop incidental steps |
| Actions as context | `Given Alice opens X, And taps Y…` | state the resulting fact ("Given Alice has blocked Bob") |
| Incidental detail | values or steps the rule doesn't need | move to step-definition defaults |
| Placeholder data | "test-user-1", "sim-seed-guest", "foo" | real, rule-exposing values |
| Exhaustive outline | many rows exploring a function's input space | one scenario for the headline rule + a property test |
| Internals in Then | asserting storage, sync queues, row counts, exact formula output | assert what a person sees; demote the rest |
| Missing why | feature without a description, or one that says how it runs | one to three sentences on why it matters |
| Narrator, UI mechanics | "I", "the user", "click", "button" | persona and intent (the gate already fails these) |
| Duplicate behavior | two scenarios failing for the same reason | keep the clearer one |

### Step-definition smells

| Smell | Looks like | Usual fix |
| --- | --- | --- |
| Fat step | branching, loops, or a recomputed expected value | move logic into a sim action or read; expected values come from the text |
| UI in steps | selectors, test IDs, or gestures inside `tests/steps` | move to the owning package's `sim/` |
| Wrong-phase work | assertions in Given/When, actions in Then | Given builds, When acts, Then observes |
| Step calls step | one definition invoking another's text | shared helper or sim action |
| Hidden state | module-level variables between steps | world / `w.memo`, scoped to the scenario |
| Storage assertions | Then reads rows or internal state directly | read what a person sees, or demote the check |
| Soup or duplicates | `{string} does {string}`, or two phrasings for one act | one precise phrase per intent; delete the other |
| Wall time | sleeps, `Date.now`, real timers in sim steps | `w.s.until` on virtual time |

## 2. Triage every finding

Decide one outcome per scenario:

1. **Keep**: it's behavior and well formed.
2. **Rewrite**: it's behavior but badly worded or shaped. It becomes a
   `write-specs` rewrite, then a rebind.
3. **Split**: several rules. Make one scenario per rule, each passing the
   checklist.
4. **Demote**: not behavior, so it belongs in a code test (§3). If it also
   holds a real rule, keep one lifted scenario for that rule and demote the
   rest.
5. **Delete**: duplicate, or proves nothing a person or the team could
   notice, and nothing else needs it. Check goal and regression ties first.

Ask the user when a call depends on product intent (for example, whether a
promise is something the team really observes). Never guess.

## 3. Demote to a code test

Pick the test by what the check really is (`docs/TESTING.md` §3):

| The scenario really checks… | Write instead | Where |
| --- | --- | --- |
| A formula or pure function (exact rating, score table, validation rules, move legality) | **property** via `assertProperty` (`@pkgs/property`): invariants, inverse, oracle, metamorphic relation | `<pkg>/tests/<topic>.property.test.ts` |
| A stateful invariant (exactly once, converges, idempotent under redelivery or reconnect) | **model-based** (`fc.commands` in `assertProperty`) or a **sim/monkey standing property** (`@pkgs/sim`) | `<pkg>/tests/…` or `<pkg>/tests/e2e/…` |
| Storage, wire shape, or which component stores what | **e2e or contract test** asserting through the package's exported reads or port | `<pkg>/tests/e2e/…` or the port's `*.contract.test.ts` |
| One literal case: a bug's input or a decided value | **example test**, `// regression: <bug-id>` for a bug | `<pkg>/tests/…` |
| Performance, size, budget, configuration | **gate script** | `libs/tools/scripts/…` or a `check:*` task |

Rules for the replacement:

- **Prove it guards the same thing.** Before deleting the scenario, show that
  the new test fails when the behavior is broken: invert the key assertion,
  or reintroduce the bug locally, watch it fail, then restore. A property
  must state what must hold, never restate the implementation.
- **Keep goal proofs.** If the scenario carried `@goal:<id>` and the feature
  no longer tags that goal anywhere, change that goal's proof in
  `libs/tools/goal/goal-checks.json` from the `spec` feature to a `test`
  proof naming the new test file. `bun run ci:goals` (in `bun check`) must
  stay green.
- **Keep regression guards.** For a `@regression:<id>` scenario that pinned an
  internal bug, move it to an example test with `// regression: <id>`, and
  point `regressionTest` in `known-bugs.json` at the new file. A guard is
  never a `*.property.test.ts`. An observable bug stays a `@regression`
  scenario.
- The test obeys `docs/TESTING.md`: in-process, virtual time, pinned seed,
  fast, reached by a gate script. It has no skips, and no example test that a
  property subsumes (unless it pins a bug or a decided value).

## 4. Execute in role order

1. **Implementation commit (tests first):** add the replacement tests and
   update `goal-checks.json` and `known-bugs.json`. Run them green.
2. **`spec:` commit:** only `.feature`, `GLOSSARY.md`, and docs. Rewrite,
   split, or remove scenarios per `write-specs`. Write the new wording from
   the product's point of view, never from what the step code does.
3. **Implementation commit (rebind):** move step bodies to the new wording,
   delete now-unused definitions, fix step smells per `implement-specs`, and
   run `bun run spec:catalog`.
4. **Verify:** `bun run spec:check --smells` shows no smells in the files you
   touched, the focused `bun run spec --package <workspace>` is green, then
   `bun run spec:ownership` (feature files only in `spec:` commits), then
   `bun check`. For live domains, also run `bun health` (read-only, every
   live feature against dev), and report any failure you didn't cause.

Intermediate commits may fail `spec:check` (undefined or unused steps). The
branch must be green at the end. Don't mix feature text into an
implementation commit.

## Worked example

Before (chess, a leak, several rules, and a sync invariant in one scenario):

```gherkin
Scenario: An offline solve reconciles to the server value and never double-applies
  Given Alice is signed in
  And Alice is playing puzzles in their space
  When Alice loses the connection
  And Alice solves the puzzle
  And the connection comes back
  Then the server holds 1 rated attempt for Alice within 30 seconds
  And Alice's server rating is exactly the rating formula's result for a win against that puzzle
  And Alice's device rating matches the server within 30 seconds
```

Triage: one rule a person sees (an offline solve counts once, and every
device agrees), one formula check, and one exactly-once invariant.

After:

```gherkin
Scenario: A puzzle solved offline counts once, on every device
  Given Alice is signed in on two devices
  And Alice solved a puzzle while offline
  When Alice's connection comes back
  Then both of Alice's devices show the same rating within 30 seconds
  And Alice's game log shows that puzzle solved once
```

The rating formula becomes a property test in `libs/chess/tests/`, checked
against an oracle and its monotonicity. Exactly-once under reconnect and
redelivery becomes a model or monkey standing property. Both land in the
first commit, and the `@goal`/`@regression` ties move with them.

## Report

End with a table covering every scenario you touched: the file and scenario,
the outcome (keep / rewrite / split / demote / delete), where it went, and
the goal or regression ties moved. Also list the smell count before and
after (`spec:check` summary line), plus open questions for the user.
