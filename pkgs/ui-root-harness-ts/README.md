# Storybook development

Storybook 10 is the canonical UI development and discovery environment. It imports
production Solid components and the same fonts, token CSS and host styles as the
application. It needs no API, database, identity provider or full app stack.
The old `/ui` routes and their registry have been removed.

The sidebar's **Start here** page documents the project workflow, commands,
virtual time and agent discovery. Gamezilla branding and this guide replace
Storybook's generic onboarding checklist. Controls, Viewports and Interactions
are built into the pinned Storybook version; Bun and Playwright own automated
verification, so no Vitest or hosted visual-testing addon is required.

`bun dev` starts Storybook alongside the app servers on port 6006, under the same boot owner. To run Storybook alone, use `bun storybook`.
A checkout has one boot: stop an existing app boot with `bun kill` first.
Use `bun kill` to clean up Storybook too. Build with `bun storybook:build`.
Share the resulting `pkgs/ui-root-harness-ts/.cache/storybook/` directory as a
static site, including its assets, index and manifests. This build does not
publish anything or require a backend. Story links retain their `?path=` query.
Run `bun storybook:coverage` to write `.cache/storybook-coverage.json` and
`.cache/storybook-coverage.md` in this package. The inventory derives component
exports, consumers, stories and tests from TypeScript syntax, without a second
hand-maintained registry. Read the component slice in its production package and the production prop declarations
before adding UI; never invent props or token values.

## Workflow

1. Find the existing story and read the production contract.
2. Edit the production implementation and its CSF stories together.
3. Add representative states and deterministic interactions. Reuse fixtures where
   a compound state matrix is clearer than dozens of combinations.
4. Run `bunx turbo run @pkgs/ui-root-harness-ts#tc @pkgs/ui-root-harness-ts#test`.
5. Run `bun storybook:build` and `bun storybook:test`, then `bun verify`.

Stories live beside production implementations in `pkgs/*-client-ts/src/<component>/`. Each vertical slice keeps the implementation, source JSDoc, local styles, CSF stories, deterministic examples and `baselines/chromium/` together. Public module imports remain stable. The harness owns the Storybook runtime and browser suite; production entrypoints never import stories or fixtures. Storybook discovers the slices together, including game-specific components. State matrices use their own production controls; argument
stories expose the Controls panel. Component APIs come from production JSDoc
and TypeScript in both cases. Each state matrix lives beside its component as `<name>.example.tsx`; only shared preview scaffolding lives in `ui-root-client-ts/storybook/fixtures/`. Production must never import either. Global decorators use
`createJSXDecorator` to keep Solid owners stable across controls and theme changes.
Each mount gets a fresh English localization instance and virtual clock seeded
at a fixed instant, plus production theme and surface-stack providers. Timed
interactions must explicitly advance virtual time; wall timers are forbidden. Use the virtual-time toolbar to advance timed demos
(select Paused between repeated equal steps). Automated drivers dispatch
`advance-story-time` on `#storybook-root`, with milliseconds in the event’s
`detail`, to advance the same per-mount clock. The listener is removed on cleanup.

## Discovery

The adapter’s package resolver does not understand wildcard package exports.
CSF metadata therefore imports the same production implementations by relative
path; application code and fixtures keep public package imports. This exception
is confined to stories. Server docgen avoids repeated transform-time extraction.

The adapter generates `/manifests/components.json`, `/manifests/components.html`
and `/index.json` in static builds. The current Solid adapter does not reliably serve the
manifest over the dev endpoint: use the static manifest or inventory CLI for
agent prop/document discovery. MCP preview discovery is tested separately. These are the canonical
Storybook component contracts and story IDs. `@storybook/addon-mcp` exposes the
Storybook MCP endpoint during development; configure an agent's HTTP MCP client
for `http://localhost:6006/mcp`. The generated inventory adds source/test/consumer
links to those same stories; it does not define another component registry.

## Browser checks and baselines

`bun storybook:test` starts a test-owned static server on 6007 and stops it at the
end. Playwright visits real stories in both themes with local fonts, fixed locale,
time zone, scale factor and viewport. External requests are blocked. Rendering
errors and serious/critical axe violations fail. Screenshot comparisons never
update baselines implicitly. Install the existing pinned renderer with `mise install http:chrome-for-testing`.
Playwright drives that browser; a second downloaded browser is unnecessary.
To author baselines explicitly, run `bun storybook:test --update-snapshots` and
review the resulting PNG changes. Baselines depend on the OS and pinned browser;
use the CI browser environment for shared pixel evidence.

Axe cannot prove keyboard or focus contracts. Existing Bun DOM interaction tests
cover those independently; play functions document story-specific contracts.

Production `src` hashes exclude stories, examples, baselines and shared preview scaffolding. Storybook tasks explicitly hash those inputs, so preview changes do not fan out to application consumers.

The release gate runs coverage, static Storybook builds, DOM contracts, and a
representative browser suite through `ci:storybook`. The visual nightly group
also runs every story in both themes, with desktop screen/layout variants and a
tablet shell. These use the same tests, not a second visual catalog. Serious and
critical axe failures block the corresponding gate. Interactive addon inspection stays available in Storybook; the browser suite
owns automated axe runs so two analyzers cannot race on the same document.
The release suite also checks the project guide and a real Controls update
through the Storybook manager. `storybook:coverage` measures component/story,
documentation and baseline coverage; `bun verify-nightly coverage` owns the
repository's deeper line and assertion coverage.

Generate the deeper source/token/keyboard inventory with
`bunx turbo run @pkgs/ui-codegen-server-ts#inventory`. Its `.cache/inventory.json`
and `.cache/inventory.md` derive from CSF and production source. Generated reports
stay untracked; source types, JSDoc, token documents and stories remain authoritative.
