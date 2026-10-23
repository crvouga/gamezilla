# Shared puzzle harness

The executable product contract is [`specs/puzzles/`](../../specs/puzzles/).
This package binds it to one small reference app: its opaque puzzle counts
toward a target, with no grid, endpoints, turns or opponent. Numberlink's
own rules are verified by its separate game harness.

The app uses the production content and attempt mutations, permission
decisions, SQL tables, queries and topic maps. The sync harness supplies real
client engines, server replay and isolated SQLite stores connected by virtual
HTTP and pubsub ports. Reopening preserves the device database; offline
actions control the injected connectivity signal and virtual links.

Scenario steps call exported actions and observations. Model bindings will
use the same surface. The package's technical tests pin adapter and engine
interop regressions found while running the product scenarios.

Run the shared context with `bun run spec --package @libs/game-puzzle-harness-ts`.
Run its code checks with
`bunx turbo run tc lint test --filter=@libs/game-puzzle-harness-ts`.
