# Reports explorer

Behavior is defined in [the developer-tools specs](../../specs/developer-tools/).
The explorer uses [the product design system](../ui-root-client/README.md).

## Composition

`RemoteReportsApp` receives HTTP, timers, navigation, an optional cache, and
commit selection from its host. Its host provides the standard i18n, clock,
theme and overlay contexts. Storage failures do not gate initial rendering.

`ScreenBase`, `FilterBar`, `ExplorerWorkspace`, `InspectionWorkspace`, `MetricStrip`, `DocumentPanel`,
`MenuSection`, `MenuRow`, state components and the standard command palette
compose the explorer. The compact layout opens the selected spec on its own;
wide layouts retain the inventory alongside the detail. Inventories and check
collections paginate before rendering. Documents are text, never injected HTML.

The API exposes a commit's inventory and independent report parts at
`/api/reports/<sha>/explorer`, with individual documents at
`/api/reports/<sha>/spec?path=<path>`. Existing source, timeline, stylesheet and
frame endpoints remain lazy. Missing inventories, unavailable stores, failed
reads and absent measurements have separate explanatory states and refresh.
Navigation and playback belong to one mounted viewer and release their timers
and listeners on disposal.

## Producing evidence

The shared storage and producer contract are documented in
[@pkgs/harness-report-shared](../harness-report-shared/README.md).

Full verification publishes every file in `specs/` before publishing the run.
Behavior tasks publish their outcomes and a separate recorded-performance part.
The UI quality task publishes measured scores and its configured threshold.
Cached task reuse preserves those measurements under the new commit hash.
Recorded action times include harness work and waits; they are diagnostics.
Browser paint budgets require a producer of those actual measurements.

Locally, Vite and the local stack serve the committed checkout inventory even
without a shared-store read credential. The version list identifies dirty
checkouts. Working edits are excluded from evidence attributed to a commit.

After committing, run any package's `test:spec` and/or the product's
`prepare:ui-quality`, `prepare:ui-quality-model`, and `check:ui-quality` tasks.
Then run:

```sh
bun reports:collect
bun reports:performance 50
```

Collection accepts only completed buckets whose origin records identify the
same clean commit at the start and end of their run. The second command can
recompute the diagnostic allowance from collected timelines independently.
Local artifacts stay in `.cache/local-reports` and use the same read API.

A separate automated producer can record a complete report part with
`bun reports:part <repo-relative-path.json>`. Add `--publish` only when publishing
to the shared store with its write credentials supplied in the environment.
These commands produce evidence; they do not change the release decision
specified in [the repository briefing](../../README.md#correctness-machinery).

## Investigating recorded runs

`Ctrl/Cmd-K` opens the design-system command palette. Arrow keys step through
frames and steps; `N` selects failures, `Home`/`End` select the first/last frame,
and `Space` controls playback. `?` opens the standard shortcut modal.

Snapshot clients retain one shadow tree per actor. Stylesheets are loaded once,
frames arrive lazily, and recorded press paths resolve inside the snapshot.
The performance inspector retains measured self time, execution time and
snapshot time; missing measurements remain unavailable. Its heatmap is bounded
and selecting a measured step opens that step's recorded moment.

Replay, timeline and state share the inspection workspace. Wide layouts retain
the replay beside the selected tool; compact layouts make every pane selectable.
