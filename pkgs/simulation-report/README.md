# `@pkgs/simulation-report`

Library for capturing UI simulation timelines into an [`ObjectStore`](../object-store)
and serving a multi-bucket React SPA via `createSimulationReportServer`.

Composition (Bun.serve + env / S3) lives in `@apps/simulation-report`.

## Key layout (per bucket)

```text
runs/index.json
runs/<runId>/manifest.json
runs/<runId>/snapshot-shell.css
runs/<runId>/tests/<testId>/steps.json
runs/<runId>/tests/<testId>/frames/f-….html
runs/<runId>/tests/<testId>/frames/f-….alice.html
runs/<runId>/tests/<testId>/frames/db/<sha256>.sqlite.gz
runs/generation
```

Each kept UI frame may list:

- `views[]` — HTML snapshot per live actor (`frames/f-NNNNN.<actorId>.html`);
  legacy `file` points at the acting actor’s view.
- `databases[]` — server + actors. Blobs are gzip SQLite dumps, content-addressed
  by SHA-256 of the uncompressed bytes so identical dumps across frames share one
  file.

## Writer

```ts
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import {
  resolveLocalReportDataDir,
  SimulationReporter,
} from '@pkgs/simulation-report';

const store = createNodeFsObjectStore({
  rootDir: resolveLocalReportDataDir(), // <repo>/simulation-report-data
});
const reporter = new SimulationReporter({
  seed: '1',
  ui: 'in-process',
  store,
  runId: '20240601T120000', // optional; Simulation.open mints UTC stamp
  testId: 'my-scenario',
  now: () => clock.now(),
});
```

Via `@pkgs/simulation`:

```ts
report: {
  store,
  runId?: process.env.SIM_REPORT_RUN_ID,
  testId: 'my-scenario',
}
```

## Server API

```ts
import { createSimulationReportServer } from '@pkgs/simulation-report/server';

const { fetch } = createSimulationReportServer({
  buckets: [{ id: 'local', label: 'Local', store }],
  distDir, // required for SPA static files
  now: () => Date.now(),
});
```

HTTP (bucket-scoped):

- `GET /api/buckets`
- `GET /api/buckets/:id/runs`
- `GET /api/buckets/:id/runs/:runId/manifest`
- `GET /api/buckets/:id/runs/:runId/tests/:testId`
- `GET /api/buckets/:id/runs/:runId/data/…`
- `DELETE /api/buckets/:id/runs/:runId`
- `POST /api/buckets/:id/prune` `{ keepLast?, olderThanMs? }`
- `GET /api/buckets/:id/generation` (SPA polls every ~2s)

## SPA routes

| View | Path |
|------|------|
| Bucket picker | `/` |
| Runs | `/b/:bucketId` |
| Suite | `/b/:bucketId/r/:runId` |
| Player | `/b/:bucketId/r/:runId/t/:testId?step=&frame=&node=&…` |

Keyboard: `⌘K` / `Ctrl+K` opens the command palette (primary control surface).
Player shortcuts include Space (play/pause), ←/→ (frames), M (mode), ] (speed).

### Player layout

Video-editor shell:

1. **Header** — breadcrumb selects (bucket → run → test), status, copy-LLM
   prompt (no transport). Each crumb is a `<select>` that jumps while clearing
   deeper nav.
2. **Node tabs** — one tab per actor + `server` (`?node=` in the URL). Acting
   actor is accented. Actor tabs split **HTML | SQLite**; `server` is SQLite-only
   (no empty HTML pane).
3. **HTML** — per-actor frame views (`frames/f-NNNNN.<actorId>.html`). When
   viewing the acting actor, interacted `testId("…")`
   targets are outlined; `tapAt` draws a crosshair from `xRatio` / `yRatio`.
4. **SQLite** — Diff (prev↔current frame for that node) or Query (Monaco +
   schema browser). Same gzip content-hash dumps as before.
5. **Bottom strip** — Transport + step meta on the top row; full-width frame
   timeline below (segments fill the track, wheel/pinch zoom, DB-change
   markers, heat only on slow frames). Play is a large circular control; other
   buttons are rounded pills.

```bash
bun run --filter @pkgs/simulation-report build
bun run --filter @apps/simulation-report dev
```
