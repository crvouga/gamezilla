# Agent environments

Open this repository or a Git worktree in your preferred environment. Project
rules live in [`AGENTS.md`](../AGENTS.md); environment-specific entry points
refer agents there. Install the tools pinned by `mise.toml` and run `bun install`
in a cold checkout. Authentication and trust prompts belong to each developer.
No repository configuration grants automatic tool approval or stores credentials.

## Coding agents

| Environment | Instructions | Shared commands | Serena MCP |
| --- | --- | --- | --- |
| Claude Code | `CLAUDE.md` → `AGENTS.md` | `.claude/commands` | `.mcp.json` |
| Codex | `AGENTS.md` | `.agents/skills` | `.codex/config.toml` |
| Cursor | `AGENTS.md` | `.cursor/commands` | `.cursor/mcp.json` |
| Gemini CLI | `GEMINI.md` → `AGENTS.md` | `.gemini/commands` | `.gemini/settings.json` |
| GitHub Copilot in VS Code | `.github/copilot-instructions.md` → `AGENTS.md` | `.github/prompts` | `.vscode/mcp.json` |
| OpenCode | `AGENTS.md` | `.opencode/commands` | `opencode.json` |
| Windsurf | `.windsurf/rules/AGENTS.md` → `AGENTS.md` | `.windsurf/workflows` | Configure per user |
| Factory / Droid | `AGENTS.md` | `.factory/commands` | `.factory/mcp.json` |
| Roo Code | `AGENTS.md` | `.roo/commands` | `.roo/mcp.json` |
| Kiro | `.kiro/steering/AGENTS.md` → `AGENTS.md` | Read `.agents/commands/<name>.md` on request | `.kiro/settings/mcp.json` |
| Continue | `.continue/rules/AGENTS.md` → `AGENTS.md` | Read `.agents/commands/<name>.md` on request | `.continue/mcpServers/mcp.json` |
| Cline | `.clinerules/AGENTS.md` → `AGENTS.md` | `.clinerules/workflows` | Configure in Cline |
| Zed | `AGENTS.md` | Read `.agents/commands/<name>.md` on request | Configure in Zed |
| Antigravity | `AGENTS.md` / `GEMINI.md` | `.agents/skills` | Configure in Antigravity |
| Warp | `AGENTS.md` | Read `.agents/commands/<name>.md` on request | Configure in Warp |

`bun run agents:sync` regenerates instruction pointers, command adapters, and
project MCP entries. Edit `.agents/commands/` for commands, never their generated
copies. `@libs/tools-harness-ts#ci:agent-commands` rejects drift. MCP sync preserves
unrelated servers and settings. Serena launches through `mise exec` using the
pinned version and never opens its dashboard automatically.

For clients configured per user, use command `mise` and arguments
`["exec", "--", "serena", "start-mcp-server", "--context", "ide",
"--project-from-cwd", "--open-web-dashboard", "false"]` with the repository as
working directory. Do not put personal configuration or tokens in the repository.

Kiro configuration follows its [MCP reference](https://kiro.dev/docs/mcp/configuration/)
and [steering reference](https://kiro.dev/docs/web/steering).

Continue uses its [project rule format](https://docs.continue.dev/customize/deep-dives/rules)
and [JSON MCP format](https://docs.continue.dev/customize/deep-dives/mcp).
Antigravity uses its [shared discovery locations](https://antigravity.google/docs/customization-discovery).
For Aider, launch `aider --read AGENTS.md` to load the same rules as read-only context;
see its [read configuration](https://aider.chat/docs/config/aider_conf.html).

Configuration references: [Factory MCP](https://docs.factory.com/harness/mcp),
[Factory commands](https://docs.factory.com/harness/custom-slash-commands),
[Roo MCP](https://roocodeinc.github.io/Roo-Code/features/mcp/using-mcp-in-roo/),
[Roo commands](https://roocodeinc.github.io/Roo-Code/features/slash-commands/),
[Cline rules](https://docs.cline.bot/customization/cline-rules),
[Zed instructions](https://zed.dev/docs/ai/instructions), and
[Warp instructions](https://docs.warp.dev/getting-started/quickstart/coding-in-warp/).

## Workspace orchestrators

| Environment | Generated configuration | Start | Cleanup |
| --- | --- | --- | --- |
| Superset / Paradev | `.superset/config.json` | Run | Teardown |
| super.engineering | `.super.engineering/config.json` | Run | Teardown |
| Emdash | `.emdash.json` | Run | Teardown |
| cmux | `.cmux/cmux.json` | Run project command | Stop project command |
| Conductor | `.conductor/settings.toml` | Run action | Archive |

`bun run workspace:sync` projects the shared lifecycle scripts into these files.
`@libs/tools-harness-ts#ci:workspace-lifecycle` rejects drift. Run invokes
`libs/tools-harness-ts/workspace/run.sh`; cleanup invokes the sibling
`teardown.sh`. Cold preparation happens inside Run, so creating a workspace does
not start a server. Conductor uses nonconcurrent actions because some sidecar
ports are machine-wide. Its format follows the
[Conductor scripts reference](https://www.conductor.build/docs/reference/scripts).
Emdash follows its [project configuration](https://emdash.com/docs/project-config).
cmux supplies explicit palette commands using its
[command format](https://cmux.com/docs/custom-commands); run Stop project before
closing its workspace, since this adapter has no automatic archive hook.
Personal Conductor settings belong in `.conductor/settings.local.toml`.

Other orchestrators can use those same Run and cleanup commands in their project
settings. They have no generated adapter here until their repository configuration
contract is supported. Cloud workspaces additionally need the pinned toolchains
and credentials; these local lifecycle adapters do not provision cloud resources.

The release decision remains the full `bun verify` gate described in
[`AGENTS.md`](../AGENTS.md); opening an environment is not verification evidence.
