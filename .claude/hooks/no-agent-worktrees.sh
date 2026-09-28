#!/usr/bin/env bash
# PreToolUse guard: agents work on the branch/worktree they were started in.
# Blocks EnterWorktree and subagents launched with `isolation: "worktree"`,
# which mint throwaway `worktree-agent-*` branches under .claude/worktrees/.
set -euo pipefail
input=$(cat)
tool=$(jq -r '.tool_name // ""' <<<"$input")
isolation=$(jq -r '.tool_input.isolation // ""' <<<"$input")
if [ "$tool" = "EnterWorktree" ] || [ "$isolation" = "worktree" ]; then
  jq -n '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny",
    permissionDecisionReason: "No agent worktrees (AGENTS.md hard rule): commit to the current branch/worktree, even when several agents share it. Relaunch the subagent without isolation."}}'
fi
