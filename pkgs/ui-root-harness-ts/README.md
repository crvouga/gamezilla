# Storybook development

Storybook 10 is the canonical UI development and discovery environment. It imports
production Solid components and the same fonts, token CSS and host styles as the
application. It needs no API, database, identity provider or full app stack.
The old `/ui` routes and their registry have been removed.

The sidebar's **Start here** page documents the project workflow, commands,
virtual time and agent discovery. Design-system branding and this guide replace
Storybook's generic onboarding checklist. All [Essentials](#essentials-review-and-usage) features and Interactions
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

## Agent workflow

Use this workflow for UI components, screen compositions, visual changes and UI
reviews. Agent instructions link here; `/storybook-ui <task>` loads the same
workflow in every supported harness. Product behavior still comes from
[`specs/`](../../specs/); the visual contract comes from the
[design system](../ui-root-client-ts/README.md). Storybook makes those contracts
concrete without defining a second product.

### Discover before building

1. Identify the owning production package and existing consumers. Generate the
   inventory with `bun storybook:coverage` when it is missing or stale.
2. Search `.cache/storybook-coverage.json` in this package for components,
   stories, consumers and tests. Resolve story IDs and source paths from
   `.cache/storybook/index.json`; read `.cache/storybook/manifests/components.json`
   for documented props and focused usage examples. Read the production
   prop declarations before choosing a component or extending its API.
3. Reuse an existing component or composition when its contract fits. If a
   needed state cannot be expressed, extend the owning design-system component
   with a closed prop or variant before composing it in a screen. Record the
   chosen component, source path and story IDs in the work summary.

The inventory's story/test links are source-reference reachability, not proof
that a component or every state has rendered. A hidden search region or closed
modal needs a named visible-state story or deterministic play that reaches it;
its parent merely importing it does not supply screenshot or accessibility
evidence. Use the full browser suite and owning contracts for that evidence.

Use the static artifacts without starting a server. When interactive previews
help design or debugging, use the owned launcher described above. If the
Storybook MCP connection is available, discover its tools and use its returned
preview references; otherwise use the static index, manifests and source. MCP
availability is optional, never a reason to invent APIs or block the task.

### Build components and compose screens

