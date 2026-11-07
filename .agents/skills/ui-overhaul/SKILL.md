---
name: ui-overhaul
description: Polish an app's existing UI with minimal disruption, in rounds judged by an Agent Council of user-chosen reviewers. Each round captures before and after screenshots of full-screen Storybook stories, improves typography, spacing, alignment, contrast, hierarchy, focus visibility and consistency, gets independent design and UX ratings from every member, and posts the round as a PR comment. Navigation, screen composition, control placement, labels and task steps never change. The loop repeats until every member rates both design and UX at or above the user's minimum on the same revision. Use for /ui-overhaul, "polish the UI", "UI quality pass", or "get the UI to 9/10 with the council". For moving controls, rewriting labels or redoing flows, use ui-ux-overhaul instead.
---

# UI overhaul

Polish the existing UI until every user-selected council member rates both design and UX at or
above the user's minimum on one revision. The loop is: capture before → improve in Storybook →
capture after → council ratings → PR comment → repeat.

The steps below are host-neutral. `hosts.md` gives the commands for each agent, code host and
repository. `$SKILL_DIR` is this directory.

| File                           | Use                                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `council-review-prompt.md`     | The fixed rubric and question every member receives                                             |
| `pr-round-comment-template.md` | Opening, round, blocked and final PR comments                                                   |
| `scripts/council-round.mjs`    | `init`, `manifest`, `prompt`, `verdict`: run record, evidence IDs, question file, stopping rule |
| `scripts/validate.mjs`         | Self-test of the stopping rule (unanimous pass, below threshold, missing reviewer)              |
| `hosts.md`                     | Commands per agent, code host and repository                                                    |

## Scope: what this skill may change

Allowed: typography (scale, weight, line height, measure), spacing and alignment, color and
contrast (WCAG 2.2 AA for text and non-text), visual hierarchy, visible keyboard focus,
consistency across screens (shared tokens and components), and polish (clipping, overlap,
truncation, empty-space balance) at every viewport.

Preserved: navigation and routes, which screens exist and what each contains, where every
control sits and its order, every label and message, and every task's steps. A fix that needs
one of these is out of scope. Record it under "Next fixes" as a ui-ux-overhaul candidate and do
not make it. Default PR title: **UI quality overhaul**.

## 0. Start the run

1. Read the **council roster** and the **minimum rating out of 10** from the invocation (e.g.
   "Use Claude and Codex. Both must give design and UX at least 9/10."). If either is missing, ask
   for it and do not start. Agent Council can seat only `claude`, `codex` and `gemini`. If the
   roster names anyone else, say so and ask for a supported roster.
