# Spec standard

The one rulebook for Gherkin features and Quint models in `specs/`. The three
spec skills — [`spec-upsert`](../.agents/skills/spec-upsert/SKILL.md) (write),
[`spec-implement`](../.agents/skills/spec-implement/SKILL.md) (bind) and
[`spec-audit`](../.agents/skills/spec-audit/SKILL.md) (check) — cite these
rules by ID and never restate them. Change a rule here, and only here.

Policy (layout, roles, how specs run, what belongs in a spec at all) is
[`SPEC_DRIVEN_DEVELOPMENT.md`](SPEC_DRIVEN_DEVELOPMENT.md); the context map is
[`CONTEXT_MAP.md`](CONTEXT_MAP.md).

Every rule has an ID, a **severity**, and a one-line **why**. Before deleting
or softening a rule, answer its why.

- **Blocking**: the spec is wrong. Audit fails; nobody may wave it through.
- **Warning**: probably wrong. Audit passes, but the report lists it and the
  writer either fixes it or answers it in the `spec:` commit body.

## Terms this standard uses

| Term | Here it means |
| --- | --- |
| Bounded context | One `specs/<domain>/` directory |
| Language of a context | The terms (and their `forms`) in `specs/<domain>/ubiquitous-language.yml`, its borrowed terms (`from: <domain>`), and the shared kernel `specs/ubiquitous-language.yml` |
| Aggregate | One Quint model, `specs/<domain>/<model>.qnt` |
| Command | An `action` of a model other than `init`, `step` and `_`-helpers: something a person does, or something that happens to them ("the connection comes back") |
| Invariant | A model's `val inv<Name>` |
| Domain event | A variant of a type in `specs/<domain>/events.qnt` |
| Policy | A reaction in a downstream context to an upstream domain event, per the context map's relationships |
| Cast | The named people step definitions know: Alice, Bob, Carol, Dave, Eve (and White and Black at a chess board) |
| Refusal | A `Then` saying the `When`'s command did not take effect or is not allowed. Markers: "refused", "cannot", "can't", "no longer can", "is told", "fails"/"failed", "not allowed", "still" (the state is unchanged). "stops showing" or "does not show" alone is not a refusal: it is often the command's effect |

## A. Language — the ubiquitous language is law

**A1 · Every domain word resolves to the language.** *Blocking.*
Every domain noun, verb, state and event in a feature's prose (title,
description, `Rule:` lines, scenario titles, steps) is a term of the
context's language or one of that term's `forms`, spelled and cased exactly.
A regular plural (`+s`/`+es`) is implied; any other inflection must be listed
in `forms`. A term's `someone`/`something` slot matches any cast name or
term in that place ("Alice looks up Bob" is *look someone up*). Not domain words: cast names, numbers and durations, quoted
example values, and plain English that names no product concept (sees, is
shown, can, still, again, within, stops).
*Why: a word nobody defined is read a different way by every agent and every
port.*

**A2 · No synonyms.** *Blocking.* A word a glossary lists under `avoid`, or
any other stand-in for an existing term ("unfriend" for *remove a friend*,
"room" for *space*), is never used.
*Why: two words for one thing reads as two things.*

**A3 · New vocabulary needs a person's yes.** *Blocking.*
A term that is not in the language stops the work. The writer either uses an
existing term, or proposes the addition — term, definition in product
words, `forms`, `avoid`, and `model` if a Quint name needs it — and waits for
the person to confirm it before writing any spec that uses it. It is then
added in the same `spec:` commit.
*Why: the language grows by decision, not by accident.*

**A4 · Foreign terms only through the published language.** *Blocking.*
A term another context owns appears only if that context marks it
`published: true` and this context's glossary borrows it (`from: <domain>`).
Quint models import only `./events` or `../<upstream>/events`.
*Why: a context that reaches into another's private words couples to its
insides.*

Cross-context specs live in the **downstream (consuming) context**, never in
the upstream one and never in a shared folder. You tell them apart from
in-context specs by what they use: each borrowed term they use is listed
with `from:` in their context's glossary, and each policy they illustrate
appears in the coverage map (C5) under its upstream event. `specs/journeys/`
is the one context whose whole job is crossing contexts; it borrows like any
other.

