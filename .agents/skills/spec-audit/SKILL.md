---
name: spec-audit
description: Audit Gherkin features, Quint models and step definitions against docs/SPEC_STANDARDS.md — every rule a named check with evidence, a report per feature, a coverage map per aggregate, and a pass/fail verdict — with a fix mode limited to safe mechanical edits. Use for spec reviews, after every spec-upsert, before merging spec changes, on spec:check failures, or to find scenarios that should be code tests.
---

# Spec audit

You check specs against [`docs/SPEC_STANDARDS.md`](../../../docs/SPEC_STANDARDS.md)
and report what breaks it, with evidence. You never argue a finding away:
a blocking finding fails the audit, whoever wrote the spec and however old
it is. The rules and their whys are in the standard; this skill says how to
detect each one.

## Modes

- **report** (default): read, check, report. Edits nothing.
- **fix**: report, then apply only the mechanical fixes in § Fix mode, in a
  `spec:` commit (P1), then re-run the audit and report again. Everything
  else stays report-only and goes to `spec-upsert` or `spec-implement`.

## Scope

What you were asked for: files, one context, or all of `specs/`. When run
by `spec-upsert`, the touched files plus the full coverage map of each
aggregate they touch. For a whole-tree audit you may compute the mechanical
checks with a throwaway script in your scratchpad (never committed, never
new repo tooling).

## Procedure

1. **Gate.** Run `bun run spec:check --strict-duplicates` and map every line
   to a check ID below (the "Gate" column). Undefined steps in a
   freshly written `spec:` commit are the implementer's handoff, not a
   finding; everything else is. First `grep -rl '^<<<<<<< ' specs`: a file
   with conflict markers makes every result unreliable — stop and report
   it. If the gate fails only on files outside your scope, the verdict is
   INCOMPLETE, never PASS.
2. **Load the language.** For each context in scope: its
   `ubiquitous-language.yml`, the glossaries it borrows from, and the kernel.
   Build the word list: every `term` and every `forms` entry, each with its
   glossary path.
3. **Per feature, run every check** in the table, top to bottom. Record each
   finding with its evidence (§ Evidence).
4. **Per aggregate, build the coverage map** (§ Coverage map).
5. **Steps.** For each package that runs a domain in scope, run the D
   checks over its `tests/steps/**` and `tests/quint/**`.
6. **Report** (§ Report) and give the verdict.

## Checks

M = mechanical (do exactly this); J = judgement (cite the evidence named).

