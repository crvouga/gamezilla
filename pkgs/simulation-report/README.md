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
runs/generation
```

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
  runId: '20240601T120000', // optional; openSimulation mints UTC stamp
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
| Player | `/b/:bucketId/r/:runId/t/:testId?…` |

Keyboard: `⌘K` / `Ctrl+K` opens the command palette (primary control surface).
Player shortcuts include Space (play/pause), ←/→ (frames), M (mode), ] (speed).

```bash
bun run --filter @pkgs/simulation-report build
bun run --filter @apps/simulation-report dev
```