| Change | Work in Storybook | Verification ownership |
| --- | --- | --- |
| Component or variant | Extend its colocated CSF story using the real production component and documented props. | The owning UI harness covers component contracts. |
| Screen or layout | Compose existing production components; extend a reusable template story for representative screen states. Keep domain queries, mutations and permissions in their owning product packages. | Product specs and their harness cover behavior; UI contracts cover presentation and interaction. |
| Visual defect | Add the literal failing state to the appropriate story and pin the regression in its owning automated verification. | Follow the repository regression registration rule in [AGENTS.md](../../AGENTS.md#hard-rules). |

Develop the reusable presentation in Storybook before wiring its product consumer.
Keep actual screen compositions in their owning product package. The current
Storybook discovers `pkgs/*-client-ts` slices; it does not import product `libs/`
screens. Use their existing shared template stories and product harness coverage;
do not copy a screen into a demo or pretend its domain behavior is covered by a
component story.

For each changed surface, choose meaningful states from its contract: loading,
empty, populated, success, failure with a recovery action, disabled and permission
denial where applicable. Include long or localized content and narrow layouts
when they stress the composition. Use deterministic fixtures and injected ports,
not live accounts, backend calls or sleeps. Follow [Native story features](#native-story-features)
for Controls, callback spies and executable interactions. Keep keyboard and focus
assertions in the owning DOM contract tests; a screenshot cannot prove them.

### Review with evidence

Assess hierarchy, spacing, typography, token use, responsive layout, readable
copy, focus visibility and recoverable error states against the design-system
contract. Use the [Essentials review tools](#essentials-review-and-usage) for each
applicable concern. Use both themes and relevant phone, tablet and desktop sizes. Preview
inspection informs design; it is never a manual test or release evidence. If a
required interaction or layout is not reached by existing verification, extend
that verification rather than treating a preview as proof.

Run these commands sequentially from the repository root. Storybook build,
coverage and test tasks share generated output; concurrent invocations can remove
files while another task is reading them.

1. `bun storybook:coverage` builds the canonical index/manifests and checks their
   source, story and baseline coverage. Address relevant violations.
2. `bunx turbo run tc test --filter=@pkgs/ui-root-harness-ts` checks the UI harness.
   Also run the changed component's owning harness tasks when it lives elsewhere,
   such as the chess-board harness; use the owning package's declared tasks.
3. `bun storybook:build` refreshes the static site; `bun storybook:test` then runs
   browser comparisons and accessibility checks. See [Browser checks and baselines](#browser-checks-and-baselines)
   for the pinned renderer and intentional baseline authoring.
4. `bun verify` runs the whole release gate. A focused pass does not replace it.

In a review or handoff, report changed components and story IDs, reuse or API
choices, covered states, automated commands and their actual results, and any
coverage or environment limitation. Distinguish evidence from the representative
release browser suite and the full Storybook suite. Never claim a check passed
because it started, a story opened, or a screenshot was regenerated.

### Maintain with the production contract

When adding a new story-owning package, update the explicit owning-package
inputs/dependencies in this package's and `ui-codegen-server-ts`'s `turbo.json`.
The codegen `storybook-cache-inputs` test checks that every dynamically discovered
story owner is hashed; do not replace the bounded inputs with a repository-wide
glob. Refresh source edges with `bun run cache:sync` after import changes.

Update stories, fixtures, source JSDoc, controls and contract tests alongside a
prop or state change. Update consumers in the same change; remove obsolete
stories and fixtures when a component is removed. Preserve explicit CSF IDs when
renaming sidebar titles so links and baseline paths remain stable. Follow
[Sidebar organization](#sidebar-organization) when adding a story, including the
separation between game-specific surfaces and shared screens.

Treat a baseline change as an intentional visual change: explain its cause,
inspect the generated differences for design decisions, then run comparisons
without the update flag. Do not regenerate screenshots to hide unexpected
failures. Keep generated manifests and inventories untracked; refresh them after
source changes instead of maintaining a parallel component registry. A UI change
also follows the [self-service readiness definition](../../docs/SELF_SERVICE_READINESS.md)
when it affects a person-facing flow.

Stories live beside production implementations in `pkgs/*-client-ts/src/<component>/`. Each vertical slice keeps the implementation, source JSDoc, local styles, CSF stories, deterministic examples and `baselines/chromium/` together. Public module imports remain stable. The harness owns the Storybook runtime and browser suite; production entrypoints never import stories or fixtures. Storybook discovers the slices together, including game-specific components. Keep static state matrices for side-by-side comparison; use args-based stories
for prop exploration in the Controls panel. Do not add demo-only selectors for
props, themes or viewport sizes. Component APIs come from production JSDoc
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
is confined to stories. The Solid adapter extracts props from TypeScript.

The adapter generates `/manifests/components.json`, `/manifests/components.html`
and `/index.json` in static builds. The current Solid adapter does not reliably serve the
manifest over the dev endpoint: use the static manifest or inventory CLI for
agent prop/document discovery. MCP preview discovery is tested separately. These are the canonical
Storybook component contracts and story IDs. `@storybook/addon-mcp` exposes the
Storybook MCP endpoint during development; configure an agent's HTTP MCP client
for `http://localhost:6006/mcp`. The generated inventory adds source/test/consumer
links to those same stories; it does not define another component registry.

### AI documentation and manifest curation

Follow Storybook's [AI best practices](https://storybook.js.org/docs/ai/best-practices)
alongside the workflow above. Each reference story should explain one concept
or use case and why a consumer would choose it. Keep broad comparison galleries
for visual review, and add focused args-based siblings for reusable examples.
Use JSDoc directly above exported stories: the Solid adapter extracts those
comments into story manifests; a Docs parameter alone does not supply them.
Lead with the reason to use the example, then describe any relevant constraints.

Document a component's purpose and alternatives above its export, with a concise
`@summary` where helpful. The installed Solid adapter retains component summaries
as `jsDocTags.summary`; it does not populate first-class component or story
summary fields. Put the purpose first in descriptions too. Document prop meaning,
defaults and important constraints on the production type rather than maintaining a second API table
in stories. Autodocs and generated contracts reuse that source. This project
uses the Solid adapter's TypeScript extraction; the React-specific
`react-docgen-typescript` recommendation does not apply. Check generated output
after changing extraction or upgrading Storybook: manifest APIs are in preview,
and the installed adapter's capabilities determine what agents actually receive.

Use native `tags: ['!manifest']` on comparison galleries or implementation-only
regression stories when focused references already cover the component. This
curates agent context without removing sidebar entries, story IDs or browser
coverage. Do not remove a component's only reference merely because it is a
gallery. The full `/index.json` remains the discovery source for every story;
the curated manifest is not the coverage inventory.

The native inline `/manifests/components.json` embeds component descriptions,
`reactComponentMeta` (the adapter's name for Solid prop metadata) and story
snippets. `/manifests/docs.json` embeds MDX content and summaries for guides.
The experimental docgen server is disabled
because the installed adapter ignores story-level `!manifest` in that mode.
Keep curation on the native inline path rather than adding a custom filter.
The Vite docgen hook uses the same discovered component-owner directories as the
story index and skips preview fixtures. Source `tsconfig.json` files in the
design-system, developer-tools and chess packages retain production options and
stories while excluding unrelated test/script roots from metadata extraction.
Full typechecking still uses `tsconfig.tc.json`. Storybook hashes these source
configs explicitly, while production `src` tasks exclude them to avoid
invalidating application consumers.
Verify representative generated descriptions, prop contracts and curation in the
harness tests after a build.
Source snippets do not prove that decorators or play reached a visible state;
use the browser evidence described above for that.

For unattached MDX, set `summary` on `Meta` and put essential
guidance directly in the source. Its manifest is statically extracted; a mapped
token gallery or imported runtime value is not a documented list of its values.
Keep the production design-system contract authoritative and link to it rather
than copying it into another specification. Keep guides intended for agents in
the manifest; use `!manifest` for material that would mislead reuse.
New MDX guides also need discovery in `storybook/main.ts` and explicit build
cache inputs; the current discovery includes only the Start here guide.

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

For retained Ubuntu comparisons, dispatch the focused diagnostic with
`gh workflow run verify-nightly.yml --ref <branch> -f group=storybook`.
Add `-f update-storybook-baselines=true` for explicit reference authoring. That
mode runs the full browser suite again against the authored images and retains
`storybook-baselines.patch` in `verify-nightly-storybook-<run-id>`, alongside
comparison evidence. Review the image changes, apply the patch, and commit the
references. The job only writes its checkout and artifacts; it never pushes.

Axe cannot prove keyboard or focus contracts. Existing Bun DOM interaction tests
cover those independently; play functions document story-specific contracts.

Production `src` hashes exclude stories, examples, baselines and shared preview scaffolding. Storybook tasks explicitly hash those inputs, so preview changes do not fan out to application consumers.

The release gate runs coverage, static Storybook builds, DOM contracts, and a
representative browser suite through `ci:storybook`. The visual nightly group
also runs every story in both themes, with desktop screen/layout variants and a
tablet shell. These use the same tests, not a second visual catalog. Serious and
critical axe failures block the corresponding gate. Interactive addon inspection stays available in Storybook; the browser suite
owns automated axe runs so two analyzers cannot race on the same document.
Storybook 10.6 selects on-demand inspection with `initialGlobals.a11y.manual: true`;
`parameters.a11y.manual` is ignored. Keep `parameters.a11y.test: error` for explicit
native scans, and keep the automated browser axe gate unchanged.
Browser readiness follows Storybook's native play phases and successful
`STORY_FINISHED`, including failed reporter status. An args rerender finishing
while the original play is still running is not evidence that play succeeded.
The lifecycle adapter in `storybook/story-readiness.ts` correlates those events
and removes listeners on cleanup; the browser suite checks that native outcome.

The release suite also checks the project guide and a real Controls update
through the Storybook manager. `storybook:coverage` measures component/story,
documentation and baseline coverage; `bun verify-nightly coverage` owns the
repository's deeper line and assertion coverage.

Generate the deeper source/token/keyboard inventory with
`bunx turbo run @pkgs/ui-codegen-server-ts#inventory`. Its `.cache/inventory.json`
and `.cache/inventory.md` derive from CSF and production source. Generated reports
stay untracked; source types, JSDoc, token documents and stories remain authoritative.

## Sidebar organization

Foundations introduces the tokens. Atoms holds basic controls and visual roles;
Molecules combines them into fields, rows and choices; Organisms groups complete
interactive regions; Templates holds screen and layout compositions.
`Games` separates game-specific surfaces into a folder per game, such as
`Games/Chess/Board` and `Games/Connect Four/Board`. Reusable game screens and
layouts live in `Games/Shared/Screens`; reusable game regions live in
`Games/Shared/Components`. These sidebar folders are defined by CSF titles;
source files stay beside their production components.
Explicit IDs preserve existing deep links and baseline paths when sidebar titles
change. Public component imports retain their production names.

## Native story features

Use the [Essentials guidance](#essentials-review-and-usage) for args, parameters,
callback spies and inspection. The colocated
[Button stories](../ui-root-client-ts/src/button/button.stories.tsx) show shared
meta, conditional controls and native callback spies;
[Checkbox](../ui-root-client-ts/src/checkbox/checkbox.stories.tsx) and
[TextInput](../ui-root-client-ts/src/text-input/text-input.stories.tsx) show
`useArgs` synchronization; Switch, Select and NumberStepper also expose their
production props and interaction payloads through controlled sibling stories. The
[Banner](../ui-root-client-ts/src/dismissible-top-banner/dismissible-top-banner.stories.tsx)
shows controlled visibility and the
[GameArena](../ui-root-client-ts/src/game-board-stage/game-arena.stories.tsx)
shows primitive custom args for a nested composition and visible searching/
cancellation states. MutationModal has named open, loading, success, error and
recovery stories; its original launcher gallery remains available.

For `useArgs` stories with callback assertions, set the native
`parameters.test.restoreMocks: false` on their meta/story: Storybook 10.6's
loader otherwise restores spies on each args rerender during the same play.
Clear each asserted spy at the beginning of play with `mocked(spy).mockClear()`
from `storybook/test`; retain fresh mount isolation and avoid cross-play call
history. Do not disable this isolation globally for unrelated stories.

Keep exploratory stories free of scripted state changes. Put interaction
examples in separate stories when a play function types or dismisses content.
Await `userEvent` and `expect` from `storybook/test`, scope queries with `within`,
and group meaningful interactions with `step`. Do not replace these with raw
DOM clicks, microtask sleeps or custom assertions. Each play starts from fresh
args and must finish deterministically without wall time. Virtual time remains
an injected product port; Storybook does not replace that requirement.

## Essentials review and usage

This audit covers the entire [Essentials set](https://storybook.js.org/docs/essentials/)
for our pinned Storybook 10.6, including Measure and Outline individually. They
ship in core: keep the default features enabled in `storybook/main.ts`, rather
than installing the old Essentials bundle or separate addons. Docs, accessibility
and MCP remain explicit addons; play functions and Interactions complement
Essentials. The following table records the gaps addressed and the intended use.

| Feature | Implementation and review practice |
| --- | --- |
| [Actions](https://storybook.js.org/docs/essentials/actions) | Callback spies were missing from several Button states. Button now shares explicit `fn()` args and its renderer through typed meta; controlled inputs and the banner retain their spies. Inspect payloads in Actions and assert them in play. Call the spy before updating args. Prefer explicit spies to `argTypesRegex`, which cannot supply play assertions. For non-arg functions use `fn().mockName('name')`; use native `actions.handles` only when delegated DOM event logging is actually needed. Never build an event-log panel into a demo. |
| [Backgrounds](https://storybook.js.org/docs/essentials/backgrounds) | Generic light/dark swatches were unrelated to production tokens and the opaque preview provider concealed the selected backdrop. `preview-options.ts` now supplies Canvas, Surface and Muted surface using production CSS variables; the preview provider is transparent. The native Backgrounds toolbar and its grid work behind components. The default Canvas preserves the production background in both themes. Backgrounds changes the backdrop, while the theme global still selects all production tokens and JavaScript palette values. Components that paint their own surface deliberately obscure the backdrop. |
| [Controls](https://storybook.js.org/docs/essentials/controls) | Keep defaults in serializable `args` (not `argTypes.defaultValue`), render reactive args, and use explicit controls for JSX/string unions, closed options for tokens, and `useArgs` for two-way editing. Button control metadata now applies to every state; conditional success/error labels appear only for the corresponding feedback. Use `mapping` or primitive custom args for JSX, `control: false` for callbacks and injected objects, and `parameters.controls.include`/`exclude` to focus large APIs. Keep `expanded` documentation and required-first sorting. Do not add generic color/date matchers for token names or injected timestamps. The composed GameArena now exposes its nested board interaction flag as a primitive custom arg instead of a demo toggle/signal. Disable Controls only on galleries whose renderer does not consume args. Reset args with the native reset control; never add a duplicate reset button. |
| [Highlight](https://storybook.js.org/docs/essentials/highlight) | Already enabled in core and used by the accessibility addon; no parallel overlay is needed. For targeted design debugging, a story decorator can use `useChannel` from `storybook/preview-api` to emit `HIGHLIGHT` from `storybook/highlight` with an `id` and `selectors`. Scope selectors to `#storybook-root [data-component="Name"]` (or a stable test id). Use `REMOVE_HIGHLIGHT` for that id when finished; story navigation also clears highlights. Avoid `RESET_HIGHLIGHT` in reusable decorators because it clears other addons' highlights. Use native `SCROLL_INTO_VIEW` for an offscreen debugging target. Keep diagnostic highlights out of normal baselines. |
| [Measure](https://storybook.js.org/docs/essentials/measure-and-outline) | Already enabled, previously undocumented. Use the Measure toolbar (or `m`) and hover a region to inspect its box, padding, margin and border before changing token spacing. This replaces ad hoc measurement labels added solely for debugging. The existing `createMeasure` example stays: it demonstrates a production measurement API, rather than implementing an inspector. |
| [Outline](https://storybook.js.org/docs/essentials/measure-and-outline) | Already enabled, previously undocumented. Use the Outline toolbar to inspect the layout boxes of composed screens, clipping and unexpected gaps. Avoid adding temporary borders or custom debug CSS to components. Use `parameters.measure.disable` or `parameters.outline.disable` only when a specific story cannot sensibly be inspected. Both tools start off, keeping ordinary stories and baselines clean. |
| [Toolbars & globals](https://storybook.js.org/docs/essentials/toolbars-and-globals) | The theme toolbar and `createJSXDecorator` already match the documented global/provider pattern. Keep theme selection here; Backgrounds is not a theme provider. Use `initialGlobals` for project defaults and a story/meta `globals` override only for a state that must be fixed: it locks the corresponding toolbar. Keep the virtual-time toolbar/event adapter because Essentials has no injected clock replacement. It advances deterministic product ports rather than wall time. No new demo-local theme, viewport or time controls. |
| [Viewport](https://storybook.js.org/docs/essentials/viewport) | Phone, Tablet and Desktop remain native options, now shared with the automated responsive matrix through `preview-options.ts` instead of repeated dimensions. Use rotation for landscape and native reset for the unconstrained canvas. Use story `globals.viewport` for a deliberately locked viewport, not `parameters.viewport.defaultViewport` from older versions. Do not lock ordinary stories: agents need to explore widths. A browser driver opening `iframe.html` directly still sets its own browser viewport; the manager's resizing UI cannot resize that outer browser. The screenshot matrix retains its established height and filenames. |

### Apply the tools to a task

For a component, start with the smallest args-based story. Vary content, flags
and token options through Controls; exercise callbacks through Actions; use a
separate play story for a deterministic interaction. For a screen composition,
use the existing template stories and real components, explore phone/desktop and
landscape, then inspect layout with Measure and Outline. Switch both production
theme and token backdrop when checking transparent edges and surface boundaries.
Use Highlight to identify a specific region while debugging. Restore inspection
tools and grids to off before authoring a visual baseline.

Keep the existing `SchemePreview` galleries: simultaneous light/dark comparison
is useful and each pane uses a production provider so CSS and JavaScript agree.
They do not replace args-based stories with the global toolbar. Scope gallery
play queries to each theme pane before querying roles or test ids; both panes
intentionally contain the same component identifiers. Keep bounded
screen fixtures when they demonstrate an embedded scroll container; use Viewport
for the outer canvas instead of adding more fixed-width preview wrappers.
Keep product focus/scroll/measure examples and injected virtual-time behavior;
Essentials' inspection features cannot replace those product contracts.

Parameters inherit project → meta → story. Set shared metadata at the narrowest
useful level and use story overrides for actual exceptions. Do not copy the
project preview configuration into each story. Keep long content and recovery
states in deterministic args/fixtures; avoid a new configuration panel or UI
registry. Generated Docs/JSDoc and the existing discovery artifacts remain the
component API source. These tools guide design; the automated evidence described
in [Review with evidence](#review-with-evidence) remains required.

The `storybook integration` browser checks exercise native Controls, Actions,
Backgrounds/grid, Measure, Outline, globals and Viewport against the real built
manager and production components. Highlight is supplied by core and the
accessibility addon; targeted highlight decorators use its public channel API.
No custom inspector or toolbar implementation is required.
