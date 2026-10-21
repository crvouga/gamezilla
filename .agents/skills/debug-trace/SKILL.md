---
name: debug-trace
description: Debug runtime, sync, request, database, production, or spec failures from observability traces before adding logs or rerunning.
---

# Debug trace

Use the repository `obs` CLI before adding logging or rerunning a failure.

1. Select the narrowest entry command:
   - A name, a place, or a clock time ("Chris Vouga", "Gilbert, Arizona", "7pm MST", or a connection that appeared somewhere else than the clock): `bun obs person --name "<name>" --at "<time and zone>" --place "<place>" --source prod`. It reconstructs everything the person did and every failure, not only the first error. Do not look up a user id, convert the zone, or open Grafana. The command loads the production read credentials itself.
   - Just happened, no identifier: `bun obs last`.
   - Any supplied identifier: `bun obs find <identifier>`.
   - Failing spec: `bun obs test '<test name>' --source <artifact-dir>`.
   - Unexplained write: `bun obs mutation <mutation-id>`.
   - Slow behavior: `bun obs slow`.
   - Production alert: run the exact command carried by the alert.
2. State the resolved source and UTC time range from the output.
3. Read the output top to bottom. For `person`: the accounts and why each matched, then PROBLEMS (worst first, each with its `obs trace` / `obs span` command), then the TIMELINE in the person's zone and UTC. "No error was recorded" means the person was active and nothing failed: read the timeline for what they did. "Nothing happened" carries `last seen` / `next seen`; re-run with the printed command, or `--window 2h`. `WARNING truncated` means a search stopped early: narrow `--window` or pass `--all`. Otherwise follow the CLI's suggested `obs trace` or `obs span` drill-down command.
4. Form a root-cause hypothesis from the narrated sequence, error status, events,
   and correlation identifiers. Use `--json` only when a program needs structured
   data.
5. If nothing matches, follow the widened-window breadcrumb printed by the CLI.

Use the right complementary tool. For visual/CSS/layout failures inspect the browser
and screenshots, using `obs last` only for the events behind the render. Read code for
Solid reactivity-graph internals. Use compiler output for build and type failures.

Never add temporary `console.log` calls while a relevant trace or artifact is
available.
