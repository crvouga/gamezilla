# Full local verification

Candidate `8a3538fca4c9d23ff931be3dfa85b1080ebc0041`. `NODE_OPTIONS=--max-old-space-size=8192 TURBO_CONCURRENCY=1 bun verify` exited 1. Setup: 13 successful / 13 total. Catalog: 16 successful / 19 reported when stopped, not a complete execution of the catalog.

The failing gate is `@libs/tools-harness-ts#ci:statecharts`: `/more/troubleshooting: no chart state owns the public route from libs/app-root-client-ts/src/route-table.ts`. This task explicitly leaves that ownership/spec gap outside the board work. No spec was invented, changed or skipped. Exact log: verify.log; diagnostics: verify-final-diagnostics.tar.gz; command binding: command-outcomes.json.

The final eight-package lint/typecheck/test aggregate passed 24/24 (24 cache hits), including the real-board Hill party consumer. Focused board geometry passed 101 native cases before the visible-label-only correction; the exact-head full matrix is recorded separately. No whole-release success is claimed.

The earlier hosted Numberlink diagnosis belongs to `../../hosted-numberlink-repair/DIAGNOSIS.md` at the overhaul root. It establishes an 8-second SQLite connect deadline followed by empty-memory fallback before the board, not the root cause of the worker stall. Do not attribute new hosted results to that cause without their logs.