**A5 · No technical vocabulary.** *Blocking.*
No storage (database, table, row, column, record, cache, schema, migration),
transport (API, endpoint, route, request/response, HTTP, status code, JSON,
payload, header, cookie, token, WebSocket, URL, redirect, callback, OAuth),
identifiers (ID, UUID, key, hash), code (class, method, function, module,
file path, framework or vendor names), architecture (server, client,
backend, service, worker, queue, sim), or UI mechanics (screen, page, view,
widget, button, link text, field, form, modal, dialog, click, tap, press,
swipe, scroll, type into, navigate). The only exception: a glossary term
that names something people see in the product ("Settings", "tabs",
"billing portal", "space link").
*Why: feature text must still be true, word for word, after any rewrite of
the implementation.*

**A6 · A named person or glossary role acts.** *Blocking.*
Every actor is someone from the cast, a glossary role ("a guest", "the
host", "the team"), or a glossary term for something that happens to people
("Google", "the connection"). Never "I", "the user", "the system", "the
app does" as a hidden narrator, unless the glossary defines that term.
*Why: a rule without a "who" can't be checked against the person it serves.*

## B. Gherkin structure

**B1 · Feature title is a capability.** *Blocking if it breaks A1/A5;
otherwise a warning.* A short noun or verb phrase in the context's language
("Block and unblock", "The daily rated puzzle allowance"). Never "Tests for
…", a file name, or a component.
*Why: the titles are the product's table of contents.*

**B2 · Feature description is one job story.** *Blocking.*
House style: `When <situation>, <who> wants <motivation>, so <outcome>.` —
one sentence, optionally one or two more that say why it matters. The rules
themselves go in `Rule:` lines, not in the description.
*Why: one fixed shape makes the why impossible to skip and easy to check;
rules buried in prose never get a scenario.*

**B3 · Every scenario sits under a `Rule:`.** *Blocking.*
Each `Rule:` line states one business rule in the context's language
(EARS phrasing is welcome: "While a friend request waits, the asker can
cancel it"). A feature with one rule still writes it.
*Why: the rule is what a scenario illustrates, and the coverage map (C) keys
on it.*

**B4 · Every rule shows both sides.** *Blocking.*
A `Rule:` has at least one scenario where the rule lets something happen
and one where it stops something (a refusal). When a rule cannot be broken
by anything a person does, the Rule's description says so on its first
line: `No counter-example: <why>`.
*Why: a rule shown only working never proves it stops anything.*

**B5 · Exactly one `When`.** *Blocking.*
Each scenario has one `When` step and no `And`/`But` after it before the
first `Then`. No scenario acts after a `Then`. Only `specs/journeys/` is
exempt: there the chain is the behavior.
*Why: one event per scenario means it fails for exactly one reason.*

**B6 · `Given` is a fact, not an action.** *Blocking.*
Present or perfect declarative: "Alice and Bob are friends", "Alice has
blocked Bob", "Alice is a guest who has played 19 puzzles today". Never a
present-tense action ("Alice opens the inbox", "Alice goes to …").
*Why: context describes the world; how it got that way is the step
definition's business.*

**B7 · `When` is one command or event, in the present.** *Blocking.*
A person's intent ("Alice blocks Bob", "Alice tries to sign in with
Google") or something that happens to them ("Alice's billing period ends",
"Alice's connection comes back").
*Why: the When is the command under test; everything else is setup or
outcome.*

**B8 · `Then` is an outcome someone can observe.** *Blocking.*
What a person, or the team from outside, can now see, have, or do; or a
refusal. A refusal under a Rule that illustrates an invariant names the
reason in the language ("is told the daily puzzle limit is reached"). Never
stored state, internal queues or counts, "the database contains", or exact
app copy.
*Why: an outcome nobody can observe isn't product behavior — it is a code
test.*

**B9 · Declarative, not procedural.** *Blocking.*
Every step states intent or a fact a product owner would recognize. Quoted
text is only data a person supplies or names (a note title, a username,
search text) — never the app's own wording. A step that could only be
written by knowing the implementation is wrong.
*Why: procedure and copy change with every redesign; intent does not.*

**B10 · Scenario titles state the outcome.** *Blocking.*
A complete sentence, present tense, naming what happens under the rule
("A blocked person cannot find the blocker"), unique in its context. Never
"Test …", "Case 2", "works", or a procedure ("Alice clicks then …").
*Why: the titles alone should read as the spec's index.*

**B11 · Background only for context every scenario needs.** *Blocking.*
Only `Given` steps, at most four, each used by every scenario under it
(feature- or rule-level). If one scenario does not need it, move the
Background into the `Rule:`s that do, or split the feature. The same
`Given` repeated in every scenario of a rule belongs in a Background
(warning).
*Why: hidden context that some scenarios ignore misleads the reader about
what the rule depends on.*

**B12 · Outlines vary a business dimension.** *Blocking.*
A `Scenario Outline` only when one column is a business dimension that
changes the outcome (a plan, a status, a rating band). An ordered dimension
includes its boundary on both sides (19 and 20 puzzles, not 5 and 12). At
most six rows; more is a property test. A column that varies a gesture, an
error code, or a technical failure mode is not a business dimension.
*Why: a big or technical table is a code test disguised as a spec.*

**B13 · Plausible domain data.** *Blocking.*
Names from the cast, amounts, dates and text a real person would use. Never
foo, bar, baz, test, lorem, a run of one letter (`xxxx`), `user1`, `123`,
or seed values. A number is fine when the rule turns on it (100% accuracy,
20 puzzles).
*Why: placeholder data hides which values matter to the rule.*

**B14 · Reuse phrasings; never coin a second one.** *Blocking.*
Before writing a new step, search the context's features and the step
catalogs ([index](STEPS_CATALOG.md)). If a phrasing already means it, use it
verbatim. A new phrasing with the meaning of an existing one — including
every near-duplicate `spec:check --strict-duplicates` reports — is an error.
*Why: two phrasings of one act split the vocabulary and the step code.*

**B15 · Known tags only.** *Blocking.*
Allowed, and nothing else:

| Tag | Where | Meaning |
| --- | --- | --- |
| `@domain:<dir>` | feature line, required | the bounded context; equals the directory |
| `@goal:<section>:<n>` | feature or scenario | proves a [`GOAL.md`](GOAL.md) statement |
| `@regression:<bug-id>` | scenario | pins an observable bug in `known-bugs.json` |
| `@production`, `@oauth-relay`, `@observability`, `@browser` | scenario, live domains only | where a live run takes it |

Aggregate and kind (command, invariant, event, policy) are never tags: the
coverage map (C) derives them from the Quint model and the `Rule:`.
*Why: tags select runs; a tag nobody reads is a claim nobody checks.*

**B16 · Brief.** *Blocking over 8 steps (the gate); warning over 5.*
*Why: a long scenario is a script or several rules.*

**B17 · Behavior only.** *Blocking.*
A rule nobody outside the code could observe — a formula's exact output, a
validation table, a sync invariant, a stored row, a wire shape — is not a
scenario. It goes to the home "What belongs in a spec" gives it
([policy](SPEC_DRIVEN_DEVELOPMENT.md#what-belongs-in-a-spec)).
*Why: a spec that tests internals breaks on refactors and still says nothing
about the product.*

## C. Coverage — each aggregate is complete

The coverage map is built per aggregate (Quint model) from the model and the
features of its context. An **illustrating scenario** for a model name is one
whose step uses the glossary term whose `model` lists that name.

**C1 · Every command has a happy path.** *Blocking.*
Each command has a scenario whose `When` uses its term and whose `Then` is
not a refusal.
*Why: a command with no example is a command nobody agreed on.*

**C2 · Every invariant is shown enforced.** *Blocking.*
Each `inv<Name>` is illustrated by a `Rule:` whose scenarios include the
attempt most likely to break it, ending in a refusal with a domain reason;
or, if no command can break it (the rule's `No counter-example:` line says
why), the scenario where it is most at risk, showing it hold.
*Why: an invariant only stated in Quint is invisible to the people it
protects.*

**C3 · Every domain event is raised.** *Blocking.*
Each variant in the context's `events.qnt` is illustrated by a `Then` of a
scenario in its own context.
*Why: what a context publishes, it must show happening.*

**C4 · Every transition, legal and illegal.** *Blocking.*
For each status type a model's person can see (a sum type such as
`FriendshipStatus` or `MembershipStatus`), every transition some command
makes has a scenario, and every command a person can attempt from a status
the command's guard excludes has a refusal scenario.
*Why: the transitions nobody wrote are where the bugs live.*

**C5 · Every policy reacts.** *Blocking.*
For each upstream event a downstream context reacts to (the context map's
relationships, through a borrowed term that models the event), the
downstream context has a scenario whose `Given` or `When` is that event, in
borrowed terms, and whose `Then` is the reaction.
*Why: integration is where two correct contexts produce a wrong product.*

**C6 · Features and model agree.** *Blocking.*
A command, invariant or status a feature illustrates exists in the
context's model; a context with behavior but no model is reported
`unmodelled` (warning). `specs/health/` and `specs/journeys/` hold promises
and journeys, not aggregates, and are exempt from C.
*Why: the model is the map; features the map doesn't know are unaccounted
for.*

The coverage map has this shape, one per aggregate (rows illustrative):

```text
friends / friendship.qnt
| Kind       | Model name             | Term              | Illustrated by                                            | Status  |
| command    | block                  | block someone     | friend-block.feature:10 Blocking a friend ends …           | covered |
| invariant  | invBlockedCannotFind   | —                 | friend-block.feature:16 A blocked person cannot find …     | covered |
| event      | FriendshipEnded        | friendship        | friend-remove.feature:9 …                                  | covered |
| transition | Friend → Blocking      | block someone     | friend-block.feature:10                                    | covered |
| illegal    | ask while Hidden       | friend request    | —                                                          | MISSING |
| policy     | SpaceEnded → live mark | live friend       | friends-live-space.feature:14 …                            | covered |
```

## D. Decoupling

**D1 · Feature text survives any rewrite.** *Blocking.*
Nothing in a `.feature` or `.qnt` changes if the product is rewritten in
another language, framework, database or host. No file paths, package names,
or code identifiers appear in specs.
*Why: the spec is the contract the rewrite is checked against.*

**D2 · Steps bind through the sim, this repo's port.** *Blocking.*
A step definition for a sim domain (`specDomains`) calls only exported
actions and reads of a package's `sim/` (`@libs/<pkg>/sim/…`,
`@pkgs/<pkg>/sim…`, `@pkgs/<name>-sim`), the harness (`@libs/sim-harness…`,
`@pkgs/sim`, `@pkgs/gherkin…`), the package's own step helpers, another
package's exported `steps/`, and types and decided constants from a package's
public entry point (`@libs/<pkg>/public/…`, a `@pkgs/<pkg>` root,
`/shared` or `/interface` export). No selectors, test IDs,
DOM, HTTP, SQL or storage clients, and no `src/`, `server/`, `client/` or
`use-cases/` imports. Live domains bind through `apps/product/tests/steps/`
(the live world), marked `// @io-wall-ok`.
*Why: the sim is the one place that knows the UI and wiring; steps above it
stay true when either changes, and the same wording runs against a live
deployment.*

**D3 · Steps hold no product logic.** *Blocking.*
One sim call or a short fixed sequence. `Given` builds state (a precondition
guard may throw), `When` performs the one event with no assertion, `Then`
observes and asserts. No branching on product rules, no loops computing
expected values, no step calling another step's text. Expected values come
from the scenario or a decided constant.
*Why: logic in glue is an untested second implementation.*

**D4 · One composition point.** *Blocking.*
Each package that runs a domain wires its world in one place — its
`tests/steps/index.ts` and the world it registers (`tests/steps/world.ts`,
or the harness world) — and nothing in `specs/` refers to it.
*Why: one seam to swap fakes for real adapters, and none leaking into the
spec.*

**D5 · Deterministic.** *Blocking.*
Sim steps run on virtual time (`w.s.until`), never sleep, `setTimeout` or the
wall clock; no skipped, pending or retried steps. A step the host cannot
perform throws `hostLimit(reason)`.
*Why: a spec that passes by luck proves nothing.*

**D6 · Bindings speak the model's language.** *Blocking.*
A Quint binding's `actions` and `observe` keys are the model's action and
variable names.
*Why: the binding is the model's translation, not a second vocabulary.*

## P. Process

**P1 · Spec text changes only in `spec:` commits.** *Blocking.*
A `spec:` commit touches only `specs/**` and docs; no other commit touches
`specs/**` (`bun run spec:ownership`).
*Why: the person approving behavior reviews exactly the behavior.*

**P2 · The implementer never edits specs.** *Blocking.*
A spec that cannot be implemented as written goes back to `spec-upsert` with
the scenario, the problem in product words, and a suggested wording.
*Why: whoever makes a test pass must not also choose what it checks.*

**P3 · Red before green.** *Blocking.*
Every new or reworded scenario is run and seen failing — undefined or
failing on its `Then`, never on a compile or setup error — before its steps
or product code are written.
*Why: a spec never seen failing may not test anything.*

**P4 · Demotion keeps every guard.** *Blocking.*
A scenario removed because it is not behavior (B17) is replaced first by a
code test that is seen failing when the behavior breaks; its `@goal` proof
moves to `goal-checks.json` as a `test` proof and its `@regression` to an
example test marked `// regression: <id>`, in the commit before the `spec:`
commit that removes it.
*Why: cleaning up specs must never quietly drop coverage.*
