# `@pkgs/sim-console`

Capture sim/DST timelines into an ObjectStore and browse them in
`@product/console` (`SimConsoleApp`).

- **Client:** `@pkgs/sim-console/client` — RN UI (`Reports` / `Playground` / `Session`)
- **Server:** `@pkgs/sim-console/server` — Hono factory mounted at `/sim-console` on `@apps/server` (MinIO / B2)
- **Local reports (`bun run dev`):** `@product/console` serves `<repo>/.cache/sim-console-data` on port `7789` so Jest UI sims appear in Reports
- **Writer:** `@pkgs/sim-console` — `SimulationReporter` / `createReportingDriver` for DST

Product App and playground boot are injected through `SimConsolePorts`
(wired by `@product/console`). Local artifacts land in
`<repo>/.cache/sim-console-data` when writers use the local ObjectStore path helpers.
