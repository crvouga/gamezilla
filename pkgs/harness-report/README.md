# `@pkgs/harness-report`

SolidJS + TailwindCSS report viewer for `@pkgs/harness` runs. Built with Vite as a
`<harness-report>` web component and inlined into standalone `index.html` artifacts
(or mounted directly in apps).

## Usage

### Standalone HTML artifact

```ts
import { writeHtmlReport } from '@pkgs/harness-report';

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
bun run --filter @pkgs/harness-report build
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
import { defineHarnessReportElement } from '@pkgs/harness-report/element';
import type { HtmlReportBundle } from '@pkgs/harness';

defineHarnessReportElement(); // no-op if already defined

const el = document.createElement('harness-report') as HTMLElement & {
  data: HtmlReportBundle & { title: string };
  frameCss?: string;
};
el.data = { ...bundle, title: 'Embedded' };
host.appendChild(el);
```

Or mount the Solid root:

```tsx
import { HarnessReportApp } from '@pkgs/harness-report/client';

<HarnessReportApp data={{ ...bundle, title: 'Embedded' }} frameCss={frameCss} />
```

## Entries

| Import | Surface |
| ------ | ------- |
| `@pkgs/harness-report` | `writeHtmlReport` / `renderHtmlReport` (Node-safe) |
| `@pkgs/harness-report/client` | `HarnessReportApp` + `defineHarnessReportElement` |
| `@pkgs/harness-report/element` | `<harness-report>` custom element only |

## Layout

```
src/
  app/           Solid root + hash routing + keyboard
  components/    header, steps, toolbar, scrubber, phone/doc stages
  lib/           pure helpers (frames, format, hash, phone)
  element.tsx    <harness-report> custom element
  write.ts       writeHtmlReport / buildHtmlReport
  render.ts      standalone HTML shell (inlines generated artifact)
  generated/     ARTIFACT_JS / ARTIFACT_CSS from `bun run build`
```
