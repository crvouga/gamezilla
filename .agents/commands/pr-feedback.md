---
description: Address review feedback on the current branch's PR, one commit per comment
---

# /pr-feedback

Work through the review comments on this branch's PR — the high-interruption,
low-creativity pass. Same rules as `/pr-ready`: PR CI owns `bun check:full`
(never run it locally, never run `bun deploy*`), never rewrite history (no
`--amend`, no `--force`, no `--force-with-lease`), one commit per comment, and
never make a check pass by weakening it.

## 1. Resolve the PR and read the feedback

```sh
gh pr view --json number,url,title --jq '"\(.number)\t\(.url)\t\(.title)"'
gh pr view --comments
gh api repos/crvouga/gamezilla/pulls/<N>/comments --paginate
```

The second call matters: `gh pr view --comments` does **not** include inline
code comments. Together they give you every comment, with the file, line range
and side baked in.

## 2. Triage before editing

For each comment, decide: **change** (the reviewer is right), **reply** (they are
wrong, or it is a judgement call that needs a human), or **already done**
(the branch already covers it — reply with the commit or file that proves it).

Never guess on a judgement call. Guessing is what makes the difference between
this being safe to run unattended and being dangerous.

## 3. Make the change, one commit per comment

```sh
bun fmt
git add -A
git commit -m "<type>(<scope>): <what the comment asked for>"
```

- Reference the comment it addresses in the commit body (comment URL or
  `review comment <id>`).
- Verify with per-package checks only, for the packages you touched:
  `bun run --filter <pkg> tc` and `bun run --filter <pkg> test`.
- If a comment asks for a change you cannot verify by hand, say so in the reply
  rather than silently shipping it.

## 4. Reply where a change is not the right answer

```sh
gh api --method POST repos/crvouga/gamezilla/pulls/<N>/comments/<comment_id>/replies -f body="<why not>"
```

Keep replies to the point: what you did instead, or the evidence that the
current behaviour is intended.

## 5. Push and re-check

```sh
git push
gh pr checks --watch
```

On failure, follow `/pr-ready` step 6 (`gh run view <databaseId> --log-failed`,
fix the root cause, re-run the touched packages' `tc`/`test`, push again).

## 6. Report

- PR URL, `gh pr checks` summary
- Per comment: changed (with commit) vs replied (with reason) vs already covered
- Anything you deliberately left for a human decision
