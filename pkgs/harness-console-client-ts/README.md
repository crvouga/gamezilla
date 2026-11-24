# `@pkgs/harness-console`

Harness screen for `@apps/harness-ts` (a site of its own, apart from the app): multi-client
columns, server / PubSub / Room panes, snapshot chrome, command palette, and
the SQL notebook.

- **Client:** `@pkgs/harness-console/client` — Solid UI (`HarnessConsoleApp`,
  `ProductHarnessScreen`, `SqlNotebookPane`)
- **Ports:** `HarnessConsolePorts` — product app + product-harness boot are
  injected by `@apps/harness-ts`; this package never imports apps/libs/test.
