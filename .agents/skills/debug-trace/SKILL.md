---
name: debug-trace
description: Debug runtime, sync, request, database, production, or spec failures from observability traces before adding logs or rerunning.
---

# Debug trace

Use the repository `obs` CLI before adding logging or rerunning a failure.

1. Select the narrowest entry command:
   - A name, a place, or a clock time ("Chris Vouga", "Gilbert, Arizona", "6:33pm MST", or a connection that appeared somewhere else than the clock): `bun obs person --name "<name>" --at "<time and zone>" --place "<place>" --source prod`. Do not look up a user id, convert the zone, or open Grafana. The command loads the production read credentials itself.
   - Just happened, no identifier: `bun obs last`.
   - Any supplied identifier: `bun obs find <identifier>`.
   - Failing spec: `bun obs test '<test name>' --source <artifact-dir>`.
   - Unexplained write: `bun obs mutation <mutation-id>`.
   - Slow behavior: `bun obs slow`.
   - Production alert: run the exact command carried by the alert.
2. State the resolved source and UTC time range from the output.
3. Follow the CLI's suggested `obs trace` or `obs span` drill-down command.
4. Form a root-cause hypothesis from the narrated sequence, error status, events,
   and correlation identifiers. Use `--json` only when a program needs structured
   data.
5. If nothing matches, follow the widened-window breadcrumb printed by the CLI.

Use the right complementary tool. For visual/CSS/layout failures inspect the browser
and screenshots, using `obs last` only for the events behind the render. Read code for
Solid reactivity-graph internals. Use compiler output for build and type failures.

Never add temporary `console.log` calls while a relevant trace or artifact is
available.
