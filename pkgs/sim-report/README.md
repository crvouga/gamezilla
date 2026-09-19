# `@pkgs/sim-report`

SolidJS + TailwindCSS report viewer for `@pkgs/sim` runs. Built with Vite as a
`<sim-report>` web component and inlined into standalone `index.html` artifacts
(or mounted directly in apps).

## Usage

### Standalone HTML artifact

```ts
import { writeHtmlReport } from '@pkgs/sim-report';

await writeHtmlReport({
  store, // ObjectStore with runs/<runId>/…
  runId: 'latest',
  out: artifactStore,
  title: 'My run',
  frameCss, // optional CSS injected into html iframe previews
  junitXml, // optional JUnit overlay
});
// → artifactStore `index.html`
```

Rebuild the viewer bundle after UI changes:

```sh
bun run --filter @pkgs/sim-report build
```

The viewer is keyboard-first: `Ctrl/Cmd-K` opens a searchable command palette,
`←` / `→` step frames, `↑` / `↓` jump between steps, `N` / `Shift+N` cycle
failures, `Home` / `End` and `Space` (play) cover the rest. The timeline is a
native range control with coalesced drag updates and failure / press markers;
the URL hash follows on a trailing debounce.

Each client panel keeps **one** sandboxed (`allow-same-origin`, no scripts)
iframe for the whole session: `frameCss` and fonts load once, and every frame
swaps the parsed snapshot DOM in place (`lib/snapshot-surface.ts`), so
scrubbing never flashes. Panels are keyed by actor id; a client without a
snapshot in the current frame shows its latest earlier one, dimmed.

Press highlights come from `ReportFrame.hit`, set only on the frame captured
right before a UI step acts. The viewer resolves `hit.path` against that
snapshot with the driver's chained first-match semantics and draws a single
overlay from real layout; if the target is absent it says so instead of
guessing.

### Embed in an app

```ts
import { defineSimReportElement } from '@pkgs/sim-report/element';
import type { HtmlReportBundle } from '@pkgs/sim';

defineSimReportElement(); // no-op if already defined

const el = document.createElement('sim-report') as HTMLElement & {
  data: HtmlReportBundle & { title: string };
  frameCss?: string;
};
el.data = { ...bundle, title: 'Embedded' };
host.appendChild(el);
```

Or mount the Solid root:

```tsx
import { SimReportApp } from '@pkgs/sim-report/client';

<SimReportApp data={{ ...bundle, title: 'Embedded' }} frameCss={frameCss} />
```

## Entries

| Import | Surface |
| ------ | ------- |
| `@pkgs/sim-report` | `writeHtmlReport` / `renderHtmlReport` (Node-safe) |
| `@pkgs/sim-report/client` | `SimReportApp` + `defineSimReportElement` |
| `@pkgs/sim-report/element` | `<sim-report>` custom element only |

## Layout

```
src/
  app/           Solid root + hash routing + keyboard
  components/    header, steps, toolbar, scrubber, phone/doc stages
  lib/           pure helpers (frames, format, hash, phone)
  element.tsx    <sim-report> custom element
  write.ts       writeHtmlReport / buildHtmlReport
  render.ts      standalone HTML shell (inlines generated artifact)
  generated/     ARTIFACT_JS / ARTIFACT_CSS from `bun run build`
```
