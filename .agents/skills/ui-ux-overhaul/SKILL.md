---
name: ui-ux-overhaul
description: >-
  Redesign an app's UI and UX in scored rounds until every Agent Council member
  the user chose rates both design and UX at or above the user's minimum. Each
  round captures before screenshots and journeys, improves the experience in
  Storybook, captures after, gets every member's rating and posts the round in
  a PR comment. It may move controls, reorganize screens, rewrite labels and
  redo flows wherever that removes observed friction, and it verifies that
  every primary task can still be completed. Use for a council-judged UX
  redesign, flow overhaul or full experience rework. For polish that keeps
  layout and flows, use ui-overhaul.
metadata:
  prerequisites: "Agent Council (github.com/yogirk/agent-council) with each roster member's CLI signed in; git; a PR host CLI (gh, glab); Storybook; Node 18+ with Playwright in the target repo; Python 3.9+; automated journey tests or a way to add them."
  pr-title: "UI and UX overhaul"
---

# ui-ux-overhaul

Run this loop in the target app's repository until the stopping rule passes:

**capture before → improve the UI and UX in Storybook → capture after → get every council member's rating → post the round in a PR comment → repeat.**

You do the work and keep the record. The council members decide whether the work is good enough. This skill decides nothing by your own judgment of quality.

## Scope

- **May change anything about the experience:**
  - navigation and information architecture;
  - screen composition;
  - control placement;
  - labels and copy;
  - flows and their number of steps;
  - plus everything `ui-overhaul` may polish.
- **Every structural change must address observed friction.** That means a member's finding, or an entry in the friction log taken while walking the app (`F1`, `F2`, …). The round comment ties each change to the friction it removes.
- **Every primary journey's underlying task stays completable** in the revised app, verified by an automated journey check on the candidate revision. No capability a journey needs is removed.
- **Behavior the repository specifies stays specified.** If the repository keeps acceptance specs (Gherkin features, specs/ folders and the like) and a redesign changes specified behavior, the spec changes first, through the repository's own spec process. If you may not make that change, keep the redesign within the spec, or post a blocker.
- The default PR title is **"UI and UX overhaul"**.

## Package

| Path | What it is |
| --- | --- |
| `assets/council-review-prompt.md` | The question every member gets, including the fixed rubric and the journey assessment. |
| `assets/pr-round-comment.md` | The copyable round comment, with the journey before/after table. |
| `assets/pr-run-comments.md` | The opening (with the friction log), baseline, blocked and final comments. |
| `scripts/council-round` | Run state, rating extraction, the stopping rule, comment blocks and resume. `self-test` runs the validation cases. |
| `scripts/capture-stories.mjs` | Storybook screenshots, before/after pairs and journey strips (old and new sequences). |
| `references/hosts.md` | Commands for each agent host, PR host, Storybook and git. Everything host-specific lives there. |
| `tests/fixtures/` | Validation cases for the stopping rule, in Agent Council's real session format. |

`$SKILL`, `$STATE`, `$EVID` and `$K` are defined at the top of `references/hosts.md`.

## Rules that hold for the whole run

1. **Only council members rate.** A rating is a member's Stage-1 opinion from an Agent Council session on the candidate commit and its evidence, extracted by `council-round collect`. Never write, estimate, adjust or carry forward a score yourself. The chairman's synthesis is not a rating.
2. **The roster, minimum and rubric are fixed.** Change them only when the user explicitly asks. Then post the change in the PR and take a new baseline.
3. **Never average, mix or drop.** Never average scores across members. Never combine scores from different revisions. Never drop a member. `council-round decide` enforces all three; do not work around it.
4. **Members never see the target.** The prompt does not state the minimum or any earlier score.
5. **The PR comments are the record.** Post every round, including incomplete and failed rounds. Each comment carries a marker that another agent can resume from.
6. **The repository's rules come first.** Its agent instructions (`AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md` and the like) win wherever they are stricter: how to start servers, test policy, spec process, commit and PR rules, and the design system. Build screens from the repository's production components only.
7. **Keep going.** Ask the user only for missing start inputs or an unsupported member. Otherwise run as many rounds as needed. Stop only on a pass or a blocker. Never merge the PR.

## 1. Start or resume

1. **Read the roster and the minimum from the invocation.** For example: "Use Claude, Codex, and Gemini. Every member must give both design and UX at least 9/10."
   - If either is missing, ask for it before doing anything else. Ask for both in one question if both are missing.
   - Map names to Agent Council members: `claude`, `codex`, `gemini`. If a named agent is not one of these, ask the user before starting; see the Agent Council section of `references/hosts.md`.
