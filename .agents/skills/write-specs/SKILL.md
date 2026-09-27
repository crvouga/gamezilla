---
name: write-specs
description: Discover and write Gherkin acceptance specs in specs/<domain>/*.feature with strict behavior-driven development — product behavior only, no implementation details. Use for any new or changed .feature file, scenario, health check, or critical journey. To audit or clean up existing specs, use fix-specs; to bind steps, use implement-specs.
---

# Write specs (strict BDD)

A spec is an executable example of **what the product does for the people
who use it**. How the product does it belongs in step definitions, sim
actions, and code, never in `specs/`. Feature text is the product's
contract. It must still be true, word for word, after any rewrite of the
implementation.

Policy, gates, and where non-behavior goes:
[`docs/SPEC_DRIVEN_DEVELOPMENT.md`](../../../docs/SPEC_DRIVEN_DEVELOPMENT.md).
Terms: [`GLOSSARY.md`](../../../GLOSSARY.md).

## Role boundaries (hard)

- Never read `src/`, `tests/`, `sim/`, or infra code while writing specs.
  Describe the behavior the product should have, not what the code happens
  to do. If you don't know the behavior, ask the user. Never reverse-engineer
  it.
- Edit only `specs/**/*.feature`, `GLOSSARY.md`, and docs. Catalogs are
  generated.
- Commit feature changes alone, with a `spec:` subject. The implementer
  binds them in a separate commit and never rewords them.

## 1. Discover before you write (Example Mapping)

Before any Gherkin, lay out, in chat or notes:

- **Story**: the capability, in one sentence from the person's side.
- **Rules**: each rule the capability obeys ("a blocked person cannot find
  the blocker").
- **Examples**: one concrete example per rule. This is the main case, plus
  each boundary that could go the other way.
- **Questions**: anything nobody can answer yet. Ask the user. Never guess.

Too many rules means the story is too big: split the feature. A rule with no
example isn't understood yet. An example that illustrates no rule is noise.

Then decide, per rule, **whether it is behavior at all**. See "What belongs
in a spec" in the policy doc. A formula's exact output, a validation table,
a sync invariant, a storage row, or a wire shape is a code test. Write a
Gherkin scenario for the rule a person experiences. If exhaustive cases are
needed, note them for the implementer as a property or model test instead of
writing an outline with 20 rows.

## 2. The two tests every line must pass

1. **The swap test.** Would this wording change if the implementation
   changed? Examples: another database, host, broker, IaC tool, or trace
   store; a native screen instead of a web page; a voice command instead of
   a button. If yes, the line states an implementation detail. Rewrite it.
2. **The observer test.** Who would notice this outcome, and how? Every
   `Then` must be something a person (Alice, a guest, a member, a watcher)
   can see or experience. The other allowed observer is the team, from
   outside the product. Internal state, stored rows, config values, tokens,
   and wiring between components are not observable behavior.

A line that fails either test is wrong, even when it is accurate.

## 3. Never write these in a feature file

| Category | Examples | Say instead |
| --- | --- | --- |
| Vendors & tech | Postgres, SQL, table, column, migration, Worker, Durable Object, R2, bucket, EMQX, MQTT, WSS, Grafana, Tempo, OTLP, OpenTofu, Stripe, WebKit | the capability: "their progress is kept", "live updates reach them", "payments are taken" |
| Protocols & transport | DNS, TLS, certificate, HTTP, status code, CORS, endpoint, API, route, URL path, JSON, cookie, header, redirect, callback, OAuth, WebSocket | "people reach the app at its address, securely", "signing in on the web works" |
| Internals & architecture | server, client, backend, cache, service worker, KV, queue, config key, env var, secret, token, credentials, schema, feature flag, "holds N rows" | the effect on a person: "Alice's rating is the same on both devices", "the app opens offline" |
| Code & tests | function or module names, `data-testid`, file paths, the sim, mocks, fixtures, the synthetic-monitor account | leave these to step definitions and the live world |
| UI mechanics | tap, click, press, button, modal, dialog, field, type into, scroll, navigate to `/x` | the intent: "Alice blocks Bob", "Bob opens Settings" |
| Where it runs | "in the simulation", "in a real browser", "on every deploy", "hourly" | tags (`@production`, `@browser`, …) and docs |
| Narrator | I, me, my, "the user" | a persona (Alice, Bob) or a glossary role (a guest, a member) |

A name a person sees in the product is product vocabulary, not an
implementation detail. For example, "Google sign-in", "Apple sign-in" and
"Plus" are fine.

`bun run spec:check` rejects UI mechanics, the common implementation words,
and narrators, and fails on architecture words such as "server". Words it
misses are still your responsibility.

## 4. Shape of a good feature

```gherkin
@domain:friends @goal:social:5
Feature: Block and unblock
  Blocking ends a friendship and hides you from the person blocked;
  unblocking lets you start over.

  Rule: A blocked person cannot reach the blocker

    Scenario: A blocked person cannot find the blocker
      Given Alice and Bob are friends
      And Alice has blocked Bob
      When Bob searches for "alice"
      Then Bob's search does not show Alice
