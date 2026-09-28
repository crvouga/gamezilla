---
name: spec-upsert
description: Write or change Gherkin features and Quint models in specs/<domain>/ — product behavior only, in the bounded context's ubiquitous language, checked against specs/README.md and a per-aggregate coverage map. Use for any new or changed .feature or .qnt file, scenario, health check, or critical journey. To audit existing specs use spec-audit; to bind steps use spec-implement.
---

# Spec upsert

You write the product's contract: what people can do and what they observe,
as concrete examples in the context's own words. Every rule you are held to
is in [`specs/README.md`](../../../specs/README.md), cited
below by ID (A1, B5, C2 …), together with the policy. Read it once before
you start.

## Hard rules

- **A business person reads every line (A0).** No technical concept, in
  any words: no servers, crashes of anything but the person's own app,
  networks, messages, retries, caches, indexes, timings under a second.
  Before writing, say each rule as you would to a product owner; if you
  cannot without a technical idea, it is not a spec — name it in the handoff
  as a code test. A context whose subject is technical gets no specs.
- **Never touch implementation or step definitions.** Edit only
  `specs/**/*.feature`, `specs/**/*.qnt`, `specs/**/ubiquitous-language.yml`
  and docs (P1). Never read `src/`, `tests/`, `harness/` or infra: describe the
  behavior the product should have, not what the code does.
- **Never guess.** Stop and ask the person when you don't know: the
  behavior itself, which context owns it, a boundary value, what a person
  sees on refusal, or a new term's meaning.
- **Never invent vocabulary** (A3). A new term waits for the person's yes.
- **Never declare done with a blocking finding** from `spec-audit`.

## Inputs you need from the person

1. The behavior, in their words: who does what, and what should happen.
2. Its boundaries: when it must *not* happen, and what the person is told
   then.
3. Any concrete values the rule turns on (limits, durations, plans).

If any is missing and the existing specs don't answer it, ask before step 3.

## Procedure

### 1. Load the context

