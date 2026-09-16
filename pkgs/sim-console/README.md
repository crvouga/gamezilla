# `@pkgs/sim-console`

Simulator screen for `@apps/product` (`/simulator`, a flat sibling of the app; enter via the app palette's "Open Simulator", leave via "Exit simulator"): multi-client
columns, server / PubSub / Room panes, snapshot chrome, command palette, and
the SQL notebook.

- **Client:** `@pkgs/sim-console/client` — Solid UI (`SimConsoleApp`,
  `ProductSimulatorScreen`, `SqlNotebookPane`)
- **Ports:** `SimConsolePorts` — product app + product-simulator boot are
  injected by `@apps/product`; this package never imports apps/libs/test.

Test reports are **not** browsed here. `@pkgs/sim` captures run timelines
(`defineSnapshot` / `run({ report })`) and renders them to a standalone HTML
file (`writeHtmlReport`); see `apps/product/src/test/setup/TESTING.md`.
