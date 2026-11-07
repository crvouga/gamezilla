---
name: ui-ux-overhaul
description: Redesign an app's whole experience (layout, controls, screen organization, labels and flows), in rounds judged by an Agent Council of user-chosen reviewers, wherever observed friction calls for it. Each round captures before and after screenshots and flow sequences from full-screen Storybook stories and the running app, makes the redesign in production components, proves every underlying user task still completes, gets independent design and UX ratings from every member, and posts the round as a PR comment. The loop repeats until every member rates both design and UX at or above the user's minimum on the same revision. Use for /ui-ux-overhaul, "redesign the app", "fix the UX", "rework this flow", or "get design and UX to 9/10 with the council". For a low-disruption visual polish that keeps every screen, control and label in place, use ui-overhaul instead.
---

# UI and UX overhaul

Redesign the experience until every user-selected council member rates both design and UX at
or above the user's minimum on one revision. The loop is: capture before → improve in Storybook
→ capture after → council ratings → PR comment → repeat.

The steps below are host-neutral. `hosts.md` gives the commands for each agent, code host and
repository. `$SKILL_DIR` is this directory.

| File                           | Use                                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `council-review-prompt.md`     | The fixed rubric and question every member receives                                             |
| `pr-round-comment-template.md` | Opening, round, blocked and final PR comments, with flow sequences and task completion          |
| `scripts/council-round.mjs`    | `init`, `manifest`, `prompt`, `verdict`: run record, evidence IDs, question file, stopping rule |
| `scripts/validate.mjs`         | Self-test of the stopping rule (unanimous pass, below threshold, missing reviewer)              |
| `hosts.md`                     | Commands per agent, code host and repository                                                    |

## Scope: what this skill may change

Everything ui-overhaul may change, plus the structure of the experience: control placement
and order, screen composition, merging, splitting or reordering screens, navigation, labels,
messages and microcopy, and the steps of a flow. Each structural change must answer friction
observed in the evidence: a council finding, a confusing or slow journey step, an error-prone
input. Name that friction in the round comment.

Two constraints hold for every change. First, every **underlying user task** from the baseline
must still be completable in the revised app, shown in the running app and not only in
Storybook. Second, behavior the product promises (data, permissions, server contracts) does not
change. If the repository keeps executable specs, update them with the flow change. Default PR
title: **UI and UX overhaul**.

## 0. Start the run

1. Read the **council roster** and the **minimum rating out of 10** from the invocation (e.g.
   "Use Claude, Codex and Gemini. Every member must give design and UX at least 9/10."). If
   either is missing, ask for it and do not start. Agent Council can seat only `claude`, `codex`
   and `gemini`. If the roster names anyone else, say so and ask for a supported roster.
2. Resume or open the PR. Look for an open PR whose comments contain `<!-- ui-ux-overhaul:run -->`.
   - Found: read every `<!-- ui-ux-overhaul:… -->` comment in order and rebuild
     `.ui-ux-overhaul/run.json` and the last round's `round.json` from their hidden blocks.
     Continue from the last round's state: rerun an INCOMPLETE round, start round n+1 after
     ANOTHER_ROUND, stop after a final comment. If the invocation's roster or minimum differs from
     the recorded run, ask whether the user means to change it. Change it only on an explicit yes,
     then start a new baseline.
   - Not found: branch from the trunk, open a draft PR titled "UI and UX overhaul" (or the user's
     title), and continue.
3. Keep working state in a git-ignored evidence root inside the repository (default
   `.ui-ux-overhaul/`; add it to `.git/info/exclude`). Council members must be able to open its
   files by relative path.
4. Record the run: `node $SKILL_DIR/scripts/council-round.mjs init --skill ui-ux-overhaul --roster <a,b,c> --minimum <n> --product "<one-line description>" --out .ui-ux-overhaul/run.json`.
   It refuses an empty or unsupported roster and a missing minimum. It also records the rubric's
   hash: from then on the roster, minimum and rubric are fixed, and a round run under anything
   else is INCOMPLETE.
