---
name: write-specs
description: Write, review, or rewrite Gherkin acceptance specs in specs/<domain>/*.feature using strict behavior-driven development — product behavior only, no implementation details. Use for any change to a .feature file, a new scenario, a health check or critical journey, or a spec review.
---

# Write specs (strict BDD)

A spec says **what the product does for the people who use it**. How it does it
belongs in step definitions, sim actions, and code, never in `specs/`.
Feature text is the product's contract. It must still be true, word for word,
after any rewrite of the implementation.

This skill is the spec writer's discipline. Roles and plumbing are in
[`docs/SPEC_DRIVEN_DEVELOPMENT.md`](../../../docs/SPEC_DRIVEN_DEVELOPMENT.md).
Terms are in [`GLOSSARY.md`](../../../GLOSSARY.md).

## The two tests every line must pass

1. **The swap test.** Would this wording change if we swapped the
   implementation, for example Postgres for another database, Cloudflare
   Workers for another host, EMQX for another broker, OpenTofu for another IaC
   tool, Grafana for another trace store, a web page for a native screen, or a
   button for a voice command? If yes, it is an implementation detail. Rewrite it.
2. **The observer test.** Who would notice this outcome, and how? Every `Then`
   must be something a person (Alice, a guest, a member) can see or experience
   from outside the product. A person who operates the product and watches it
   from outside also counts. Internal state, stored rows, config values,
   tokens, and wiring between components are not observable behavior.

A line that fails either test is wrong, even when it is accurate.

## Never write these in a feature file

| Category | Examples (from this product's stack) | Say instead |
| --- | --- | --- |
| Vendors & tech | Postgres, SQL, table, column, migration, Worker, Durable Object, binding, R2, bucket, EMQX, MQTT, broker, WSS, Grafana, Tempo, OTLP, OpenTofu, Stripe, Capacitor, WebKit | the capability: "their progress is kept", "live updates reach them", "payments are taken" |
| Protocols & transport | DNS, TLS, certificate, HTTP, status code, CORS, endpoint, route, URL path, JSON, cookie, header, redirect, WebSocket | "people reach the app at its address, securely", "signing in on the web works" |
| Internals | cache, service worker, KV, queue, config key, env var, secret, token, API key, credentials, schema, feature flag | the effect on a person: "the app opens offline", "sign-in is offered with Google" |
| Code & tests | function or module names, `data-testid`, file paths, the sim, mocks, fixtures, "fresh device" plumbing, the synthetic-monitor account | leave these to step definitions and the live world |
| UI mechanics (gate-enforced) | tap, click, press, button, modal, dialog, field, type into, scroll, navigate to `/x` | the intent: "Alice blocks Bob", "Bob opens Settings" |
| Where it runs | "in the simulation", "in a real browser", "on every deploy", "hourly" | tags (`@production`, `@browser`, …) and docs, never prose |

A name a person sees in the product is product vocabulary, not an
implementation detail. For example, "Google sign-in", "Apple sign-in" and
"Plus" are fine.

`bun run spec:check` rejects the UI-mechanics row and the most common
implementation words (`IMPLEMENTATION_WORDS` in `pkgs/gherkin`). Words it
misses are still this skill's responsibility.

## Shape of a good feature

```gherkin
@domain:friends @goal:social:5
Feature: Block and unblock
  Blocking ends a friendship and hides you from the person blocked;
  unblocking lets you start over.

  Scenario: A blocked person cannot find the blocker, so cannot ask again
    Given Alice and Bob are friends
    When Alice blocks Bob
    And Bob searches for "alice"
    Then Bob's search does not show Alice
```

- **Feature**: a capability named in product words. The description says
  *why it matters to people*, in one to three sentences. It never says how
  the capability works or how the test runs.
- **Rule** (optional): group scenarios under the business rule they
  illustrate when a feature has several rules.
- **Scenario**: one rule, shown by one concrete example. Name it for the
  outcome ("A repeat of a played puzzle is unrated"), not the procedure
  ("Test puzzle replay").
- **Given**: the world before the event, stated as facts ("Alice and Bob are
  friends"). It is not a list of actions that built that world.
- **When**: the one event under test, as a person's intent or a thing that
  happens to them ("the connection comes back", "the provider's renewal
  fails").
- **Then**: the observable outcome. Say what people see or can now do. Never
  say what the system stored.
- **Brief**: 3–5 steps, rarely more than 7. A `When … Then … When … Then`
  chain is usually several rules, so split it. Only `specs/journeys/` may chain,
  because there the journey is the behavior.
- **Background**: at most ~4 lines of shared, meaningful context. Never use it
  for plumbing.
- **Scenario Outline**: use it when the same rule holds across meaningful
  values (usernames, ratings, plans). Never use it to enumerate
  infrastructure parts.

Apply BRIEF (Cucumber, Rose & Nagy): **B**usiness language, **R**eal data,
**I**ntention revealing, **E**ssential, **F**ocused, **B**rief.

- **Business language.** Use `GLOSSARY.md` terms exactly (space, puzzle feed,
  attempt, membership, grace, …). If you need a new product term, add it to
  the glossary in the same `spec:` commit. Never add a technical term.
- **Real data.** Use concrete values that expose the rule: "1500?", "within 15
  seconds", "the yearly plan". Never depend on specific production records.
  Placeholders like "test user 123" are not real data.
- **Intention revealing.** Write "Alice signs in with Google", not the steps
  of the sign-in.
- **Essential.** Cut every detail the rule does not need. A required-but-
  irrelevant value belongs in the step definition's defaults.
- **Focused.** Each scenario fails for exactly one reason: the rule it names.
- **Actors.** Use named personas (Alice, Bob) or glossary roles (a guest, a
  member, a watcher). Never write "I" or "the user". In live domains where no
  persona fits, use "a person".

Timing is fine when it is a promise people feel ("within 5 seconds"). It is
not fine when it describes a mechanism, such as a retry schedule, a TTL, or
a warm-up window.

## Live domains: `specs/health/` and `specs/journeys/`

These run against deployed environments, which makes it tempting to describe
the deployment. Don't. They describe **the promises the live product keeps**,
as seen from outside.

- **Journeys** are must-never-break flows written as a person experiences
  them. The feature description says why the flow matters. It never says how
  it runs (sim versus browser, the monitor account, cleanup): that belongs in
  step definitions, tags, and `docs/`.
- **Health** scenarios name a product capability that must be working right
  now, in this environment. For each check, ask *"what would a person
  notice if this broke?"* and write that:

| Mechanism wording (wrong) | Behavior wording (right) |
| --- | --- |
| Every host resolves in DNS and has a TLS certificate valid for 14 more days | People reach the app at its address over a secure connection, and will for at least the next two weeks |
| The API answers its health check; every hard dependency is ready | The app can serve people right now |
| The web app exchanges a sign-in code with the API and the answer is readable | A person on the web can finish signing in |
| The database has every table and column the app declares | Everything a person saves is kept and read back |
| The app's key can write, read back and delete a file under its root prefix | Pictures people upload are kept and shown back |
| The broker's API authenticates and every node runs; the server's publish path accepts a message | Live updates reach people in a space |
| The room Worker hosts the room Durable Object namespace | People can host and join a live space |
| Every registered secret is present and passes live validation | Every service the product relies on still accepts it |
| Every billing key is in this environment's mode | Production charges real money; every other environment never does |

- **Mechanism-only checks.** Some checks have no behavior a person could ever
  notice, for example infrastructure drift, which component binds to which,
  or a trace-ingest address. These are operational invariants, not product
  behavior. Never dress one up in behavior words it does not have, and never
  write it as mechanism Gherkin. Stop, and tell the user it belongs in a
  code-level check or needs a product promise named first.

## Vocabulary reuse

Read [`docs/STEPS_CATALOG.md`](../../../docs/STEPS_CATALOG.md) and the
package catalogs it links. Reuse an existing phrase when it **passes both
tests** above. A catalogued phrase that leaks implementation is not
vocabulary. Write the behavioral phrase. The implementer rebinds it, and
the step auditor retires the old one. Consistent wording across features
beats clever wording.

## Role boundaries (hard)

- Never read `src/`, `tests/steps/`, sim code, or infra code while writing
  specs. You describe intent, not what the code happens to do. If you don't
  know the behavior, ask. Don't reverse-engineer it.
- Edit only `specs/**/*.feature`, `GLOSSARY.md`, and docs. Catalogs are
  generated (`bun run spec:catalog`).
- Commit feature changes alone, with a `spec:` subject. Implementation goes in
  a separate commit by the implementer.
- An implementer never rewords a feature. They return wording gaps to you.

## Workflow

1. **Discover the behavior** (Example Mapping). Work out the capability, the
   rules that govern it, one concrete example per rule, and the open
   questions. Ask the user about unresolved questions. Never guess.
2. **Check the vocabulary.** Read `GLOSSARY.md` and the step catalogs.
3. **Write.** Use one feature per capability in `specs/<domain>/`, with every
   scenario tagged `@domain:<domain>` plus any `@goal:<section>:<n>` it
   proves. Live-run tags (`@production`, `@oauth-relay`, `@observability`,
   `@browser`) are allowed. They select where a scenario runs. They do not
   describe behavior.
4. **Self-review** with the checklist below, line by line.
5. **Run `bun run spec:check`.** Undefined steps for new wording are
   expected: they are the implementer's handoff. Every other error is yours
   to fix.
6. **Commit** the feature-only change with a `spec:` subject, then hand off
   to the implementer.

## Review checklist

- [ ] Every step passes the swap test: no vendor, protocol, storage, code,
      UI-mechanic, or test-harness word.
- [ ] Every `Then` is observable by a person from outside the product.
- [ ] The feature description says why the capability matters, not how it
      works or runs.
- [ ] Each scenario illustrates exactly one rule, and its name states that
      rule's outcome.
- [ ] `Given` states facts, `When` is one event, `Then` is an outcome.
- [ ] Each scenario has 3–5 steps. Only journeys chain `When`/`Then`.
- [ ] Data is concrete and essential. Nothing is incidental or placeholder.
- [ ] Actors are personas or glossary roles, never "I" or "the user".
- [ ] Terms match `GLOSSARY.md`. Any new product term was added there.
- [ ] Tags: `@domain` is on every scenario, and `@goal` is on each goal proven.
- [ ] Mechanism-only checks were flagged to the user, not written.

## Sources

- Cucumber: [Writing better Gherkin](https://cucumber.io/docs/bdd/better-gherkin/)
  (declarative over imperative; "will this wording need to change if the
  implementation does?") and the [Gherkin reference](https://cucumber.io/docs/gherkin/reference/)
  (Then asserts observable output, not the database; short Backgrounds; Rule).
- Seb Rose: [Keep your scenarios BRIEF](https://cucumber.io/blog/bdd/keep-your-scenarios-brief/).
- Gáspár Nagy: [Clean up bad BDD scenarios](https://gasparnagy.com/2019/05/clean-up-bad-bdd-scenarios/).
- Matt Wynne: [Example Mapping](https://cucumber.io/blog/bdd/example-mapping-introduction/).
- Rose & Nagy, [*The BDD Books: Formulation*](https://bddbooks.com/) (no "I"; one rule per scenario).
- Dan North, [What's in a Story?](https://dannorth.net/blog/whats-in-a-story/).