| ID | Sev | How | Gate |
| --- | --- | --- | --- |
| A1 | block | M: build the set of every term and form in **all** glossaries; any prose word in that set must resolve in this context's language (own, borrowed with the lender's forms, kernel), allowing slots and split terms (standard A1). J: other nouns naming something the product keeps or shows. Cite the word, the line, and the glossaries searched. Report a glossary gap (a short name missing from `forms`) once per term, not per use. | — |
| A2 | block | M. Any `avoid` entry of **this** context's language, whole-word, in the same prose. J: any other stand-in for an existing term — cite both words. | yes |
| A3 | block | M. Diff the glossary against the base branch: every added term must be named in the `spec:` commit body as confirmed by the person. | — |
| A4 | block | M. A term defined in another context used without a `from:` borrow, or borrowed but not `published: true` there; a `.qnt` import other than `./events` / `../<d>/events`. | yes |
| A5 | block | M. Case-insensitive whole-word search of all prose for the A5 list and its inflections (requests, reconnecting), after removing glossary terms and forms that contain the word ("friend request" is not HTTP; "reconnects" is a rooms form). J: drop plain-English idioms ("in a row"). | partly |
| A6 | block | M. Each step's subject is a cast name, `I`/`me`/`my`, `the user`, `the system`, or a glossary term. Flag the middle three, and any subject that is none of these. | partly |
| B1 | warn | J. Title is a capability phrase, not "Tests …", a file or component name. | — |
| B2 | block | M. The description's first sentence matches `When …, … want(s) …, so …`. No description at all is also B2. | partly |
| B3 | block | M. Every `Scenario`/`Scenario Outline` is inside a `Rule:`. | — |
| B4 | block | M. Each `Rule:` has a scenario whose `Then` has a refusal marker (the closed list in the standard's "Terms") and one whose `Then` has none — or its description's first line starts `No counter-example:`. J: that the stated why is true. Skip live domains. | — |
| B5 | block | M. Count `When` plus `And`/`But` between the `When` and the first `Then`: must be exactly 1. Flag any `When` after a `Then`. Skip live domains. | partly |
| B6 | block | M. Flag a `Given`/`And` in context whose verb after the subject (a cast name, "the team", a role) is a present-simple action (opens, goes, plays, declares, writes, signs in), or that uses "will". J: confirm it is an action, not a state ("is", "has", "are friends", "already signs into"). | — |
| B7 | block | M. A `When` containing " and " between two verbs, or a count of repetitions ("10 … a day for 3 days"). J: the `When` is one command or event in the present, not a look after the behavior happened in `Given`s. | — |
| B8 | block | M. `Then` steps with storage, count-of-internals or copy wording (A5 list, "accepted N changes", "waiting to be sent", quoted app text). M: under a Rule that illustrates an invariant, each refusal names a reason. | partly |
| B9 | block | M. Quoted text in a step that is not something a person supplies or names (note title, username, search text) — i.e. app copy. J: a step that needs implementation knowledge; cite what it assumes. | — |
| B10 | block | M. Title starts with "Test", "Case", "Check", contains "should", or has no verb. Unique per context. | uniqueness |
| B11 | block | M. Background has a non-`Given` step or more than 4 steps. J: a scenario that never relies on a Background step — cite it. Warn when every scenario of a rule (two or more) or of the feature opens with the same `Given`. | — |
| B12 | block | M. Outline with more than 6 rows. J: the varied column is not a business dimension (gesture, error kind, technical failure); an ordered dimension without both sides of its boundary. | — |
| B13 | block | M. Values matching `foo|bar|baz|lorem|test|user\d|seed`, a run of one repeated letter, or `123`/`1234` or a person not in the cast. | — |
| B14 | block | M. Every near-duplicate `spec:check --strict-duplicates` reports; every pair of step definitions whose bodies are identical (across all packages). J: two phrasings with one meaning — cite both definitions. | warns |
| B15 | block | M. Any tag not in the B15 table; a live-run tag outside `specs/health/` and `specs/journeys/`; a `@domain` that isn't the directory. | domain, goal |
| B16 | warn/block | M. Steps per scenario (Background included): > 5 warn, > 8 block. | > 8 |
| B17 | block | J. A scenario whose outcome only code could observe: exact formula output, validation table, stored state, wire shape, internal counts, transport state. Cite the step and the home the policy table gives it. | — |
| C1–C6 | block | § Coverage map. | — |
| D1 | block | M. File paths, package names, code identifiers in `.feature`/`.qnt` prose. | — |
| D2 | block | M. In `tests/steps/**` and `tests/quint/**` of a harness package: imports other than the D2 allow-list (`node:*` included); `data-testid`, CSS selectors, `querySelector`, `page.`, `fetch(`, SQL or storage clients. J: a public-entry import used for more than types and decided constants. | — |
| D3 | block | M. Step and binding bodies with `if`/`switch`/`for`/`while`/`.map(` over product values, `expect` in a `Given`/`When`, a step invoking another step's text. J: an `expect` in a `Given` is fine only if it reads the state that `Given` just built; a branch is fine only if it picks a harness path, not an expected value. Live-world loops over environments are not product logic. | — |
| D4 | block | M. More than one world/registration entry per package; anything under `specs/` naming a `tests/` file. | — |
| D5 | block | M. `setTimeout`, `sleep`, `Date.now`, `new Date(` in harness steps; skipped, pending or retried steps. | pending |
| D6 | block | M. Binding keys that are not the model's action/variable names. | unbound |
| P1–P2 | block | M. `bun run spec:ownership`. | yes |

The gate's other failures (ambiguous or unused steps, stale catalogs,
unknown `@goal`) are blocking and reported under the nearest ID (B14, D4,
B15).

## Coverage map

For each Quint model in scope (skip `specs/health/`, `specs/journeys/`):

1. **Commands and world events**: every `action` except `init`, `step` and
   `_…`. Classify each (standard, "Terms"; J, cite its `///` comment). Find
   the glossary term whose `model` lists it. C1 is met by a scenario whose
   `When` uses that term (or its forms) and whose `Then` has a non-refusal
   step. A world event no person observes on its own is `model-only`.