```

- **Feature**: a capability named in product words. The description says
  *why it matters to people*, in one to three sentences, and never how it
  works or runs.
- **Rule**: groups the scenarios that illustrate one business rule. Use it
  once a feature has more than one rule.
- **Scenario**: one rule shown by one concrete example. Name it for the
  outcome ("A repeat of a played puzzle is unrated"), not the procedure
  ("Test puzzle replay"). Scenario names are unique within the domain.
- **Given**: the world before the event, as facts in the present or perfect
  tense ("Alice has blocked Bob"). It is not a list of actions that built
  that world. Context always comes first.
- **When**: the one event under test. It's a person's intent or something
  that happens to them ("the connection comes back", "the provider's renewal
  fails").
- **Then**: the observable outcome. Say what people see or can now do, never
  what the system stored. Every scenario has at least one `Then`.
- **Brief**: 3–5 steps is the target. The gate fails above 8 steps or 3
  `When`s. A `When … Then … When … Then` chain is usually several rules, so
  split it. Only `specs/journeys/` may chain, because there the journey is the
  behavior. A step that must happen first belongs in `Given` as a fact.
- **Background**: at most ~4 lines of shared, meaningful context. Never use
  it for plumbing. If scenarios need different context, use separate `Rule`s
  or features.
- **Scenario Outline**: use it when one rule holds across a few meaningful
  values (plans, statuses, boundary ratings). Every column must change the
  outcome. A big table is a property test in disguise.
- **Data tables and doc strings**: use them only when the shape of the data
  is the point (a list of people in a space). Never use them to feed
  fixtures.
- **Time**: say it only when it's a promise people feel ("within 5 seconds",
  "after 7 days"). Never state a mechanism (a retry schedule, a TTL, a
  warm-up window).

Apply BRIEF (Rose & Nagy): **B**usiness language, **R**eal data,
**I**ntention revealing, **E**ssential, **F**ocused, **B**rief.

- **Business language**: `GLOSSARY.md` terms, exactly. If you need a new
  product term, add it to the glossary in the same `spec:` commit. Never add
  a technical term.
- **Real data**: concrete values that expose the rule ("1500?", "the yearly
  plan"). No placeholder values ("test user 123"), and no dependence on
  specific production records.
- **Intention revealing**: "Alice signs in with Google", not the steps of
  signing in.
- **Essential**: cut every detail the rule doesn't need. A required but
  irrelevant value is the step definition's default.
- **Focused**: the scenario fails for exactly one reason, the rule it names.

## 5. Live domains: `specs/health/` and `specs/journeys/`

These run against deployments. That makes it tempting to describe the
deployment. Don't. They describe **the promises the live product keeps**, as
seen from outside.

- **Journeys** are must-never-break flows written as a person experiences
  them. The feature description says why the flow matters, never how it runs.
- **Health** scenarios name a capability that must work right now in this
  environment. For every check, ask *"what would a person, or the team,
  notice if this broke?"* and write that. The team is a legitimate observer
  for promises like "nobody has changed the environment by hand" or "the
  team can look up what a request did".

| Mechanism wording (wrong) | Behavior wording (right) |
| --- | --- |
| Every host resolves in DNS and has a TLS certificate valid for 14 more days | People reach every address of the app securely for 14 more days |
| The database has every table and column the app declares | What people saved is ready for this version of the app |
| The broker's API authenticates and every node runs | Live updates are ready to reach people |
| The room Worker hosts the room Durable Object namespace | Live spaces can run in this environment |
| Every billing key is in this environment's mode | Payments in this environment are real exactly when it is a production environment |

If no person or team member could ever notice a check, it's a gate or a code
test, not a spec. Tell the user rather than disguise it.

## 6. Tags

- `@domain:<dir>` on every scenario, matching its directory. Put it on the
  feature line so every scenario inherits it.
- `@goal:<section>:<n>` on each scenario that proves a `docs/GOAL.md`
  statement.
- `@regression:<bug-id>` on the scenario that pins an observable bug, with
  its `known-bugs.json` entry.
- Live-run tags (`@production`, `@oauth-relay`, `@observability`,
  `@browser`) select where a scenario runs. They don't describe behavior.
- No other tags. In particular, no work-tracking tags like `@wip` or
  `@todo`.

## 7. Workflow

1. **Discover** (§1) and resolve open questions with the user.
2. **Check the vocabulary.** Read `GLOSSARY.md` and
   [`docs/STEPS_CATALOG.md`](../../../docs/STEPS_CATALOG.md) (it links each
   package's catalog). Reuse a phrase only when it passes both tests. A
   catalogued phrase that leaks implementation isn't vocabulary: write the
   behavioral phrase, and `fix-specs` retires the old one.
3. **Write** one feature per capability in `specs/<domain>/`.
4. **Self-review** against the checklist, line by line.
5. **Run** `bun run spec:check`. Undefined steps for new wording are the
   implementer's handoff. Every other error, including every smell, is
   yours to fix.
6. **Commit** the feature-only change with a `spec:` subject. Hand off to
   the implementer (`implement-specs`), including any exhaustive cases you
   left to code tests.

## Review checklist

- [ ] Every step passes the swap test: no vendor, protocol, storage,
      architecture, code, UI-mechanic, harness, or narrator word.
- [ ] Every `Then` is observable by a person, or by the team from outside.
- [ ] The feature description says why the capability matters, not how it
      works or runs.
- [ ] Each scenario illustrates exactly one rule, and its name states that
      rule's outcome.
- [ ] `Given` states facts and comes first. `When` is one event. `Then` is an
      outcome.
- [ ] Each scenario has 3–5 steps (never over 8). Only journeys chain
      `When`/`Then`.
- [ ] Data is concrete and essential. Outlines vary only values that change
      the outcome.
- [ ] Terms match `GLOSSARY.md`, and any new product term was added there.
- [ ] Tags: `@domain` everywhere, `@goal` on each goal proven, `@regression`
      with its bug entry.
- [ ] Non-behavior (formulas, invariants, storage, wire, wiring) went to code
      tests, not to Gherkin.

## Sources

- Cucumber: [Writing better Gherkin](https://cucumber.io/docs/bdd/better-gherkin/)
  and the [Gherkin reference](https://cucumber.io/docs/gherkin/reference/).
- Seb Rose: [Keep your scenarios BRIEF](https://cucumber.io/blog/bdd/keep-your-scenarios-brief/).
- Matt Wynne: [Example Mapping](https://cucumber.io/blog/bdd/example-mapping-introduction/).
- Gáspár Nagy: [Clean up bad BDD scenarios](https://gasparnagy.com/2019/05/clean-up-bad-bdd-scenarios/).
- Rose & Nagy: [*The BDD Books: Discovery* and *Formulation*](https://bddbooks.com/).
- Dan North: [What's in a Story?](https://dannorth.net/blog/whats-in-a-story/).
