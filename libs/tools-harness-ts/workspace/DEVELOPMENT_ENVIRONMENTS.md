# Development environments

## Commands and onboarding

From a fresh authorized clone or worktree on the execution host:

```sh
./libs/tools-harness-ts/workspace/setup.sh
./libs/tools-harness-ts/workspace/run.sh
# In another terminal, same checkout:
bunx turbo run lint tc test --filter=@libs/tools-harness-ts
bun verify
./libs/tools-harness-ts/workspace/teardown.sh
```

Setup installs the pinned tools from `mise.toml`, loads their paths without relying
on a shell profile, and runs Bun's frozen install, including existing generation.
It bootstraps mise in the user's home if absent (requires curl and outbound HTTPS).
It trusts this checkout's mise configuration: review the repository before running.
Bun is pinned in both `mise.toml` and `package.json`; `bun.lock` is authoritative.
Setup fails nonzero on tool/install/generation failure; rerun after resolving it.
Workspace-creation hooks call `prepare.sh`, which reports that failure and lets the
workspace open for repairs. It does not stamp failed setup as ready or start services.
Successful dependency fingerprints avoid reinstalling unchanged inputs.
Optional agent navigation: run `bun run graphify:install` to install the Graphify
skill after setup (building the graph remains on demand). Setup does
not boot services, migrate external databases, pull credentials, or merge branches.
Run automatically invokes setup for missing or stale dependencies, then starts
the stack only after setup succeeds. Unchanged launches reuse the completed
install. If preparation fails, resolve its reported error and rerun Run; it retries
preparation without treating a partial install as ready.
Do not attach setup or run to an agent message/session/prompt hook.

