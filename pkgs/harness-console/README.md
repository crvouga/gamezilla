# `@pkgs/harness-console`

Harness screen for `@apps/product` (`/harness`, a flat sibling of the app; enter via the app palette's "Open Harness", leave via "Exit harness"): multi-client
columns, server / PubSub / Room panes, snapshot chrome, command palette, and
the SQL notebook.

- **Client:** `@pkgs/harness-console/client` — Solid UI (`HarnessConsoleApp`,
  `ProductHarnessScreen`, `SqlNotebookPane`)
- **Ports:** `HarnessConsolePorts` — product app + product-harness boot are
  injected by `@apps/product`; this package never imports apps/libs/test.

Test reports are **not** browsed here. `@pkgs/harness` captures run timelines
(`defineSnapshot` / `run({ report })`); `@pkgs/harness-report` renders them to a
standalone HTML file (`writeHtmlReport`); see
`libs/harness/README.md`.
