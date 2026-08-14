# `@pkgs/system-console`

Capture system/DST timelines into an ObjectStore and browse them in the
product client Console tab (`SystemConsoleApp`).

- **Client:** `@pkgs/system-console/client` — RN UI (`Reports` / `Playground` / `Session`)
- **Server:** `@pkgs/system-console/server` — Hono app mounted at `/system-console` on `@apps/api`
- **Writer:** `@pkgs/system-console` — `SimulationReporter` / `createReportingDriver` for DST

Product App and playground boot are injected through `SystemConsolePorts`.
Local artifacts still land in `<repo>/system-console-data` when writers use the
local ObjectStore path helpers.
