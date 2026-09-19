---
name: pr-ready
description: "Only when the user explicitly invokes /pr-ready or $pr-ready. Take the current branch to a green, conflict-free, review-complete PR — pass `bun check` locally, commit, sync with main, resolve conflicts, push, drive CI green, and address review feedback without merging"
---

<!-- generated from .agents/commands by `bun run agents:sync` — do not edit -->

Run the `/pr-ready` command. Its single source of truth is `.agents/commands/pr-ready.md`.

Read that file in full now and follow it exactly. Treat any text the user
typed after the command as its arguments.
