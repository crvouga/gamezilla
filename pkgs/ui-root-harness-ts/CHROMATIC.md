# Chromatic publishing and agent access

[Storybook development](README.md) owns the component workflow and local evidence.
Chromatic hosts that same static Storybook and adds cloud comparisons and review.
It does not replace `bun verify`, the Bun contracts or the Playwright/axe matrix.

## Published project

The same static build from `main` is also served at `https://storybook.<domain>`
by the assets-only Worker `@apps/storybook-ts`, released in Release's fleet job
([infrastructure](../../README.md#infrastructure)). Chromatic stays the place for
cloud comparisons and review.

[Latest Storybook on main](https://main--6aea25769c1aa1557bf4af0c.chromatic.com/)
updates after each verified main release. This branch permalink becomes available
after the first main publication. The [initial publication](https://6aea25769c1aa1557bf4af0c-tmrcgmtoyo.chromatic.com/)
is available now.
The connected project is `Project:6aea25769c1aa1557bf4af0c`; its upload token is
stored in Infisical `shared` as `CHROMATIC_PROJECT_TOKEN` (also present in dev/prd).
The first publication contains 239 components and 839 stories. Hosting succeeded;
Chromatic reported no cloud tests because UI Tests/UI Review are not enabled
and the account's billed snapshot limit was reached. Complete
[project setup](https://www.chromatic.com/setup?appId=6aea25769c1aa1557bf4af0c)
and resolve the account limit before treating publication as cloud verification.

## Publish

CI reads `CHROMATIC_PROJECT_TOKEN` from Infisical `shared` through the existing
GitHub OIDC action. No GitHub repository secret is required. Dependency installation
and the explicit static build precede the publishing action's shared-secret fetch;
Turbo passes the Chromatic credential only to `storybook:publish`, never to the
static builder. It is registered as an optional CI-only secret and is never sent
to a product Worker.

Same-repository PRs publish from `verify:end` after a successful deterministic
verdict. This external hosting step is nonblocking and cannot turn a safety
failure green. Chromatic's own UI checks/review remain independent. Fork PRs
receive no publishing credentials. The required verification retains its three
jobs. Release publishing is a separate, blocking `deploy-storybook` job.
Release publishes `main` after its safety gate succeeds, independently of the
product infrastructure deployment. Rehearsals publish nothing. These jobs use
fresh Ubuntu runners and the pinned CLI through an uncached Turbo task. The
upload token enters only the publishing step, after dependency installation and
the explicit static build. There are still exactly four workflows.

For an authorized local publication, inject `CHROMATIC_PROJECT_TOKEN` into the
process environment, then run `bun storybook:publish`. Turbo builds first. This
command publishes externally; `bun storybook:build` remains a local static build.
The CLI prints the build, hosted Storybook and review links. Open the Chromatic
build to investigate a failed capture or play; fix the story or product and
publish again. An upload alone is not a passing cloud test.

The CLI waits for cloud results. Unreviewed visual changes produce a failing
exit status; changes are never auto-accepted, including on `main`. Baseline
approval is a deliberate reviewer decision in Chromatic, separate from the
human-only PR merge. Cloud checks supplement the deterministic `verify:end`
contract; they do not silently redefine its safety selection. Diagnostics and
JUnit results are generated under the harness `.cache/`, never committed.

## Feature ownership

| Capability | Integration or required project setup |
| --- | --- |
| Hosting and permalinks | Every publication hosts the full manager, Docs, story iframes, assets and manifests. Use the CLI's actual branch/build URLs, never invent a project ID. Copy immutable build links for evidence and branch links for latest documentation. |
| Visual tests | All discovered stories participate; six modes cover production light/dark at Phone, Tablet and Desktop using the existing viewport definitions. Keep named visible states and deterministic fixtures. Modes increase snapshot use. |
| Interaction tests | Chromatic executes native awaited `play` functions before snapshots. Keep assertions in `storybook/test`; a failed play must fail the build. |
| Accessibility | The existing a11y addon and `test: error` configuration are shared with Chromatic. Enable Accessibility Tests in the Chromatic project; cloud availability and limits depend on its plan. The local axe matrix remains mandatory. |
| Visual Tests panel | `@chromatic-com/storybook` is installed in the canonical manager. Authenticate the addon with the chosen project to inspect cloud diffs alongside stories. No upload token belongs in preview code. |
| Browsers | Enable Chrome, Firefox and Safari in Chromatic project settings where the account permits. Browser selection is project-side, not a fabricated CLI flag. The pinned local renderer remains the deterministic evidence environment. |
| UI Review and owners | Connect the GitHub integration, enable PR checks/review and assign component owners in Chromatic. Review diffs and accept only intended changes; agents must not auto-approve baselines. GitHub app installation, membership and permissions require account administration. |
| TurboSnap | Intentionally leave `onlyChanged` unset initially. Chromatic unlocks it after ten completed CI builds. Before enabling it, verify monorepo dependency tracing, Vite stats, global styles/fonts and external assets against a full build. Never trade coverage for fewer snapshots without that evidence. |
| Essentials, Docs, MDX, source and manifests | Already native; see the README's complete Essentials audit. The hosted build contains the same generated contracts. |
| Design handoff, Figma and embeds | Use Chromatic story permalinks with its Figma plugin and embed/composition features when consuming a design or another Storybook. There is no configured Figma file or second Storybook to connect today. |
| Notifications and access | Configure project collaborators, least-privilege review access, privacy and optional notifications in Chromatic. Public source does not imply permission to expose private fixtures. Stories contain deterministic example data. |
| Vitest and other renderers | This is a Solid/Bun repository. Do not install Vitest, a React renderer, a duplicate Cypress suite or a replacement UI library just to activate an incompatible feature. |

Account-side settings above are prerequisites, not claims that they are enabled.
Cloud features and paid limits must be checked against the connected project.

## Agents

`bun run agents:sync` generates the local Storybook HTTP MCP entry alongside
Serena for Codex, Claude Code, Cursor, Gemini, OpenCode, VS Code, Factory, Roo,
Kiro and Continue. Start the owned server with `bun storybook` (or `bun dev`),
then reconnect the agent MCP client. The default endpoint is
`http://127.0.0.1:6006/mcp`. A custom `STORYBOOK_PORT` is recorded in
`.cache/storybook-dev.json` in this package; use that checkout's URL instead of
connecting to another checkout. Do not start an unmanaged server for MCP.
Windsurf and standalone Copilot CLI need their per-user MCP configuration;
project generation cannot configure those clients.

Discover the server's actual tools before calling them. The installed Solid
adapter's preview discovery is verified by `storybook:mcp:test`; tool availability
varies by renderer. Generated prop manifests come from the **static build**;
the dev endpoint does not reliably expose them for this adapter. Agents can
read local `.cache/storybook/index.json`, `manifests/components.json` and
`manifests/docs.json` without a server, or fetch those paths from a published
Storybook. Use the inventory to resolve source owners and contracts. Do not
infer a production prop from a screenshot.

Chromatic currently documents hosted `/mcp` for Storybook 10.3+ **and React**,
with Docs tools only. Solid hosted MCP is not a verified capability here.
Do not generate a remote MCP entry until the actual deployed endpoint and tools
are verified. Local MCP plus published manifests supplies discovery in the
meantime. Agents can invoke the Turbo publication task with authorized secrets
and inspect GitHub job logs using `gh`. Account configuration and baseline
approval remain explicit actions; no broad account token is bundled in MCP.

## Upstream references

- [Chromatic configuration](https://www.chromatic.com/docs/configure/)
- [Modes](https://www.chromatic.com/docs/modes/)
- [GitHub Actions](https://www.chromatic.com/docs/github-actions/)
- [TurboSnap prerequisites](https://www.chromatic.com/docs/turbosnap/setup/)
- [Hosted MCP framework support](https://www.chromatic.com/docs/mcp/)
- [Storybook AI and MCP](https://storybook.js.org/docs/ai)
