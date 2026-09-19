# Overnight decisions — chess puzzle Phase 1 MVP

Every assumption taken while implementing the Phase 1 `P0` items of
[`chess-puzzle-mvp.md`](chess-puzzle-mvp.md) without asking. Each entry says what
the spec/goal left open, the reading taken, and why. Progress lives in
[`chess-puzzle-mvp-progress.md`](chess-puzzle-mvp-progress.md).

## Process

- **D1 — `typecheck` task name.** The goal's gate is
  `turbo run typecheck lint test`, but this repo's type-check task is `tc`
  (`tsc --noEmit -p ./tsconfig.tc.json` in every package) and Turbo refused the
  command (`Could not find task typecheck in project`). Added a `typecheck`
  task to `turbo.json` that only `dependsOn: ["tc"]` — no package scripts were
  renamed, so `bun check` and CI keep working unchanged.
- **D2 — Doc names vs. the naming check.** `bun run lint:naming` wants
  `SCREAMING_SNAKE_CASE.md` docs, but the goal names
  `docs/chess-puzzle-mvp-progress.md` / `docs/overnight-decisions.md` /
  `docs/overnight-remaining.md` (and the spec already lives at
  `docs/chess-puzzle-mvp.md`). Kept the mandated paths and listed them as exact
  exemptions in `libs/tools/naming/naming-rules.ts`.
- **D3 — Stale install is not a code failure.** The first baseline gate failed
  only on `@pkgs/solid-context#test` (`preload not found`) because the worktree's
  `node_modules` predated a dependency added on `main`; `bun install` fixed it.

## Slice 1 — rules core (§1)

- **D4 — Adopt chess.js behind one kernel.** §1 allows "adopt a proven library —
  chess.js"; the repo already depended on it in five places with three copies
  of the UCI helpers. New package `@pkgs/chess-rules` (the spec's `chess-core`
  kernel; `pkgs/` because it is product-agnostic) owns FEN parse/serialize with
  per-field errors, strict UCI parse/format, castling-input normalization,
  promotion rules, SAN↔UCI and perft. `@pkgs/chess-board-core/uci` and the
  `libs/chess` FSM helpers now delegate to it; the third copy
  (`chess-puzzle-play-chess-utils.ts`) was deleted. Board-interaction code that
  holds live `Chess` instances (`game.ts`, `probe.ts`, the puzzle router)
  keeps them — replacing chess.js as the board's position type is not a §1 P0
  item — but every UCI application goes through the kernel's `playUci`.
- **D5 — Perft depths.** chess.js is too slow for the "usual" depths in a unit
  suite. Chosen: startpos d4 (197 281), Kiwipete d3 (97 862), position 3 d4
  (43 238), positions 4–6 d3; each depth below the max is asserted too. ~15 s
  unloaded; per-test timeout 120 s because the machine is shared.
- **D6 — Strict UCI.** `parseUci` rejects anything that is not
  `[a-h][1-8][a-h][1-8][qrbn]?` (and from = to). The old board helper silently
  dropped a bad 5th char (`e2e4x` → `e2e4`); the one existing assertion of that
  (`pkgs/chess-board-core/tests/game.test.ts`) now expects `null`. A promotion
  suffix on a non-promoting move is rejected (chess.js would ignore it).
- **D7 — Promotion is never guessed.** A pawn reaching the last rank without a
  suffix is illegal in the kernel (§3 "never auto-queen silently").
- **D8 — DST form for a pure kernel.** §1 has no clock, network or storage, so
  its deterministic-simulation scenario is a seeded fast-check random legal walk
  (seed 20260919) asserting FEN round-trip, SAN↔UCI round-trip,
  perft(1) = move count and "mover never left in check" at every ply. The §34
  chess-logic rows are about solving, so they are covered by slice 4's product
  sims.
- **D9 — Hot path.** `playUci` tries `chess.move` first and only builds the
  castling alias on failure; building the verbose legal-move list per move made
  the spectator sims time out.
- **D10 — Tailwind compile test timeout.** `@pkgs/tailwind`'s theme test
  compiles CSS by scanning the whole repo: ~3 s alone, but it exceeded bun's
  5 s default whenever the turbo gate ran it in parallel with other suites.
  Gave that one test an explicit 30 s timeout; the test itself is unchanged.
