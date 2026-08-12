# `@apps/simulation-report`

Process entry for the simulation report viewer. Wires injected `ObjectStore`
buckets and serves `createSimulationReportServer`.

```bash
bun run --filter @apps/simulation-report build
bun run --filter @apps/simulation-report dev
# → http://127.0.0.1:7789
```

## Env

- `REPORT_DIR` / `SIM_REPORT_DIR` — local FS bucket root (default:
  `<repo>/simulation-report-data`, gitignored)
- `PORT` — default `7789`
- `SIM_REPORT_BUCKETS` — optional JSON array of extra S3 buckets:

```json
[
  {
    "id": "ci",
    "label": "CI",
    "accessKeyId": "…",
    "secretAccessKey": "…",
    "bucket": "…",
    "endpoint": "…",
    "region": "…",
    "rootPrefix": "simulation-report-data/"
  }
]
```

Always includes `{ id: 'local', label: 'Local' }` backed by
`createNodeFsObjectStore` on the repo-root data dir.

`turbo` `dev` (including root `bun dev`) runs `kill` then `build` before the
server: frees port `7789` and rebuilds the `@pkgs/simulation-report` SPA into
`pkgs/simulation-report/dist`.