5. Preflight the council (`hosts.md` → Agent Council): find the runtime, check that every roster
   CLI is installed and authenticated, and raise timeouts for long visual reviews. A roster member
   that cannot run is a blocker: post the blocked comment (template 3) and stop.
6. Post the opening comment (template 1): roster, minimum, rubric hash, scope, primary journeys
   with the **underlying task** each serves (the user's goal, not today's screens), and the
   screens and states under review.

## 1. Establish the scored baseline (round 0)

1. **Walk the primary journeys in the running app.** For each journey, record its underlying
   task, every step and screen, its loading, empty, error, success and long-content states, and
   the friction you see: dead ends, unclear labels, extra steps, hidden controls, error-prone
   inputs. Note the supported viewports and themes.
2. **Map each screen to Storybook.** If Storybook is absent, set it up with the repository's
   framework, its real providers, theme and global styles. Then **upsert full-screen stories**:
   - Update an existing story that already covers a screen or state, and keep its title and
     export name (its story ID) where practical. Add a story for each missing screen or meaningful
     state, and one per journey step when a flow is under review.
   - Use production components inside the real app shell (navigation chrome, layout, theme
     provider). Use realistic, deterministic fixtures: fixed dates and IDs, seeded data, mocked
     network at the boundary, no randomness. Use full-screen layout and the representative
     viewports and themes.
   - Compare each story with the running app at the same viewport and theme, and fix every
     fidelity gap before capturing.
3. **Capture the baseline** into `.ui-ux-overhaul/evidence/r0-<sha7>/`: an image per story ×
   viewport × theme, a step-by-step sequence per journey (action, screen, screenshot), and a
   task-completion table (each task, its step count, and whether it completed in the running
   app). Write `index.md` listing every file with its screen, state, viewport, theme and story
   ID, then run `council-round.mjs manifest --dir <that dir> --round 0 --sha <sha>`.
4. **Write `.ui-ux-overhaul/rounds/0/round.json`** (fields below) with `kind: "baseline"` and
   `startSha: null`, then `council-round.mjs prompt … --out .ui-ux-overhaul/rounds/0/question.txt`.
5. **Convene the council** with the Agent Council skill on that question (`hosts.md` gives the
   dispatch). Every member answers independently. Do not use peer review.
6. `council-round.mjs verdict … --format markdown`, then post the baseline as a round comment
   (template 2). These are the before scores and evidence for round 1. A baseline that already
   passes ends the run with a final comment.

## 2. Run an overhaul round (n = 1, 2, …)

1. **Choose the fixes.** Start from the last scored revision. From its findings and the observed
   friction, pick the highest-impact changes: anything holding a member below the minimum first,
   then shared deductions. A structural change (moving a control, merging screens, rewriting a
   label, redoing a flow) is in scope when it addresses a named friction. Name the screen, state
   or journey each change addresses and the finding behind it.
2. **Work in Storybook.** Open or upsert the full-screen stories for every screen and step the
   change touches. Build the new design in production components and routes, never a story-only
   mock. Add stories for new screens and states, and play functions that walk each redesigned
   flow. Then **exercise every affected journey in the running app** end to end.
3. **Run the checks** that matter to the change on the candidate commit: formatting, lint, types,
   unit, story and interaction tests, an accessibility scan, the repository's own gates
   (`hosts.md`), and the specs or end-to-end tests for any flow that changed.
   Then run the **task-completion audit**: for each underlying task, complete it in the running
   app at the candidate and record the steps and the outcome. Any task that no longer completes
   fails the audit (`scopeRespected: false`).
