---
name: ui-overhaul
description: >-
  Polish an app's existing UI in scored rounds until every Agent Council member
  the user chose rates both design and UX at or above the user's minimum. Each
  round captures before screenshots, improves the UI in Storybook, captures
  after screenshots, gets every member's rating and posts the round in a PR
  comment. Changes stay minimal: typography, spacing, alignment, contrast,
  hierarchy, focus visibility and consistency. Navigation, layout, controls,
  labels and task steps stay the same. Use for a council-judged UI polish,
  quality pass or visual overhaul. To redesign flows or screens, use
  ui-ux-overhaul.
metadata:
  prerequisites: "Agent Council (github.com/yogirk/agent-council) with each roster member's CLI signed in; git; a PR host CLI (gh, glab); Storybook; Node 18+ with Playwright in the target repo; Python 3.9+."
  pr-title: "UI quality overhaul"
---

# ui-overhaul

Run this loop in the target app's repository until the stopping rule passes:

**capture before → improve the UI in Storybook → capture after → get every council member's rating → post the round in a PR comment → repeat.**

You do the work and keep the record. The council members decide whether the work is good enough. This skill decides nothing by your own judgment of quality.

## Scope

| May change | Must preserve |
| --- | --- |
| Typography | Navigation and routes |
| Spacing and alignment | Screen composition: which regions and components a screen has, and their order |
| Contrast, color and theme tokens | Control placement |
| Visual hierarchy | Label and copy text |
| Focus visibility | Task steps, and the number of steps |
| Consistency across screens, themes and viewports | Features and states. Nothing is added or removed. |

- If a finding needs a structural change, it is outside this skill's scope. Record it as out of scope in the round comment and do not make the change. If such findings block the minimum, post the blocked comment and suggest `ui-ux-overhaul`.
- The default PR title is **"UI quality overhaul"**.

## Package

| Path | What it is |
| --- | --- |
| `assets/council-review-prompt.md` | The question every member gets, including the fixed rubric. |
| `assets/pr-round-comment.md` | The copyable round comment. |
| `assets/pr-run-comments.md` | The opening, baseline, blocked and final comments. |
| `scripts/council-round` | Run state, rating extraction, the stopping rule, comment blocks and resume. `self-test` runs the validation cases. |
| `scripts/capture-stories.mjs` | Storybook screenshots, before/after pairs and journey strips. |
| `references/hosts.md` | Commands for each agent host, PR host, Storybook and git. Everything host-specific lives there. |
| `tests/fixtures/` | Validation cases for the stopping rule, in Agent Council's real session format. |

`$SKILL`, `$STATE`, `$EVID` and `$K` are defined at the top of `references/hosts.md`.

## Rules that hold for the whole run

1. **Only council members rate.** A rating is a member's Stage-1 opinion from an Agent Council session on the candidate commit and its evidence, extracted by `council-round collect`. Never write, estimate, adjust or carry forward a score yourself. The chairman's synthesis is not a rating.
2. **The roster, minimum and rubric are fixed.** Change them only when the user explicitly asks. Then post the change in the PR and take a new baseline.
3. **Never average, mix or drop.** Never average scores across members. Never combine scores from different revisions. Never drop a member. `council-round decide` enforces all three; do not work around it.
4. **Members never see the target.** The prompt does not state the minimum or any earlier score.
5. **The PR comments are the record.** Post every round, including incomplete and failed rounds. Each comment carries a marker that another agent can resume from.
6. **The repository's rules come first.** Its agent instructions (`AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md` and the like) win wherever they are stricter: how to start servers, test policy, commit and PR rules, and the design system. Build screens from the repository's production components only.
7. **Keep going.** Ask the user only for missing start inputs or an unsupported member. Otherwise run as many rounds as needed. Stop only on a pass or a blocker. Never merge the PR.

## 1. Start or resume

1. **Read the roster and the minimum from the invocation.** For example: "Use Claude, Codex, and Gemini. Every member must give both design and UX at least 9/10."
   - If either is missing, ask for it before doing anything else. Ask for both in one question if both are missing.
   - Map names to Agent Council members: `claude`, `codex`, `gemini`. If a named agent is not one of these, ask the user before starting; see the Agent Council section of `references/hosts.md`.