The existing task graph remains authoritative: package `build`, `lint`, `tc`, and
`test` tasks run through Turbo. Use `bunx turbo run build --filter=<package-name>`
for a build; there is no universal root `test` alias. `bun verify` is the required
release gate; `bun verify-nightly` adds exploration. CI contracts remain in
[the repository briefing](../../../README.md#correctness-machinery).

## Isolation, data and credentials

The foreground run uses the existing checkout-owned supervisor. Web ports prefer
a stable path-derived block and probe for conflicts; all actual sidecar ports are
allocated by the existing stack planner. Storybook uses the web block’s +2 port,
with its existing 6006 default preserved outside the workspace launcher. The planner prints the actual web and API
origins; the ready manifest is `.cache/localhost-stack/dev.json`. Open its
`webOrigin`, never assume port 5173. `VITE_PORT` explicitly pins the web port;
an occupied pinned port fails rather than killing its listener. Probing cannot
eliminate a bind race: on conflict rerun, or select another `VITE_PORT`.

The default stack uses in-process/local simulated vendors, not paid services.
Database, object-store and provider state live under this checkout's `.cache/`;
node_modules, generated catalogs, build output and caches stay checkout-local.
The workspace launcher passes `--keep-data` to preserve local state on restart.
Do not pass `--idp-state-path` pointing into another workspace. Direct `bun dev`
keeps its existing fresh-state semantics. Optional LGTM Docker and standalone
EMQX/wrangler workflows have separate shared-port constraints; they are not needed
for this launcher. Do not run concurrent native simulator sessions without their
own device allocation.

Cleanup delegates to `bun run kill`, which uses checkout ownership records and
process identity. It never guesses ownership from a port, deletes worktrees, or
removes volumes/data. It can be rerun. Retain dependencies until cleanup finishes;
without them cleanup fails explicitly. Cleanup errors are not swallowed. Multiple
Run calls in one checkout are governed by the existing supervisor; use separate
worktrees for independent sessions. Bun's download cache is shared, mutable stack
state is not. Use only a trusted, private remote worker for credentials.

[workspace.env.example](workspace.env.example) lists optional shell settings and
contains no secrets; it is not loaded automatically. No `.env.local` or offline
secret cache is copied from another checkout. The local full stack requires no
production credentials. Standalone client/server or full verification may require
explicit development credentials through the existing Infisical setup; follow
[secrets package documentation](../../secrets-server-ts/README.md). Never copy `.cache/secrets`
wholesale: it may include production environments. Do not run `db:migrate`,
`db:wipe:dev`, deploy or infra commands as a setup hook. Branding remains in the
existing `@libs/product-identity-shared-ts` configuration, not ADE files.

## Compatibility and configuration

Reviewed against official sources on 2026-10-31. These are desktop/workspace
hosts unless labeled coding agent. Documentation review does not establish an
end-to-end integration pass. No ADE installation is required by the scripts.

| Tool | Repository configuration | Settings/manual step | Evidence |
| --- | --- | --- | --- |
| Orca ADE | No invented repo config | Repository → Hooks: setup command below; Quick Commands for run/cleanup | Official docs + installed CLI guide; local preview assertion passed, lifecycle untested |
| T3 Code | Generated `t3.json`, also installed as project actions | Blocking setup on worktree creation; checkout-owned cleanup on settle | Official contract and project API readback; no lifecycle execution claim |
| Conductor | Generated `.conductor/settings.toml`: setup/run/archive | Check local overrides; run only after setup succeeds | Official scripts reference; not installed/tested |
| Superset / Paradev | Generated `.superset/config.json`: setup/run/teardown | Enable waiting for setup before agent launch; check user overrides | Official lifecycle reference; not installed/tested |
| Cursor editor / Agent worktrees | Generated `.cursor/worktrees.json`, Unix setup only | Run/cleanup in terminal or VS Code task; see Worktrees Setup output on failure | Official worktree reference; not installed/tested |
| VS Code editor | `.vscode/tasks.json`, explicit setup/run/cleanup process tasks | Run Task; open remote folder with Remote SSH/WSL as appropriate | Official Tasks reference; no UI test |
| Claude Code coding agent | Existing instructions/hooks preserved | Run shared commands in its checkout; no new prompt hooks | Official hook reference; no end-to-end pass |
| Codex coding agent / desktop host | Existing `.codex` preserved | Desktop local environment Setup script and Actions; CLI uses terminal commands | Official local-environment reference; no end-to-end pass |

All script entries below are relative to the active checkout root. They use an
explicit Bash script/shebang and resolve their own checkout, independent of ADE
variables. GUI launchers must find `bash` and (after bootstrap) `mise`; setup loads
pinned tool paths. On a new checkout run setup once; after dependency/tool changes
rerun it. Run and cleanup operate on the machine hosting that checkout.

### Orca

Set **Settings → Repository → Hooks** worktree setup to
`./libs/tools-harness-ts/workspace/prepare.sh`. Save project Quick Commands for
`./libs/tools-harness-ts/workspace/run.sh` and
`./libs/tools-harness-ts/workspace/teardown.sh`. These settings live outside the
repository. The public hook reference does not establish a separate hook shell/cwd
contract: use the new checkout root as cwd if your build exposes that setting;
otherwise run Setup explicitly in its worktree terminal. Do not guess hook variables.
Setup is for new worktrees, not every agent turn. The CLI guide
supports `--setup run|skip|inherit`; check terminal output and rerun setup after a
failure. Official documentation does not establish an automatic repository cleanup
file or its failure guarantees, so run cleanup explicitly before removal.

Local terminals default to the selected system login shell; the scripts explicitly
use Bash. On Windows select WSL and keep the checkout on the WSL filesystem.
SSH worktrees execute on the remote host; install prerequisites there, not merely
on the desktop. Open the printed URL in the worktree browser. For remote sessions,
use Orca's Ports panel to forward the host's web **and API** ports; browser/API
loopback origins must remain reachable. Do not expose development ports publicly.
Automatic forwarding/origin rewriting of this multi-origin stack is unverified.

Sources: [hooks](https://www.onorca.dev/docs/agents/hooks-memory),
[terminal and Quick Commands](https://www.onorca.dev/docs/terminal),
[SSH and ports](https://www.onorca.dev/docs/ssh),
[worktree browser](https://www.onorca.dev/docs/browser/overview).

### T3 Code

Only two project actions are exposed:

| Action | Purpose |
| --- | --- |
| Run app | Installs missing dependencies, starts the checkout stack and its protected tunnel, and prints the browser URL |
| Stop app | Stops this checkout's services and connector; also runs when its worktree settles |

There is no separate setup or preview action. Worktree creation starts no services.
Run executes in the active worktree, otherwise the project root. Local state is
preserved across restarts. Use the printed HTTPS URL in your normal browser.
Each worktree owns its ports, connector and URL. The client API and WebSocket
connections use that same public origin.

`t3.json` is generated by `bun run workspace:sync`. Import it through T3 project
settings on another machine. Saved actions are a snapshot; reimport after a
change. Other developer tasks remain available through the repository's canonical
commands (`bun verify`, `bun fmt`, `bun obs last`, `bun run storybook`).

### T3 Browser on Linux and WSL

T3's Browser runs on the execution host and streams the page to the desktop.
Open the Browser panel and enter the current checkout's printed web URL (the
`webOrigin` in `.cache/localhost-stack/dev.json`). Each worktree has its own URL;
A tunnel is needed only for access outside that host's browser.

Browser libraries are installed once per host and survive worktree changes and
reboots. On Ubuntu 26.04, install the missing runtime packages with:

```sh
sudo apt-get install --yes --no-install-recommends libnspr4 libnss3 libasound2t64
```

On WSL, the Windows account that owns the distribution can perform this setup
from its WSL terminal without a separate Linux administrator password:

```sh
/mnt/c/Windows/system32/wsl.exe --distribution "$WSL_DISTRO_NAME" --user root --exec apt-get install --yes --no-install-recommends libnspr4 libnss3 libasound2t64
```

Host repair verified on Ubuntu 26.04/WSL (2026-11-02): T3's automated browser
assertions loaded the checkout's web URL, required the configured product title and the
rendered Spaces screen, and rejected a Vite error overlay. This establishes T3
browser access on this host; full release verification remains separate.

### HTTPS preview lifecycle

Run always starts an email-protected Cloudflare Quick Tunnel for the development
stack. The allow-list uses the developer's existing `git config user.email`.
That address must receive email PINs; GitHub no-reply addresses are refused with
a corrective action. No Cloudflare account, provisioning script or separate
preview settings are needed. Harness instances do not start public tunnels.

Open the printed HTTPS URL on your viewing device and complete the email PIN
sign-in. The app renders on that device, eliminating streamed-browser input
delay. Requests still have network latency to Cloudflare and the execution host.
The frontend injects its viewing origin for API, HTTP, WebSocket, simulated-provider
and object-store destinations, routing only to this worktree's planned ports.

Each checkout owns its connector and address. The actual URL is recorded in
`.cache/localhost-stack/dev/preview/origin.json` and
`.cache/localhost-stack/dev/services/preview.json`. Stop closes the connector and
removes its runtime address. Restart creates a new hostname. The namespace,
environment, canonical checkout path and atomically persisted machine identity
isolate worktrees even across machines with identical paths.

[Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
have no uptime guarantee, allow 200 in-flight requests and do not support SSE.
These are ephemeral development connections; they provision no account resources.

### Storybook from another computer

For standalone Storybook on the execution host, run:

```sh
STORYBOOK_HOST=0.0.0.0 bun run storybook
```

Open a printed **LAN** URL on the viewing computer. Its `localhost` points to
itself, not the computer running Storybook. LAN mode binds `0.0.0.0`; the default
**Run Storybook (local or tunnel)** action stays on loopback. Permit the printed
port in the host firewall when using LAN access. Use this on a trusted network.

For a remote T3 environment, forward the printed port using that environment's
port-forwarding facility. Alternatively, run the printed SSH forwarding command
on the viewing computer, replacing `<user>@<server>` with the execution host.
Then open the local forwarded URL. HTTP and WebSocket traffic must both pass
through a reverse proxy; an SSH TCP forward carries both automatically.

The actual port defaults to the checkout's workspace block +2. `STORYBOOK_PORT`
can pin a different port; an occupied port fails instead of silently changing it.
The launcher prints addresses and records `starting`, `ready` and `stopped` in
`pkgs/ui-root-harness-ts/.cache/storybook-dev.json`. Use that file when the full
stack already owns Storybook; a second action does not start another copy.
Stop local services before changing the binding of an existing running stack.

The same network settings apply to standalone and full-stack Storybook:

```sh
STORYBOOK_HOST=0.0.0.0 ./libs/tools-harness-ts/workspace/run.sh
# Optional aliases / reverse-proxy external origin:
STORYBOOK_ALLOWED_HOSTS=studio.local STORYBOOK_ORIGIN=https://preview.example.test \
  STORYBOOK_HOST=0.0.0.0 bun run storybook
```

`STORYBOOK_ALLOWED_HOSTS` is a comma-separated list of explicit hostnames, not
wildcards. LAN IP addresses and loopback remain usable. For an HTTPS reverse
proxy or a different external port, `STORYBOOK_ORIGIN` supplies its public origin
(no path or credentials); its hostname is allowed automatically and WebSockets
use that origin. Without an override, live connections follow the browser's
accessed hostname and port, including plain TCP forwarding to a different port.
No fixed preview URL is saved in T3 because workspace ports vary.

The package-owned `ci:storybook-remote` gate loads a real story through a LAN
interface, a hostname and a forwarded port, checks live WebSocket origins,
rejects unknown hostnames, and checks readiness and duplicate-start behavior.

### Other hosts and agents

[Conductor](https://www.conductor.build/docs/reference/scripts) runs setup for new
workspaces, actions from the active workspace in noninteractive shells, and archive
cleanup. Its allocated `CONDUCTOR_PORT` is local-only; our launcher uses its own
selection in local or cloud workers. [Superset/Paradev](https://docs.paradev.com/setup-teardown-scripts)
runs setup on create, run on demand, teardown on deletion in the workspace; user
config can override each key. Existing super.engineering and cmux adapters remain.
[Cursor](https://cursor.com/docs/configuration/worktrees) supports Unix worktree
setup commands; no undocumented cleanup key is added.

[VS Code tasks](https://code.visualstudio.com/docs/debugtest/tasks) are explicit
commands, not a worktree lifecycle system. [Claude Code's WorktreeCreate hook](https://code.claude.com/docs/en/hooks#worktreecreate)
replaces worktree creation itself, so it is not used merely to install dependencies.
[Codex desktop local environments](https://learn.chatgpt.com/docs/environments/local-environment)
provide setup on new worktrees and on-demand actions; configure these through the
app rather than guessing generated file contents. Codex CLI and Claude Code are
coding agents and inherit the execution host's environment; neither needs server
restart on each message. Cloud agent setup belongs in that provider's environment
settings; provision development-only credentials explicitly on that worker.

## Platform and validation limits

The lifecycle requires Bash, Git, curl, standard Unix tools and outbound downloads.
macOS arm64 is the validation host. Linux and WSL are intended Unix execution
paths, not validated by this audit; native Windows PowerShell/cmd execution is
unsupported by these shell scripts. Apple native tasks require the pinned Xcode
on macOS; do not interpret skipped native tasks as a build pass. Existing CI uses
Linux for non-native verification. No claim is made that installing a desktop ADE
on Windows makes this repository's full stack natively Windows-compatible.

Validation on macOS arm64 (2026-10-31):

- Two disposable detached worktrees completed frozen setup and a subsequent setup
  after manifest changes. Their lockfiles remained byte-identical; neither acquired
  `.cache/secrets`. Setup/run failure and idempotence cases have automated tests.
- Concurrent stacks returned HTTP 200 for `/`, `/api/health`, and
  `/api/health/ready`, with distinct web/API/database endpoints and data directories.
  Product web ports were 5424/5312; Storybook ports were 5426/5314.
- Cleanup of the first workspace left the second API ready. Repeated cleanup
  closed both web/API listeners and retained local data.
- Orca browser and T3 Preview each passed an automated URL/document-root assertion
  on the first web page; both tabs were closed. These checks do not validate remote
  port forwarding, automatic lifecycle settings, or application journeys.
- 23 focused lifecycle/configuration/local-stack tests passed. Tools package lint
  and type check passed; product and UI harness lint/type checks passed. Naming,
  lifecycle configuration drift, cache sync and known-bug goals passed.
- The complete release gate failed at `@pkgs/clock-shared-swift#tc`: this host
  lacks pinned Xcode 27.1 and the iOS SDK (only Command Line Tools are installed).
  `bun verify` was attempted; after interrupting stale snapshots during iteration,
  the final current-source gate ran with `VERIFY_PROFILE=release bun run
  libs/tools-harness-ts/scripts/turbo-ci-run.ts verify`, without credential loading.
  This is not a green full verification. No native check was skipped or weakened.
- No full ADE
  creation/deletion lifecycle or remote worker was exercised. No paid service,
  production mutation, or ADE installation was used.

The first concurrent run exposed the fixed Storybook port collision. The next
run exposed an implicit Infisical login for shared reference data; default local
APIs now use their disposable S3 bindings. Both defects have pinned regression
examples and known-bug entries.
