# Host-specific commands

`SKILL.md` stays host-neutral. This file maps each of its steps to concrete commands. Use the
section for your agent, your code host, and the target repository. A host without a section
needs the same capability by other means. If one is missing, stop and record a blocker.

`$SKILL_DIR` is the directory that holds this file.

## Agent Council (every host)

Agent Council supports exactly three members: `claude`, `codex` and `gemini`. It runs **every**
installed CLI from that list, with no flag to choose members. The roster therefore filters the
session's opinions: members off the roster are reported as "not counted". A roster member whose
CLI is missing or unauthenticated has no opinion file, so its round is INCOMPLETE. Members read
image files by relative path from the repository root (the runtime's `--context` inlines text
only), so evidence must sit inside the target repository. Keep it in a git-ignored directory.

Find the runtime in this order:

1. The repository vendors the skill: `bash "$(git rev-parse --show-toplevel)/.agents/skills/council/scripts/runtime.sh"`
   prints the binary (this monorepo pins upstream v0.4.0 that way).
2. A user install: `~/.claude/skills/agent-council/bin/council`, `~/.agents/skills/agent-council/bin/council`
   or `~/.gemini/skills/agent-council/bin/council`.
3. Not installed: install it from https://github.com/yogirk/agent-council (`npx cliagent-council`,
   which needs Bun) if the user allows it. Otherwise record a blocker.

Dispatch, after `council-round.mjs prompt` wrote the question file:

```bash
SESSION_DIR=$("$COUNCIL_BIN" --question-file .ui-overhaul/rounds/<n>/question.txt \
  --chairman <invoking-cli> --project "$(basename "$(git rev-parse --show-toplevel)")-ui-overhaul")
```

- `--chairman` is the CLI running this skill (`claude`, `codex` or `gemini`). Other agents (Kiro,
  Cursor and so on) pass the roster member they are closest to, or omit the flag. The chairman
  label never makes anyone a reviewer: every roster member, the invoking CLI included, is scored
  only from its own `stage1/opinion_<member>.json`. Its own subprocess writes that file
  independently. Never write a score yourself or use the chairman's synthesis as a rating.
- Do not pass `--with-review`. Peer review shows members each other's opinions, and ratings must
  be independent.
- Long visual reviews outlast the default timeouts (120 s, 180 s for Gemini). Raise `timeout_ms`
  and `quorum_grace_ms` in `~/.council/config.json` to about 20 minutes (1200000) before round 0. Otherwise quorum drops the slowest member.
- Preflight: `which claude codex gemini`, then confirm each roster CLI is authenticated by running
  it once non-interactively. Fix or report a missing member before round 0.

## Agents

| Agent         | Run the bundled scripts                               | Browser and screenshots                                                             | Notes                                  |
| ------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------- |
| Claude Code   | Bash: `node "$SKILL_DIR/scripts/council-round.mjs" …` | Playwright MCP (`browser_resize`, `browser_take_screenshot`) or a Playwright script | Skill lives in `.claude/skills/<name>` |
| Codex CLI     | shell tool, same commands                             | Playwright script (`npx playwright@<pinned> …`)                                     | Skill lives in `.agents/skills/<name>` |
| Gemini CLI    | shell tool, same commands                             | Playwright script                                                                   | Skill lives in `.gemini/skills/<name>` |
| Kiro / others | shell, same commands                                  | Playwright script                                                                   | Read `SKILL.md` and follow it          |

A Playwright capture loop that works anywhere:

```js
// node capture.mjs <storybook-url> <out-dir> <story-id> <width>x<height> <light|dark>
import { chromium } from 'playwright';

const [base, out, id, size, theme] = process.argv.slice(2);
const [width, height] = size.split('x').map(Number);
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width, height },
  colorScheme: theme,
  reducedMotion: 'reduce'
});
await page.goto(`${base}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`);
await page.waitForLoadState('networkidle');
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: `${out}/${id}--${width}x${height}-${theme}.png`, fullPage: true });
await browser.close();
```

## Code hosts

### GitHub (`gh`)

- Find the run: `gh pr list --state open --search "in:comments \"<!-- <skill>:run -->\""`, then
  `gh pr view <n> --comments --json comments` and read every `<!-- <skill>:… -->` block.
- Open the PR ready for review: `gh pr create --base <trunk> --title "<UI quality overhaul | UI and UX overhaul>" --body-file <body>`.
- Round comment with images: `gh pr comment <n> --body-file .ui-overhaul/rounds/<n>/comment.md --attach ./before/x.png#"alt" --attach ./after/x.png#"alt"`
  (gh 2.99+). gh uploads each file to `user-attachments` and rewrites its `./…` reference.
  Those URLs are immutable, so later pushes cannot overwrite the evidence. A private repo's
  attachments answer 404 to anonymous requests. Verify them through
  `gh api repos/{owner}/{repo}/issues/comments/<id> -H "Accept: application/vnd.github.html+json" --jq .body_html`.
  Up to 50 files per command: split a large round across a comment and a continuation comment
  that links back to it.
- Older gh without `--attach`: if the repository allows committed evidence, push images to an
  orphan branch `ui-overhaul-evidence` and link them by commit SHA (`…/blob/<evidence-sha>/<path>?raw=true`),
  never by branch name. Otherwise record a blocker.
- Checks on the candidate: `gh pr checks <n>`, or the repository's own commands below.

### GitLab (`glab`)

`glab mr create` (not `--draft`, unless the target repository below says so). Upload images with `glab api projects/:id/uploads -F file=@<png>` and put
the returned markdown into `glab mr note <n> --message "$(cat comment.md)"`.

## Target repositories

### Geviti monorepo (this repository)

- Rules first: root `AGENTS.md` and `apps/member-app/AGENTS.md`. PRs target `dev` and open as
  drafts. Before you mark one ready it needs a Plane ticket (the `plane` skill) and
  `pnpm check:affected`. Commits are conventional and one per scope, e.g.
  `fix(member-app): raise settings error contrast to AA`.
- Storybook: use the `storybook` skill. `pnpm storybook` starts the supervised server and
  `pnpm stack restart app-storybook` restarts it. Never start a second server on 6006. Discover
  stories with the Storybook MCP (`docs-list`, `docs-show-story`) and follow
  `get-storybook-story-instructions` before writing one. The existing visual baselines own component coverage.
  This skill's full-screen stories add to them and replace nothing.
- Running app: `pnpm stack start --profile ui` for web. For iOS, `pnpm stack start --profile dev --own-ios`
  and `pnpm agent-tooling local member new --persona <name> --sign-in`.
- Before / after captures of member-app pages, every device and theme: `pnpm ui-capture`
  (`tooling/ui-captures/README.md`). Put evidence in git-ignored `.geviti/ui-overhaul/` and set
  `evidenceRoot` there instead of `.ui-overhaul/`. Never commit screenshots: post them with
  `gh pr comment --attach`.
- Design tokens: the `gds-tokens` skill. Visual craft guidance: the `impeccable` skill.
- Checks per round: `pnpm check:changed` while iterating. On the candidate, run `pnpm check:affected`
  and the touched stories' tests (one file at a time locally). Watch the CI budget in `AGENTS.md`:
  one scoped cloud proof per candidate, not per round of polish.