2. **Read the repository.** Read its agent instructions, its design-system docs and its Storybook setup. Find how the app and Storybook are run.
3. **Look for an existing overhaul PR** with this skill's run marker (`references/hosts.md` › GitHub).
   - **Found:** resume from it. Run `council-round markers --restore "$STATE"`. If the invocation gives a different roster or minimum, treat that as an explicit change (rule 2). Continue from the last fully scored revision. Its evidence is at the evidence commit named in the marker.
   - **Not found:**
     1. Branch, then open a draft PR titled "UI quality overhaul".
     2. Run `council-round init-run --skill ui-overhaul --roster … --minimum … --journey … --screen … --product … --out "$STATE/run.json"`.
     3. Post the opening comment from `assets/pr-run-comments.md`, with its marker. It records the roster, minimum, scope, primary journeys, and the screens and states under review.

## 2. Baseline (round 0)

1. **Walk the primary journeys in the running app.** List every in-scope screen and its meaningful states, for example populated, empty, loading, error, long content, keyboard focus, and each viewport and theme the app supports. Running the app is for discovery and fidelity. The checks that gate the run are automated (§4).
2. **Upsert full-screen stories.**
   - Map each screen and state to Storybook.
   - Where a story already covers the screen, update it and keep its id. Where none does, add a story for the screen or the meaningful state.
   - Every story uses production components, the real app shell and theme, realistic deterministic fixtures, and representative viewports.
   - If Storybook is absent, set it up (`references/hosts.md` › Storybook).
3. **Check fidelity.** Compare each story against the running app with the same data, viewport and theme. Fix every gap: missing shell, fonts, tokens, data shapes or states. Note what you fixed.
4. **Commit the stories.** That commit is the baseline revision. It changes stories only, and no product UI.
5. **Capture** the baseline into `$EVID/round-0/after/`, plus any interaction evidence (§5).
6. **Convene the council** (§3) with `--kind baseline`.
7. **Post the baseline comment** from `assets/pr-run-comments.md`: the screenshots, every member's individual ratings and findings, and the round-1 fixes. This is the "before" evidence for round one.

If the baseline already passes the stopping rule, post the final comment. Tell the user that no change was needed.

## 3. Convene the council (every round, including the baseline)

1. Commit and push the candidate. Leave no tracked changes. Members must see exactly this commit.
2. Open the round. This hashes the evidence and stores an evidence code that members can only find inside it:

   ```bash
   council-round manifest --run "$STATE/run.json" --round $K --kind round \
     --start-sha <last scored revision> --candidate-sha $(git rev-parse HEAD) \
     --evidence "$EVID/round-$K" --before-manifest "$EVID/round-$((K-1))/manifest.json" \
     --story <id> … --repo "$REPO" --out "$STATE/round-$K/round.json"
   ```

3. Fill the prompt:

   ```bash
   council-round prompt --run … --round … --repo-root "$REPO" --notes "<what changed, stated neutrally>" \
     --out "$STATE/round-$K/question.md"
   ```

4. **Invoke the Agent Council skill** with that question (`references/hosts.md` › Agent Council). Use fast mode, give it long timeouts, and finish its own steps. Every member gets the same commit, screenshots and interaction evidence.
5. Collect the ratings:

   ```bash
   council-round collect --run … --round … --session "$SESSION_DIR" --out "$STATE/round-$K/ratings.json"
   ```

   A review is **missing** in any of these cases:
   - the member was not convened, timed out or errored;
   - it has no valid `ui-council-rating` block;
   - it rated another revision or did not return this round's evidence code;
   - a deduction has no citation, or the top fix is missing.
6. **If a review is missing,** post the round comment marked INCOMPLETE. Then convene again on the same commit and evidence, with no changes in between. Collect with every session (`--session A --session B`). The latest valid rating per member counts, and the tool accepts only ratings of that same revision and evidence.
   - Retry up to three times.
   - Then post the blocked comment with exactly what is needed, for example `gemini: authentication expired — run gemini and sign in`.

Members who are not on the roster are non-voting. Their opinions are listed in the comment, but the stopping rule ignores them.

## 4. Run an overhaul round (K ≥ 1)

1. **Choose the fixes.**
   - Start from the last scored revision.
   - From the members' findings, pick the changes with the most impact on the lowest scores.
   - For each fix, name the exact story, state or journey it addresses, and stay within the scope table.
   - If the last round lowered a member's score, consider reverting the change responsible.
2. **Work in Storybook.**
   - Open or upsert the full-screen stories that show the issues.
   - Improve the production UI through them: shared components, tokens and theme first, so one fix lands everywhere.
   - Add realistic states and interaction coverage wherever gaps show up.
   - Exercise the affected journeys in the running app.