4. **Commit and push the candidate**, then capture before and after:
   - After: `.ui-ux-overhaul/evidence/r<n>-<sha7>/`, with the same data, viewports and themes.
   - Before: reuse the previous round's after evidence when it is the same start revision and the
     story set has not grown. Otherwise render the start revision in a temporary checkout (copy in
     only new fixtures, so the data matches). Directory names carry the commit, so later pushes
     never overwrite evidence.
   - For a changed screen, make one readable before / after pair. For a redesigned flow, show the
     old and new sequences for the same user goal side by side, step by step, even when the step
     counts differ. Run `manifest` on both directories.
5. **Write `round.json`** and render the question. Set `rescoreBefore: true` when the previous
   ratings do not apply (different start revision, or a grown before set). Otherwise carry the
   previous round's after scores in `carriedBefore`. If the redesign brings new screens or
   journeys into review, the scope has grown materially. Capture their before state and set
   `rescoreBefore: true`, so every member rates comparable baselines.
6. **Convene the council again.** Every member gets the same candidate commit, screenshots, flow
   sequences, interaction logs and task-completion table. Each returns design and UX scores with
   cited deductions and a top fix.
7. **Decide**: `council-round.mjs verdict … --format markdown`. Exit 0 is PASS, 2 is ANOTHER_ROUND,
   3 is INCOMPLETE.
8. **Post one complete round comment** (template 2): round number, before and after SHAs, what
   changed and the friction behind it, Before / After images and flow sequences visible in the
   comment with story IDs, the task-completion table, the ratings table exactly as `verdict`
   printed it, each member's findings, check results, the verdict, and next fixes. Post it for
   failed and incomplete rounds as well, and never edit an earlier one.
9. **Continue.** After ANOTHER_ROUND, start round n+1 from this candidate. After INCOMPLETE, fix the
   cause and rerun the whole council on the **same** candidate and evidence, with up to two
   retries. After that, post a blocked comment (template 3) saying exactly what is needed to
   resume. After PASS, post the final comment (template 4). Keep running rounds autonomously.
   Stop only for PASS, a blocker, or the user.

### `round.json`

```json
{
  "round": 1,
  "kind": "round",
  "configSha256": "<from run.json>",
  "startSha": "<last scored candidate>",
  "candidateSha": "<this round's pushed commit>",
  "evidenceId": "<manifest of the after directory>",
  "beforeEvidenceId": "<manifest of the before directory>",
  "evidenceDir": ".ui-ux-overhaul/evidence/r1-<sha7>",
  "beforeDir": ".ui-ux-overhaul/evidence/r0-<sha7>",
  "journeys": ["<journey: underlying task>"],
  "screens": ["<Screen / state>"],
  "changes": "<one paragraph, with the friction each change addresses>",
  "rescoreBefore": false,
  "carriedBefore": {
    "fromRound": 0,
    "sha": "<startSha>",
    "evidenceId": "<beforeEvidenceId>",
    "scores": { "<member>": { "design": 7, "ux": 6 } }
  },
  "checks": [{ "name": "<check>", "status": "pass|fail|not-run", "url": "<link>" }],
  "scopeRespected": true,
  "scopeNotes": "<each underlying task and whether it completed in the running app>"
}
```

## Stopping rule

A revision **passes** only when all of these hold on that same candidate commit and evidence set:

- every roster member returned a review that names that candidate and evidence ID,
- each of them gave **design ≥ minimum and UX ≥ minimum**,
- every relevant check passed (a check not run is not a pass),
- the task-completion audit passed and no member reported a task that can no longer be done.

`verdict` enforces this. Never average across members, add up passing votes from different
revisions or sessions, drop a reviewer, lower the minimum, or edit the rubric mid-run. With a
9/10 minimum, a member who gives design 10 and UX 8 means another round. A missing review makes
the round INCOMPLETE, never a pass. Every score comes from a member's own opinion file after it
inspected the evidence. Never write, estimate or adjust one, even when you are a roster member
yourself.

Run `node $SKILL_DIR/scripts/validate.mjs` after changing anything in this package. It must
report every case as expected: only unanimous passage finishes.