2. Resume or open the PR. Look for an open PR whose comments contain `<!-- ui-overhaul:run -->`.
   - Found: read every `<!-- ui-overhaul:… -->` comment in order and rebuild `.ui-overhaul/run.json`
     and the last round's `round.json` from their hidden blocks. Continue from the last round's
     state: rerun an INCOMPLETE round, start round n+1 after ANOTHER_ROUND, stop after a final
     comment. If the invocation's roster or minimum differs from the recorded run, ask whether
     the user means to change it. Change it only on an explicit yes, then start a new baseline.
   - Not found: branch from the trunk, open a draft PR titled "UI quality overhaul" (or the
     user's title), and continue.
3. Keep working state in a git-ignored evidence root inside the repository (default
   `.ui-overhaul/`; add it to `.git/info/exclude`). Council members must be able to open its
   files by relative path.
4. Record the run: `node $SKILL_DIR/scripts/council-round.mjs init --skill ui-overhaul --roster <a,b,c> --minimum <n> --product "<one-line description>" --out .ui-overhaul/run.json`.
   It refuses an empty or unsupported roster and a missing minimum. It also records the rubric's
   hash: from then on the roster, minimum and rubric are fixed, and a round run under anything
   else is INCOMPLETE.
5. Preflight the council (`hosts.md` → Agent Council): find the runtime, check that every roster
   CLI is installed and authenticated, and raise timeouts for long visual reviews. A roster member
   that cannot run is a blocker: post the blocked comment (template 3) and stop.
6. Post the opening comment (template 1): roster, minimum, rubric hash, scope, primary journeys,
   and the screens and states under review.

## 1. Establish the scored baseline (round 0)

1. **Walk the primary journeys in the running app**: every screen each journey touches, plus its
   loading, empty, error, success and long-content states. Note which viewports and themes the
   app supports.
2. **Map each screen to Storybook.** If Storybook is absent, set it up with the repository's
   framework, its real providers, theme and global styles. Then **upsert full-screen stories**:
   - Update an existing story that already covers a screen or state, and keep its title and
     export name (its story ID) where practical. Add a story for each missing screen or meaningful
     state.
   - Use production components inside the real app shell (navigation chrome, layout, theme
     provider). Use realistic, deterministic fixtures: fixed dates and IDs, seeded data, mocked
     network at the boundary, no randomness. Use full-screen layout and the representative
     viewports (at least one phone and one desktop when the app has both) and themes.
   - Compare each story with the running app at the same viewport and theme, and fix every
     fidelity gap (missing chrome, wrong fonts, different data shape) before capturing. A story
     that does not look like the app gives the council false evidence.
3. **Capture the baseline** into `.ui-overhaul/evidence/r0-<sha7>/`: one image per story ×
   viewport × theme, plus an interaction log per journey (each step: the action, what the screen
   showed, a screenshot). Write `index.md` listing every file with its screen, state, viewport,
   theme and story ID. Run `council-round.mjs manifest --dir <that dir> --round 0 --sha <sha>`.
   It prints the evidence ID, which is the hash of every file.
4. **Write `.ui-overhaul/rounds/0/round.json`** (fields below) with `kind: "baseline"` and
   `startSha: null`. Then `council-round.mjs prompt --run … --round … --out .ui-overhaul/rounds/0/question.txt`.
5. **Convene the council** with the Agent Council skill on that question (`hosts.md` gives the
   dispatch). Every member answers independently in its own process. Do not use peer review.
6. `council-round.mjs verdict --run … --round … --session "$SESSION_DIR" --format markdown`, then
   post the baseline as a round comment (template 2): screenshots, each member's ratings and
   findings. These are the before scores and evidence for round 1. A baseline that already passes
   ends the run with a final comment.

## 2. Run an overhaul round (n = 1, 2, …)

1. **Choose the fixes.** Start from the last scored revision. From its findings, pick the
   highest-impact fixes this skill's scope allows. Give priority to anything holding a member
   below the minimum, then deductions several members share. Name the exact screen, state or
   journey step each fix addresses, and the finding it answers.
2. **Work in Storybook.** Open or upsert the full-screen stories that show those issues. Change the
   production components and tokens through them, never a story-only copy. Add states and
   interaction coverage (play functions, keyboard paths) as gaps show up, and walk the affected
   journeys in the running app to confirm the fix is real there too.
3. **Run the checks** that matter to the change on the candidate commit: formatting, lint,
   types, unit and story tests, an accessibility scan of the touched stories, and the repository's
   own gates (`hosts.md`).
   Then run the **scope audit**: read the diff from the start revision and confirm no route,
   navigation item, screen section, control position or order, label or message text, or task
   step changed. Record `scopeRespected` and the reason.
4. **Commit and push the candidate**, then capture before and after:
   - After: `.ui-overhaul/evidence/r<n>-<sha7>/`, with the same stories, data, viewports and themes.
   - Before: reuse the previous round's after evidence when it is the same start revision and the
     story set has not grown. When stories were added, render the start revision in a temporary
     checkout with only the new story and fixture files copied in, so both sides show the same
     data. Directory names carry the commit, so a later push never overwrites earlier evidence.
   - For each changed screen, make one readable pair: same crop and scale, before left and after
     right. Run `manifest` on both directories.
5. **Write `round.json`** and render the question. Set `rescoreBefore: true` when the previous
   round's ratings do not apply: the start revision differs from the last scored candidate, or the
   before evidence set grew. Otherwise carry the previous round's after scores into
   `carriedBefore`.
6. **Convene the council again** on the new question. Every member gets the same candidate
   commit, screenshot set and interaction logs, and each returns design and UX scores with cited
   deductions and a top fix.
7. **Decide**: `council-round.mjs verdict … --format markdown`. Exit 0 is PASS, 2 is ANOTHER_ROUND,
   3 is INCOMPLETE.
8. **Post one complete round comment** (template 2): round number, before and after SHAs, what
   changed, Before / After images visible in the comment with story IDs, the ratings table exactly
   as `verdict` printed it, each member's findings, check results, the verdict, and next fixes.
   Post it for failed and incomplete rounds as well, and never edit an earlier one.
9. **Continue.** After ANOTHER_ROUND, start round n+1 from this candidate. After INCOMPLETE, fix the
   cause (preflight, timeout, unreadable image) and rerun the whole council on the **same**
   candidate and evidence, with up to two retries. After that, post a blocked comment (template 3)
   saying exactly what is needed to resume. After PASS, post the final comment (template 4).
   Keep running rounds autonomously. Stop only for PASS, a blocker, or the user.

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
  "evidenceDir": ".ui-overhaul/evidence/r1-<sha7>",
  "beforeDir": ".ui-overhaul/evidence/r0-<sha7>",
  "journeys": ["<journey>"],
  "screens": ["<Screen / state>"],
  "changes": "<one paragraph>",
  "rescoreBefore": false,
  "carriedBefore": {
    "fromRound": 0,
    "sha": "<startSha>",
    "evidenceId": "<beforeEvidenceId>",
    "scores": { "<member>": { "design": 7, "ux": 7.5 } }
  },
  "checks": [{ "name": "<check>", "status": "pass|fail|not-run", "url": "<link>" }],
  "scopeRespected": true,
  "scopeNotes": "<what the audit compared>"
}
```

## Stopping rule

A revision **passes** only when all of these hold on that same candidate commit and evidence set:

- every roster member returned a review that names that candidate and evidence ID,
- each of them gave **design ≥ minimum and UX ≥ minimum**,
- every relevant check passed (a check not run is not a pass),
- the scope audit passed and no member reported a scope violation.

`verdict` enforces this. Never average across members, add up passing votes from different
revisions or sessions, drop a reviewer, lower the minimum, or edit the rubric mid-run. With a
9/10 minimum, a member who gives design 10 and UX 8 means another round. A missing review makes
the round INCOMPLETE, never a pass. Every score comes from a member's own opinion file after it
inspected the evidence. Never write, estimate or adjust one, even when you are a roster member
yourself.

Run `node $SKILL_DIR/scripts/validate.mjs` after changing anything in this package. It must
report every case as expected: only unanimous passage finishes.