2. **Read the repository.** Read its agent instructions, its design-system docs, its acceptance specs for the journeys and its Storybook setup. Find how the app, Storybook and the end-to-end or journey tests run.
3. **Look for an existing overhaul PR** with this skill's run marker (`references/hosts.md` › GitHub).
   - **Found:** resume from it. Run `council-round markers --restore "$STATE"`. If the invocation gives a different roster or minimum, treat that as an explicit change (rule 2). Continue from the last fully scored revision.
   - **Not found:**
     1. Branch, then open a draft PR titled "UI and UX overhaul".
     2. Run `council-round init-run --skill ui-ux-overhaul --roster … --minimum … --journey "<goal>" … --screen … --product … --out "$STATE/run.json"`. The journeys become `J1`, `J2`, … in that order.
     3. Post the opening comment from `assets/pr-run-comments.md`, with its marker. It records the roster, minimum, scope, journeys, and the screens and states under review.

## 2. Baseline (round 0)

1. **Walk every primary journey in the running app.**
   - For each journey, write down every step: the screens, the decisions made and the controls used.
   - Log every point of friction as `F1`, `F2`, …: a hidden action, unclear wording, a dead end, a needless step, a poor recovery from an error.
   - List every in-scope screen and its meaningful states.
   - Running the app is for discovery and fidelity. The checks that gate the run are automated.
2. **Upsert full-screen stories** for every screen and state on the journeys.
   - Where a story already covers the screen, update it and keep its id. Otherwise add a story.
   - Every story uses production components, the real app shell and theme, realistic deterministic fixtures, and representative viewports.
   - If Storybook is absent, set it up (`references/hosts.md` › Storybook).
3. **Check fidelity.** Compare each story against the running app with the same data, viewport and theme, and fix every gap.
4. **Make each journey's task checkable.** Find the automated test that completes each `Jn` (end-to-end, journey or story interaction test). Where none exists, add one that completes the task through the UI, the repository's way. It must pass on the baseline.
5. **Commit.** That commit is the baseline revision.
6. **Capture** the screens into `$EVID/round-0/after/`, each journey's current sequence into `journeys/Jn.png` (`capture-stories.mjs journey`, before frames only), and the journey test output into `interactions/`.
7. **Convene the council** (§3) with `--kind baseline`.
8. **Post the baseline comment.** It includes the screenshots, the journey strips, the friction log, every member's ratings and findings, and the round-1 plan. This is the "before" evidence for round one.

If the baseline already passes the stopping rule, post the final comment. Tell the user that no change was needed.

## 3. Convene the council (every round, including the baseline)

1. Commit and push the candidate. Leave no tracked changes. Members must see exactly this commit.
2. Open the round:

   ```bash
   council-round manifest --run "$STATE/run.json" --round $K --kind round \
     --start-sha <last scored revision> --candidate-sha $(git rev-parse HEAD) \
     --evidence "$EVID/round-$K" --before-manifest "$EVID/round-$((K-1))/manifest.json" \
     --story <id> … --repo "$REPO" --out "$STATE/round-$K/round.json"
   ```

3. Fill the prompt:

   ```bash
   council-round prompt --run … --round … --repo-root "$REPO" \
     --notes "<what changed, and the friction each change addresses, stated neutrally>" \
     --out "$STATE/round-$K/question.md"
   ```

4. **Invoke the Agent Council skill** with that question (`references/hosts.md` › Agent Council). Use fast mode, give it long timeouts, and finish its own steps. Every member gets the same commit, screenshots, journey sequences and interaction evidence.
5. Collect the ratings:

   ```bash
   council-round collect --run … --round … --session "$SESSION_DIR" --out "$STATE/round-$K/ratings.json"
   ```

   A review is **missing** in any of these cases:
   - the member was not convened, timed out or errored;
   - it has no valid `ui-council-rating` block;
   - it rated another revision or did not return this round's evidence code;
   - a deduction has no citation, the top fix is missing, or any journey lacks a completable true/false assessment.
6. **If a review is missing,** post the round comment marked INCOMPLETE. Then convene again on the same commit and evidence, with no changes in between. Collect with every session (`--session A --session B`).
   - Retry up to three times.
   - Then post the blocked comment with exactly what is needed.

Members who are not on the roster are non-voting. Their opinions are listed in the comment, but the stopping rule ignores them.

## 4. Run an overhaul round (K ≥ 1)

1. **Choose the fixes.**
   - Start from the last scored revision.
   - From the members' findings and the friction log, pick the changes with the most impact on the lowest scores.
   - For each change, name the journey, screen or state and the friction (finding or `Fn`) it addresses.
   - Prefer one coherent redesign of a flow over scattered tweaks.
   - If the last round lowered a member's score, consider reverting the change responsible.
2. **Work in Storybook.**
   - Open or upsert the full-screen stories for every screen of the redesigned flows, including new and merged screens.
   - Build the production UI through them.
   - Keep the old story ids for screens that still exist. Record a mapping for screens that were merged, split or replaced.
   - Add realistic states and interaction coverage for the new flow.
   - Exercise the affected journeys in the running app.