1. Pick the bounded context from the [context map](../../../specs/README.md#context-map)
   ("Owns" column). A behavior that reacts to another context's event
   belongs to the **downstream** context (A4). Unsure → ask.
2. Read `specs/<domain>/ubiquitous-language.yml`, every glossary it borrows
   from, and `specs/ubiquitous-language.yml`.
3. Read the context's Quint models (`*.qnt`) and `events.qnt`: they are its
   aggregates, commands, invariants and events (standard, "Terms").
4. List the context's existing features (`ls specs/<domain>`) and read the
   ones on the same aggregate. Open the package's step catalog from
   [`docs/STEPS_CATALOG.md`](../../../docs/STEPS_CATALOG.md): those phrasings
   are the vocabulary you reuse (B14).

### 2. Map the behavior (Example Mapping, then coverage)

Write this in your reply before any Gherkin:

```text
Context:    <domain>                 Aggregate: <model>.qnt
Story:      When <situation>, <who> wants <motivation>, so <outcome>.   (B2)
Commands:   <model action> = "<glossary term>"  …   (a person does it)
World:      <model action> = "<glossary term>"  …   (happens to people; model-only unless someone sees it)
Invariants: <inv name> — <in product words>  …   (model-only if bookkeeping)
Events:     <events.qnt variant>  …
Rules:
  R1 <rule>          + <example that lets it happen>
                     − <example that stops it, with the reason people see>
  R2 …
Questions:  <anything you could not answer from the specs>   → ask, then stop
Not behavior: <cases that are formulas, tables, internals> → code test (B17)
```

- Each rule needs a `+` and a `−` example (B4), or a stated
  `No counter-example: <why>`.
- A rule with no example isn't understood yet. An example that illustrates no
  rule is noise. More than about five rules → split the feature.
- A command, invariant or status this behavior needs but the model lacks is
  a model change in the same `spec:` commit (C6): add the action or `inv`,
  every product-facing name a glossary `model` name.

### 3. Resolve every word (A1–A6)

Underline each domain word in your map. For each, find its glossary entry
(own, borrowed, kernel) or a `forms` entry. For any word with no entry:

1. Rephrase with an existing term if one means it.
2. Otherwise propose it and **stop until the person confirms**:

   ```yaml
   - term: <term>
     definition: >-
       <what it is to a person, never how it is built>
     forms: [<inflections used>]
     avoid: [<synonyms people reach for>]
     model: [<Quint name, if any>]
   ```

3. A term another context owns: borrow it (`from: <domain>`) if that
   context publishes it; if it doesn't, ask the person — never redefine it.

### 4. Draft

Write one feature per capability in `specs/<domain>/<capability>.feature`,
one `Rule:` per rule from step 2, one scenario per example. Reuse catalogued
phrasings verbatim (B14).

### 5. Self-check — fill this in and show it before writing files

```text
Feature: specs/<domain>/<file>.feature
[ ] A1 every domain word resolves       — words checked: <list, or "all in glossary">
[ ] A2 no avoid-list synonym
[ ] A3 new terms confirmed by the person — <terms, or "none">
[ ] A4 foreign terms borrowed + published — <terms, or "none">
[ ] A0 a business person understands every line — read aloud: <yes, or the lines rewritten>
[ ] A5 no technical vocabulary
[ ] A6 every actor from the cast or a glossary role
[ ] B1 title is a capability            [ ] B2 description is one job story
[ ] B3 every scenario under a Rule      [ ] B4 each Rule has + and − (or No counter-example)
[ ] B5 exactly one When per scenario    [ ] B6 Givens are facts
[ ] B7 When is one command/event        [ ] B8 Thens observable; refusals give a reason
[ ] B9 declarative; quotes are data     [ ] B10 titles state outcomes
[ ] B11 Background used by all          [ ] B12 outlines: business dimension, boundaries, ≤ 6 rows
[ ] B13 plausible data                  [ ] B14 phrasings reused — new: <list, with why none fits>
[ ] B15 known tags only                 [ ] B16 ≤ 5 steps (8 hard)
[ ] B17 behavior only — demoted: <list, or "none">
[ ] D1 nothing would change under a rewrite
Coverage map (C1–C6) for <model>: <table>, gaps left: <list, or "none">
```

A box you cannot tick is a finding: fix the draft and redo the box. A
coverage gap you are not closing now is listed, not hidden.

### 6. Write and check

1. Write the feature, model and glossary changes.
2. Run `bun run spec:check`. Undefined steps and unbound models are the
   implementer's handoff. Every other error is yours.
3. Run `spec-audit` in report-only mode on the touched files and the
   aggregate's coverage map. Fix every blocking finding, then re-run until
   it passes. A warning you keep gets a one-line answer in the commit body.

### 7. Commit and hand off

Commit only `specs/**` and docs, subject `spec(<domain>): …` (P1). Hand off
to `spec-implement` with: the scenarios added or reworded, new phrasings,
cases left to code tests (B17), and the coverage gaps still open.

## Examples from this repo

### Several rules in one prose paragraph (B2, B3, B4, B5)

Before — `specs/chess/puzzle-quota.feature`: the rules live in the
description, there is no `Rule:`, and one scenario has two `When`s:

```gherkin
Feature: The daily rated puzzle allowance
  When a guest reaches the daily puzzle limit, they want to finish the puzzle
  on the board and know how to carry on. A guest may start 20 rated puzzles a
  day. Reaching the limit mid-puzzle lets that puzzle finish; …

  Scenario: Signing in lifts the limit and a puzzle is ready again
    Given Alice is a guest who has been shown today's puzzle limit
    When Alice signs in with Google
    And Alice goes back to the puzzles
    Then Alice has a puzzle on the board within 30 seconds
```

After:

```gherkin
Feature: The daily rated puzzle allowance
  When a guest reaches the daily puzzle limit, they want to finish the puzzle
  on the board and know how to carry on, so the limit never costs them a
  puzzle they started.

  Rule: A guest starts at most 20 rated puzzles a day

    Scenario: A guest's twentieth puzzle of the day still starts
      Given Alice is a guest who has played 19 puzzles today
      When Alice moves on to the next puzzle
      Then Alice has a puzzle on the board

    Scenario: A guest's next puzzle past the limit is refused
      Given Alice is a guest who has finished today's last allowed puzzle
      When Alice moves on to the next puzzle
      Then Alice is told the daily puzzle limit is reached within 15 seconds
      And Alice has no puzzle on the board

  Rule: Signing in lifts the daily puzzle limit
    No counter-example: a guest who has not signed in is the first rule's refusal.

    Scenario: A guest who signs in at the limit gets a puzzle again
      Given Alice is a guest who has been shown today's puzzle limit
      And Alice has signed in with Google
      When Alice goes back to the puzzles
      Then Alice has a puzzle on the board within 30 seconds
```

The boundary is on both sides (19 → starts, the 20th finished → refused),
the refusal names its reason (B8), one command keeps one phrasing ("moves on
to the next puzzle", not also "asks for another puzzle", B14), and the
sign-in became a fact, leaving one `When`.

### Internals and two events (A5, B5, B8)

Before — `specs/sync-engine/shared-space-membership.feature`:

```gherkin
Scenario: Leaving stops new notes reaching someone whose app cannot send, without their app reconnecting
  Given Bob's app cannot send
  When Bob leaves the shared space "Trip"
  And Alice writes the note "Tickets" saying "gate 4"
  Then Bob does not see the note "Tickets"
  And Bob's app is still connected
```

"cannot send" and "still connected" describe the transport, and Alice's
write is a second event. After:

```gherkin
Scenario: Notes written after someone leaves a shared space never reach them
  Given Alice and Bob are in the shared space "Trip"
  And Bob has left the shared space "Trip"
  When Alice writes the note "Tickets" saying "gate 4"
  Then Bob does not see the note "Tickets"
```

"Leaving doesn't force a reconnect" is not something a person observes: it
goes to a code test (B17), named in the handoff.

### App copy and a missing event (B7, B9)

Before — `specs/chess/solve-flow.feature` has no `When` and quotes the
app's prompt:

```gherkin
Scenario: The puzzle opens after the opponent's setup move, facing the solver
  Given Alice is signed in
  And Alice is solving the two-rook clearance puzzle
  Then Alice's board faces White
  And Alice is prompted "Your turn — find the best move for White"
```

After:

```gherkin
Scenario: A puzzle opens after the opponent's setup move, facing the solver
  Given Alice is signed in
  When Alice opens the two-rook clearance puzzle
  Then Alice's board faces White
  And Alice is prompted to find the best move for White
```

### A technical table (B12)

`specs/auth/failing-provider.feature` runs eight rows of provider
failure modes ("Apple's word for Alice is dated ten minutes ahead") through
two outlines. The failure mode is not a business dimension: the rule is
"while a provider is failing, signing in fails plainly and changes nothing".
Keep one scenario per provider for that rule; the eight failure modes become
a code-level table, named in the handoff.