2. **Invariants**: every `val inv<Name>`. Read its `///` comment and body.
   Observable → C2 is met by a scenario (under any `Rule:` or none) that
   attempts to break it and ends in a refusal (B8), or shows it holding
   where it is most at risk. Bookkeeping → `model-only`. (J)
3. **Events**: every variant in the context's `events.qnt`; find the term
   whose `model` lists it (or its type). C3 is met by a `Then` using it.
4. **Transitions**: for each status (standard, "Terms" — sum type, listed
   `str` values, or `bool`), read each command's guard and assignments: list
   `from → to` per command (legal) and each excluded status where a person
   can still attempt it (illegal; standard C4). C4 needs a scenario per legal
   row and a refusal per illegal row. (J — cite the guard's line in the
   `.qnt`.)
5. **Policies**: from `docs/CONTEXT_MAP.md` "Relationships", for each
   relationship where this context is downstream, list the upstream's
   `events.qnt` variants it implies. C5 needs a scenario here whose `When`
   is that event, or whose `Given` states it as a fact, and whose `Then` is
   the reaction. A relationship without the borrowed terms to say it is also
   A4.
6. **Unmapped**, once per context: every `When` whose term no model of the
   context names (borrowed terms count when the lender's model names them),
   and every scenario that contradicts a model's guard, is C6. A context
   with features but no `.qnt` is reported `unmodelled` (warning).

Write the map as the standard's table, one per aggregate, every row
`covered` with its `file:line`, `model-only` with its `///` line, or
`MISSING`.

## Evidence

Every finding is one line:

```text
<ID> <block|warn> specs/<domain>/<file>.feature:<line> — "<offending text>" — <what is wrong> [— checked: <glossary paths> | rule: <Rule line> | model: <file>:<line>]
```

A judgement finding also says why, in one clause ("'app is still
connected' is transport state no person observes").

## Report

```text
# Spec audit — <scope> — <date>
Verdict: FAIL (<n> blocking, <m> warnings) | INCOMPLETE (<why>) | PASS (<m> warnings)

## Per feature
### specs/<domain>/<file>.feature — <n> blocking, <m> warnings
<findings, one per line, in line order>

## Coverage
<one map per aggregate>

## Steps
<D findings per package>

## Summary
| Check | Blocking | Warnings | Worst file |

## Triage
<per scenario with a blocking finding: rewrite | split | demote | delete, and who owns it>
```

**Pass** means zero blocking findings in scope, including zero `MISSING`
coverage rows and a green `spec:check --strict-duplicates`. **Incomplete**
means a check could not run (conflict markers, a gate failure outside scope);
it is not a pass. Nothing else is
a pass: not "pre-existing", not "out of scope for this change" when the
file is in scope, not "the gate didn't catch it".

## Triage

For each scenario with a blocking finding, name the outcome and the owner:

| Outcome | When | Owner |
| --- | --- | --- |
| Rewrite | behavior, badly worded or shaped | `spec-upsert`, then `spec-implement` rebinds |
| Split | several rules or events in one scenario | `spec-upsert` |
| Demote | B17: not behavior | `spec-implement` (§ Demote), then `spec-upsert` removes it |
| Delete | duplicate, or proves nothing observable, with no goal/regression tie | `spec-upsert` |
| Add | a `MISSING` coverage row | `spec-upsert` |

A call that depends on product intent (is this really something the team
observes?) is a question for the person, listed at the end of the report.

## Fix mode

Only these edits, each only when the result is unambiguous; anything else
stays in the report.

1. **Term casing**: a word matching a glossary term except for case →
   the glossary's casing (`plus member` → `Plus member`).
2. **Tag normalisation**: `@domain` moved to the feature line and made equal
   to the directory; duplicate tags removed; tag case fixed to the B15 table.
   Never add or remove a `@goal` or `@regression`.
3. **Phrasing dedupe**: a step whose text differs from a catalogued phrasing
   only in whitespace, punctuation or letter case → the catalogued phrasing.
   A dedupe that makes an old definition unused is handed to
   `spec-implement` to delete.
After fixing: re-run `bun run spec:check --strict-duplicates` and the full
audit; the report shows before and after counts.