3. **Verify the tasks.**
   - Update each affected journey test to the new flow. It must still complete the same underlying task, with the same goal and outcome.
   - Run every `Jn` check on the candidate.
   - Record the results: `council-round record --round … --check J1=pass …`.
4. **Run the other checks** the change touches: lint, type check and unit tests, the Storybook build, the stories' interaction and accessibility tests, the visual baselines (updated only where intended), and any acceptance specs. Record each check. A pending check keeps the round incomplete.
5. **Audit the scope.**
   - Confirm that every structural change in `git diff <start>..<candidate>` maps to a finding or `Fn`.
   - Confirm that no capability a journey needs was removed.
   - Confirm that every `Jn` check passed.
   - Record the result: `council-round record --round … --scope respected|violated --scope-notes "<evidence>"`.
6. **Capture before and after.**
   - **After:** capture this revision into `$EVID/round-$K/after/`.
   - **Before:** copy the previous round's `after/` into `before/`. Capture new stories at the start revision with identical flags, as well.
   - **Pairs:** compose them into `pairs/`. A new screen pairs against "no screenshot", and the comment's story mapping names what it replaces.
   - **Journeys:** for each changed journey, compose `journeys/Jn.png` with the old sequence and the new sequence for the same goal, even when their step counts differ:

     ```bash
     capture-stories.mjs journey --goal … --before-frames <old steps> --after-frames <new steps>
     ```

   - **Interactions:** save the journey test output under `interactions/`.
   - **Expanded scope:** if the review scope expands materially (a new journey, or screens not yet rated), rate the start revision on the expanded evidence first. Use `--kind rebaseline`. Commit the work in progress, run `git switch --detach <start>`, convene, then switch back. Its ratings become this round's before scores.
7. **Convene the council** (§3).
8. **Post one complete PR comment for the round**, from `assets/pr-round-comment.md`. It includes:
   - the round number, the before and after SHAs, and what changed, with the friction each change addresses;
   - the story mapping;
   - the journey table (steps before → after, and the task check);
   - paired Before / After screenshots and journey strips shown in the comment, pinned by evidence commit;
   - the story ids or links;
   - the ratings table, with one row per member: Design before, Design after, UX before, UX after, Meets minimum?
   - each member's findings and journey assessments, the checks, the verdict and the next changes.
   - The before scores are the earlier ratings of this round's exact start revision and evidence. Otherwise they show as "—".
9. **Apply the stopping rule:** `council-round decide`. Exit code 0 means PASS, 10 means ANOTHER_ROUND, 20 means INCOMPLETE.
   - **PASS:** every roster member gave design **and** UX at or above the minimum on this same revision; every check, including every `Jn`, passes; every member reports every journey completable and the scope respected; and your scope audit agrees. Post the final comment with `council-round final`, which refuses unless the round passes. Then stop.
   - **ANOTHER_ROUND:** this candidate is now the last scored revision. Go to step 1 with K+1. With a 9/10 minimum, a member giving design 10 and UX 8 means another round, and so does any member who finds a journey that can no longer be completed.
   - **INCOMPLETE:** retry the missing reviews (§3.6). Do not start the next round.
   - **Blocked:** if something you cannot fix prevents progress, such as a spec change you may not make or a member who cannot run, post the blocked comment with exactly what is needed to resume, and tell the user.

## 5. Evidence conventions

- **Layout.** `$EVID/round-K/` holds `manifest.json`, `after/`, `before/`, `pairs/`, `journeys/` and `interactions/`. Screens are named `<story-id>--<viewport>--<theme>.png`, and journeys `Jn.png`.
- **Matching.** Capture the before and after sets with identical flags, fixtures, viewports and themes. Journey strips use one viewport and theme for both sequences.
- **Viewports.** Use at least phone (390×844) and desktop (1440×900), unless the app targets other sizes. Capture every theme the app ships.
- **Storage.** Run state (`$STATE`) stays outside the working tree, so members cannot read earlier scores. Evidence stays inside it, excluded from git, so members can open it.

## Validation

`scripts/council-round self-test` runs the stopping rule against `tests/fixtures/`, which are written in Agent Council's real session format. Only the passing cases may finish:

| Case | Verdict | Finishes? |
| --- | --- | --- |
| Unanimous passage | PASS | yes |
| One member below the minimum (design 10, UX 8 at a 9 minimum) | ANOTHER_ROUND | no |
| One reviewer missing (timed out after quorum) | INCOMPLETE | no |
| Missing reviewer retried on the same revision | PASS | yes |
| Reviewer not installed; rating of another revision; wrong evidence code; deduction without a citation; journey not assessed | INCOMPLETE | no |
| Scope violation reported; failing check; journey no longer completable | ANOTHER_ROUND | no |
| Agent not on the roster gives a low score | PASS (non-voting) | yes |
| Resume markers survive a round trip through PR comment text | — | — |

Run the self-test after changing anything in `scripts/`. `scripts/` and `references/hosts.md` are identical in `ui-overhaul`, so change both copies.