3. **Run the checks** the change touches: lint, type check and unit tests of the changed packages, the Storybook build, the stories' interaction and accessibility tests, the repository's visual baselines (update them only where the change is intended), and the journey tests. Record each check: `council-round record --round … --check name=pass|fail|pending --detail …`.
   - A pending check, such as CI still running, keeps the round incomplete until it is recorded.
4. **Audit the scope.**
   - Read `git diff <start>..<candidate>`.
   - Confirm that no routes, navigation, screen composition, control placement, label or copy strings, or steps changed.
   - Record the result: `council-round record --round … --scope respected|violated --scope-notes "<how you checked>"`.
5. **Capture before and after.**
   - **After:** capture this revision into `$EVID/round-$K/after/`.
   - **Before:** copy the previous round's `after/` into `before/`. It was already pushed at that round's evidence commit, so later pushes cannot change it.
   - **New stories:** capture any story added this round at the start revision as well, with identical flags (`references/hosts.md` › Git). Keep the data, viewport and theme matching.
   - **Pairs:** compose them into `pairs/`.
   - **Interaction evidence:** add it under `interactions/`.
   - **Expanded scope:** if the review scope expands materially (a new screen or journey, not only a new state of a screen already rated), rate the start revision on the expanded evidence first. Use `--kind rebaseline`, convened as in §3. Commit the work in progress, run `git switch --detach <start>`, convene, then switch back, because members read the working tree. Its ratings become this round's before scores. `council-round render` refuses before scores from a different revision.
6. **Convene the council** (§3).
7. **Post one complete PR comment for the round**, from `assets/pr-round-comment.md`. It includes:
   - the round number, the before and after SHAs, and what changed;
   - paired Before / After screenshots shown in the comment, pushed to the evidence branch and pinned by commit (`council-round gallery`);
   - the story ids or links;
   - the ratings table, with one row per member: Design before, Design after, UX before, UX after, Meets minimum? (`council-round render`);
   - each member's findings, the checks, the verdict and the next fixes.
   - The before scores are the earlier ratings of this round's exact start revision and evidence. Otherwise they show as "—".
8. **Apply the stopping rule:** `council-round decide`. Exit code 0 means PASS, 10 means ANOTHER_ROUND, 20 means INCOMPLETE.
   - **PASS:** every roster member gave design **and** UX at or above the minimum on this same revision, the checks pass, and the scope audit and every member report the scope as respected. Post the final comment with `council-round final`, which refuses unless the round passes. Then stop.
   - **ANOTHER_ROUND:** this candidate is now the last scored revision. Go to step 1 with K+1. With a 9/10 minimum, a member giving design 10 and UX 8 means another round.
   - **INCOMPLETE:** retry the missing reviews (§3.6). Do not start the next round.
   - **Blocked:** if something you cannot fix prevents progress, post the blocked comment with exactly what is needed to resume, and tell the user.

## 5. Evidence conventions

- **Layout.** `$EVID/round-K/` holds `manifest.json`, `after/`, `before/`, `pairs/` and `interactions/`. Files are named `<story-id>--<viewport>--<theme>.png`.
- **Matching.** Capture the before and after sets with identical flags, fixtures, viewports and themes.
- **Viewports.** Use at least phone (390×844) and desktop (1440×900), unless the app targets other sizes. Capture every theme the app ships.
- **Focus.** Static screenshots do not show focus. Add stories whose play functions focus controls, and capture them.
- **Storage.** Run state (`$STATE`) stays outside the working tree, so members cannot read earlier scores. Evidence stays inside it, excluded from git, so members can open it.

## Validation

`scripts/council-round self-test` runs the stopping rule against `tests/fixtures/`, which are written in Agent Council's real session format. Only the passing cases may finish:

| Case | Verdict | Finishes? |
| --- | --- | --- |
| Unanimous passage | PASS | yes |
| One member below the minimum (design 10, UX 8 at a 9 minimum) | ANOTHER_ROUND | no |
| One reviewer missing (timed out after quorum) | INCOMPLETE | no |
| Missing reviewer retried on the same revision | PASS | yes |
| Reviewer not installed; rating of another revision; wrong evidence code; deduction without a citation | INCOMPLETE | no |
| Scope violation reported; failing check | ANOTHER_ROUND | no |
| Agent not on the roster gives a low score | PASS (non-voting) | yes |
| Resume markers survive a round trip through PR comment text | — | — |

Run the self-test after changing anything in `scripts/`. `scripts/` and `references/hosts.md` are identical in `ui-ux-overhaul`, so change both copies.
