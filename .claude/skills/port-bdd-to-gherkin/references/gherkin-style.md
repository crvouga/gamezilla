# Gherkin style for this repo

A feature is a readable statement of behavior that the implementation has to
meet. If a product person can't read a scenario and agree or disagree with
it, rewrite it.

## Shape

```gherkin
@domain:friends @goal:social:5
Feature: Block and unblock
  Blocking ends a friendship and hides you from the person blocked;
  unblocking lets you start over.

  Rule: Blocking ends the friendship and hides the blocker

    Scenario: A blocked person cannot find the blocker
      Given Alice and Bob are friends
      And Alice has blocked Bob
      When Bob searches for "alice"
      Then Bob's search does not show Alice
```

- **Feature description** says *why* the behavior exists, in one to three
  lines.
- **`Rule:`** groups scenarios under one business rule. Every scenario
  illustrates exactly one rule.
- **Tags**: product specs carry `@domain:<dir>` and any relevant
  `@goal:<section>:<n>`. Package-local framework specs don't need tags
  unless the runner requires them.

## Rules

1. **Declarative, not imperative.** Say what the person does, not how the UI
   does it. Taps, clicks, handles, test ids, routes, selectors, SQL, table
   names, mutation names, and HTTP paths never appear in steps.
   - ✗ `When Alice taps "friend-block" on Bob's profile`
   - ✓ `When Alice blocks Bob`
2. **One behavior per scenario.** `Given`, then `When`, then `Then`, each
   once. `And`/`But` only continue the same kind. A `When` after a `Then`
   means there are two scenarios. Split them, and turn the earlier phase into
   past-tense `Given` state.
3. **Tense carries meaning.** `Given` is state that already holds, in past or
   perfect tense (`Alice has sent Bob a friend request`). `When` is one
   present-tense action. `Then` is an observable outcome (`Bob sees …`,
   `Bob's inbox shows …`).
4. **Observable outcomes, from someone's point of view.** Assert what a
   person or client can see: their screen, their device's synced copy, the
   server's answer. Don't assert internal queues or counters unless they
   *are* the package's public surface. For framework packages, the "people"
   are the package's own actors (clients, devices, server, replicas), and
   network faults are legitimate domain events.
5. **No test plumbing in text.** No seeds, `clientCount`, ms sleeps, retry
   counts, or `expectInSync`. Time appears only when the time is the
   behavior (`within 15 seconds`, `a day later`), and it runs on virtual
   time. Seeds belong to the world (`FC_SEED`). Sweeps belong to Quint.
6. **Scenario titles state the outcome** as a rule: `A lost upload response
   retries without applying the write twice`. Titles are unique within the
   package, and never contain "test", "should", a seed, or a ticket number.
7. **Named people, consistent cast.** `Alice`, `Bob`, `Carol` through the
   `{actor}` parameter type. Framework specs may use lowercase client ids
   (`"alice"`) if that's the established catalog wording. Follow the catalog.
8. **Short.** Aim for 3–7 steps. If a scenario needs more, either an
   intent-level `Given` is missing (`Given Alice and Bob are friends` instead
   of six setup steps) or it tests several rules.
9. **Scenario Outline only for business inputs** (username rules, pricing
   tiers, move legality), with an `Examples` table whose columns name domain
   concepts. Never for seeds.
10. **Background** only for `Given`s that every scenario in the file needs,
    at most three lines. Don't put a `When` there.
11. **No conjunction steps.** `When Alice signs in and opens settings` is two
    steps, or better, one intent (`When Alice opens her settings`).
12. **Reuse vocabulary.** Search the catalog before adding a step. Parameters
    use Cucumber Expressions (`{actor}`, `{string}`, `{int}`, custom types).
    Two phrasings of one action is a defect. Pick one and use it everywhere.
13. **Independent scenarios.** Each gets a fresh world. Never depend on the
    order of scenarios or on state left behind by another one.

## Before / after from this repo

Legacy (`pkgs/sync-engine/tests/two-client-mutual-writes-converge.test.ts`):

```ts
test.each([1, 2, 42, 99])('seed sweep staysInSync (seed=%i)', async (seed) => {
  await using s = await exampleSystem.run({ seed, args: { clientCount: 0 } });
  await s.apply(addClient, 'alice'); await s.apply(addClient, 'bob');
  await s.apply(mutate, 'alice', setNote, { id: `n-${seed}`, body: `b-${seed}` });
  await s.apply(mutate, 'bob', setNote, { id: `m-${seed}`, body: `c-${seed}` });
  await expectInSync(s);
});
```

✗ The first spike's literal port leaked the harness into the spec:

```gherkin
Scenario Outline: two clients converge (seed <seed>)
  Given a sync system with seed <seed>
  And clients "alice" and "bob"
  ...
  Examples:
    | seed |
    | 1    |
```

✓ The example becomes a scenario, and the sweep becomes a model invariant
(`sync_engine.qnt` `invConverges` over any interleaving of writes):

```gherkin
Rule: Every client ends up with every write

  Scenario: Writes from two clients reach both
    Given "alice" and "bob" are connected
    When "alice" sets note "n1" to "from alice"
    And "bob" sets note "m1" to "from bob"
    Then "alice" and "bob" both see notes "n1" and "m1"
```

Legacy multi-phase test (leave → write → rejoin in one `test`) becomes three
scenarios under one `Rule: Membership decides which room updates arrive`:
`Leaving stops room updates`, `Writes made while away arrive on rejoin`,
`Leaving keeps what was already synced`.
