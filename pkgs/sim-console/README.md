# `@pkgs/sim-console`

Capture sim/DST timelines into an ObjectStore and browse them in
`@apps/product` (`SimConsoleApp`).

- **Client:** `@pkgs/sim-console/client` — Solid UI (`Tests` / `Simulator`)
- **Server:** `@pkgs/sim-console/server` — Hono factory mounted at `/sim-console` on `@apps/server` (MinIO / R2)
- **Local report dumps (`bun run dev`):** `@apps/product` serves `<repo>/.cache/sim-console-data` on port `7789` so Jest UI sims appear in Tests
- **Writer:** `@pkgs/sim-console` — `SimulationReporter` / `createReportingDriver` for DST

Product App and product-simulator boot are injected through `SimConsolePorts`
(wired by `@apps/product`). Local artifacts land in
`<repo>/.cache/sim-console-data` when writers use the local ObjectStore path helpers.
