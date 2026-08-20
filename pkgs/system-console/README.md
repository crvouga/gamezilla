# `@pkgs/system-console`

Capture system/DST timelines into an ObjectStore and browse them in
`@apps/system` (`SystemConsoleApp`).

- **Client:** `@pkgs/system-console/client` — RN UI (`Reports` / `Playground` / `Session`)
- **Server:** `@pkgs/system-console/server` — Hono factory mounted at `/system-console` on `@apps/server` (MinIO / B2)
- **Local reports (`bun run dev`):** `@apps/system` serves `<repo>/system-console-data` on port `7789` so Jest UI sims appear in Reports
- **Writer:** `@pkgs/system-console` — `SimulationReporter` / `createReportingDriver` for DST

Product App and playground boot are injected through `SystemConsolePorts`
(wired by `@apps/system`). Local artifacts land in
`<repo>/system-console-data` when writers use the local ObjectStore path helpers.
