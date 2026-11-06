# Host-specific commands

This file is the same in `ui-overhaul` and `ui-ux-overhaul`. `SKILL.md` says what to do; this file says how to do it with a particular agent host, PR host or tool. If the repository documents its own way to do a step, such as starting Storybook or taking screenshots, follow the repository.

Variables used below:

| Name | Meaning |
| --- | --- |
| `$SKILL` | This skill's directory, the one that holds `SKILL.md`. |
| `$REPO` | The target repository root: `git rev-parse --show-toplevel`. |
| `$NAME` | The skill name, `ui-overhaul` or `ui-ux-overhaul`. |
| `$STATE` | Run state outside the working tree: `"$(git rev-parse --git-path overhaul)/$NAME/pr-$PR"`. |
| `$EVID` | Evidence inside the working tree, where council members can read it: `$REPO/.overhaul-evidence/$NAME`. |
| `$K` | The round number. 0 is the baseline. |

## Contents

- [Agent Council](#agent-council)
- [Git](#git)
- [GitHub (gh)](#github-gh)
- [Other PR hosts](#other-pr-hosts)
- [Storybook](#storybook)
- [Interaction evidence](#interaction-evidence)

## Agent Council

The council is [yogirk/agent-council](https://github.com/yogirk/agent-council). These notes describe v0.3.x, commit `f6d1e1a`. Check the installed version's README if its behavior differs.

### What it supports, and what that means for the loop

- **Members.** It can convene only `claude` (Claude Code), `codex` (Codex CLI) and `gemini` (Gemini CLI). It has no flag for choosing members: it convenes every one of these CLIs that is installed and passes preflight.
  - A roster member that is not installed or fails preflight is **missing**.
  - An installed agent that is not on the roster still answers. `council-round collect` lists it as **non-voting** and ignores it.
  - If the user names any other agent, Agent Council cannot convene it. Ask the user before starting.
- **Quorum.** Stage 1 continues once N−1 members have answered, then waits `quorum_grace_ms` for the rest. A member still running when the grace period ends is recorded as `status: "timeout"`, `"Skipped (quorum reached, grace period expired)"`. That counts as a missing review, so give screenshot reviews a long grace period.
- **Sandbox.** Members run headless from `$REPO`:
  - `claude -p … --output-format json`
  - `codex exec … -C $REPO -s read-only --json`
  - `gemini -p … -o json`

  Keep the evidence inside the working tree so that every member can open it. Keep run state (`$STATE`) outside it, so members do not read earlier scores.
- **Independence.** When the agent running this skill is itself on the roster, its rating comes from a new headless process that Agent Council starts. Never from the running agent.

### Install and locate

- Install with `npx cliagent-council`, or `git clone https://github.com/yogirk/agent-council && cd agent-council && ./setup`. Requires [Bun](https://bun.sh).
- The skill installs into `~/.claude/skills/agent-council`, `~/.agents/skills/agent-council` (Codex) and `~/.gemini/skills/agent-council`.
- Find the CLI the way the Agent Council skill does, with `COUNCIL_BIN` as an override:

```bash
COUNCIL_BIN="${COUNCIL_BIN:-}"
for d in "$HOME/.claude/skills/agent-council" "$HOME/.agents/skills/agent-council" "$HOME/.gemini/skills/agent-council" "$REPO"; do
  [ -z "$COUNCIL_BIN" ] && [ -x "$d/bin/council" ] && COUNCIL_BIN="$d/bin/council"
done
COUNCIL_BIN="${COUNCIL_BIN:-$(command -v council)}"
[ -x "$COUNCIL_BIN" ] || echo "Agent Council CLI not found: install it, or set COUNCIL_BIN"
```

### Configure timeouts once

Reviewing dozens of screenshots takes minutes. Set long timeouts and a long grace period in `~/.council/config.json`, so slow members are not cut off. Merge these keys into any existing file rather than replacing it:

```json
{ "timeout_ms": { "claude": 1200000, "codex": 1200000, "gemini": 1200000 }, "quorum_grace_ms": 1200000 }
```

### Convene, from any host

Use Agent Council's own skill (`/council` in Claude Code and Gemini CLI, `$council` in Codex), with the filled question as its question. Its Step 1 writes the question to a file. Write `question.md` there instead, because the question is long:

```bash
SLUG=$(basename "$REPO")
SESSION_DIR=$("$COUNCIL_BIN" --question-file "$STATE/round-$K/question.md" --project "$SLUG")
echo "SESSION_DIR=$SESSION_DIR"   # ~/.council/<slug>/council-YYYYMMDD-HHMMSS
```

- **Fast mode only.** Do not pass `--with-review` or `--quick`. Ratings come from Stage 1, and peer review would show members each other's answers.
- **Other hosts.** Hosts such as Cursor, Windsurf, Copilot or OpenCode have no `/council`. Run the same command and add `--chairman <a roster member>`, because the chairman must be `claude`, `codex` or `gemini`. Then do the skill's synthesis steps yourself.
- **Finish the skill.** Complete Agent Council's remaining steps: read the opinions, write `synthesis.json`, regenerate the viewer. Use the synthesis only to choose the next fixes. It is never a rating.
- **Long runs.** Run the command in the background if the host allows it. Wait for it to exit; do not poll on a timer. The opinions are in `$SESSION_DIR/stage1/opinion_<member>.json`, and the full text is in their `response` fields.

## Git

```bash
# Keep the evidence out of commits, without touching .gitignore.
grep -qx '/.overhaul-evidence/' "$(git rev-parse --git-path info/exclude)" 2>/dev/null \
  || echo '/.overhaul-evidence/' >> "$(git rev-parse --git-path info/exclude)"
mkdir -p "$STATE"

# Members must see exactly the candidate: commit it, and leave no tracked changes.
git status --porcelain --untracked-files=no   # must print nothing
git rev-parse HEAD                            # this is the candidate sha

# Capture an older revision (a before set) without disturbing the work tree.
git worktree add --detach "$STATE/before-tree" "$START_SHA"
# ...install, build Storybook and capture there with identical flags...
git worktree remove --force "$STATE/before-tree"
```

### Evidence branch

GitHub has no API for attaching images to a comment. Push each round's images to an orphan branch that is never merged, and link them by commit sha, so later pushes cannot change them:

```bash
EB="overhaul-evidence/pr-$PR"
WT="$STATE/evidence-tree"
if git ls-remote --exit-code --heads origin "$EB" >/dev/null; then
  git fetch origin "$EB" && git worktree add -B "$EB" "$WT" "origin/$EB"
else
  git worktree add --detach "$WT" && git -C "$WT" switch --orphan "$EB"
fi
mkdir -p "$WT/round-$K"
cp -R "$EVID/round-$K/." "$WT/round-$K/"
git -C "$WT" add "round-$K"
git -C "$WT" commit -m "evidence: $NAME round $K for PR #$PR ($CANDIDATE_SHA)"
git -C "$WT" push origin "$EB"
EVIDENCE_COMMIT=$(git -C "$WT" rev-parse HEAD)
```

## GitHub (gh)

```bash
# Find an existing overhaul PR to resume. Check every match's opening comment for the skill name.
gh pr list --state open --search "in:comments overhaul-loop:run" --json number,title,url,headRefName
gh pr list --state open --search "\"UI quality overhaul\" in:title" --json number,title,url,headRefName

# Open a draft PR. The empty commit lets the PR exist before any UI change.
git switch -c "$NAME/$(date +%Y%m%d)"
git commit --allow-empty -m "chore: start the $NAME run"
git push -u origin HEAD
gh pr create --draft --title "UI quality overhaul" --body-file "$STATE/pr-body.md"   # ui-ux-overhaul: "UI and UX overhaul"
PR=$(gh pr view --json number --jq .number)

# Post a comment and keep its URL. Later comments link to it.
gh pr comment "$PR" --body-file "$STATE/round-$K/comment.md"
gh api "repos/{owner}/{repo}/issues/$PR/comments" --paginate --jq '.[-1].html_url'

# Resume: rebuild state from the markers in the PR's comments.
gh api "repos/{owner}/{repo}/issues/$PR/comments" --paginate --jq '.[].body' \
  | "$SKILL/scripts/council-round" markers --restore "$STATE"

# Check results for the candidate.
gh pr checks "$PR" --json name,state,link
```

### Image URLs, pinned to the evidence commit

- Public repository: `https://raw.githubusercontent.com/<owner>/<repo>/$EVIDENCE_COMMIT/round-$K/pairs/<file>.png`
- Private repository: `https://github.com/<owner>/<repo>/blob/$EVIDENCE_COMMIT/round-$K/pairs/<file>.png?raw=true`

After the first comment, open it once and confirm that an image renders. If it does not, switch URL forms before the next comment.

Pass the URL up to the commit sha as `--base-url`, and the path below it as `--prefix`:

```bash
"$SKILL/scripts/council-round" gallery --pairs "$EVID/round-$K/pairs" \
  --base-url "https://raw.githubusercontent.com/<owner>/<repo>/$EVIDENCE_COMMIT" --prefix "round-$K/pairs" \
  --journeys "$EVID/round-$K/journeys" --journeys-prefix "round-$K/journeys"
```

## Other PR hosts

| Step | GitLab (`glab`) | Bitbucket / other |
| --- | --- | --- |
| Draft PR | `glab mr create --draft --title "…"` | the host's CLI or API |
| Comment | `glab mr note <id> -m "$(cat comment.md)"` | the host's CLI or API |
| Images | `glab api projects/:id/uploads -F file=@x.png` returns Markdown. Uploads are immutable, so no evidence branch is needed. | an evidence branch, linked by commit sha |
| Read comments | `glab api projects/:id/merge_requests/<id>/notes` | the host's CLI or API |

## Storybook

- **Find it.** Look for `.storybook/main.*` and a `storybook` script. The story index is at `<storybook>/index.json`, or `stories.json` before v7. Story ids are `<title>--<export>` in kebab case.
- **Run it** the repository's way, with a dev server or a static build. A static build (`storybook build -o <dir>`) gives reproducible captures, and `capture-stories.mjs` serves it itself.
- **Set it up** if it is absent:
  1. Run `npx storybook@latest init` with the app's framework.
  2. In `.storybook/preview.*`, wrap stories in the app's real providers (theme, router, i18n, data) and the app shell.
  3. Expose the theme as a global, for example `globalTypes.theme`, so captures can set `globals=theme:dark`.
- **Full-screen stories.**
  - Set `parameters: { layout: 'fullscreen' }`.
  - Render the production screen component inside the real shell.
  - Use deterministic fixtures: fixed clock, ids, names and images, and no live network.
- **Story ids.** Keep a story's id stable by keeping its `title` and export name. When a screen is genuinely renamed, keep the old id until the comment's story mapping has recorded the change.
- **Capture** with identical flags for the before set and the after set:

```bash
node "$SKILL/scripts/capture-stories.mjs" capture \
  --storybook <url-or-static-dir> --stories-file "$STATE/stories.txt" \
  --viewports phone=390x844,desktop=1440x900 --themes dark,light --theme-global theme \
  --out "$EVID/round-$K/after" --resolve-from <dir whose node_modules has Playwright> \
  [--browser-path <chromium>] [--globals 'key:value'] [--ready-selector '<css>']

node "$SKILL/scripts/capture-stories.mjs" compose \
  --before "$EVID/round-$K/before" --after "$EVID/round-$K/after" \
  --out "$EVID/round-$K/pairs" --before-label "Before · ${START_SHA:0:7}" --after-label "After · ${CANDIDATE_SHA:0:7}"

node "$SKILL/scripts/capture-stories.mjs" journey --goal "Invite a friend to a space" \
  --before-frames a.png,b.png,c.png,d.png --after-frames x.png,y.png \
  --out "$EVID/round-$K/journeys/J1.png"
```

If no Playwright is installed, install it as a dev dependency the repository's way, or use the repository's existing screenshot tooling. Either way, keep the `<story-id>--<viewport>--<theme>.png` names so that pairs match.

## Interaction evidence

- **Storybook interaction tests.** Run the repository's runner: `storybook test`, the Vitest addon, or `test-storybook`. Save its output as `interactions/storybook-tests.txt`.
- **Journey tests.** Save the run of the end-to-end tests that cover each primary journey as `interactions/journeys.txt`. Name the test that covers each `Jn`.
- **Focus evidence.** Add a story whose play function tabs to the control, and capture it. Static screenshots do not show focus by default.
- **Recording results.** Record each check with `council-round record --round "$STATE/round-$K/round.json" --check '<name>=pass|fail|pending' --detail '<command or CI link>'`.
