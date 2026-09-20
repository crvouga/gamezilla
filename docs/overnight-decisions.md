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

- **D11 — Gate concurrency on a saturated machine.** The shared machine ran at
  load average ~170 on 12 cores (other workspaces' bundlers), which made
  default-5 s-timeout suites in untouched packages (`@pkgs/ui` codemod PBTs,
  `@pkgs/sql-client-contract` fast-check time budget) fail at random. The gate
  is the goal's exact command plus `--concurrency=2` / `--output-logs`, which
  change scheduling and logging only, never what runs; Turbo's cache means a
  rerun re-executes only tasks that have not yet passed.

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

## Slice 2 — permissions

- **D12 — Extend, don't fork.** The generic mechanics (fact predicates,
  `resolveSubject`, quotas with windows/boundaries, params, restrictions,
  `Decision` with reason/remaining/resetsAt/unlockRef/policyVersion, policy
  versions + `policyAt`, treatments) went into `@pkgs/permissions` with their
  own tests (`pkgs/permissions/tests/decision.test.ts`,
  `quota-window.test.ts`); `@libs/permissions` builds the app policy on them.
  The pre-existing `can` / `checkLimit` / caps API is unchanged (spaces uses
  it).
- **D13 — Permissive baseline, one existing limit.** The shipped policy
  (`version 2026-09-19.1`) has a `baseline` role (`when: always`) granting
  every catalogued Phase-1 grant and unlimited practice. Because quotas merge
  to the maximum, `puzzle.rated.solve` cannot sit on the baseline (an
  unlimited baseline would erase the anonymous cap), so it lives on the
  fact-matched roles: anonymous 20/day (the pre-existing product config),
  accounts unlimited. The "every action is defined under the baseline"
  property test therefore asserts on the resolved subject for every fact
  fixture (`libs/permissions/tests/catalog-resolution.test.ts`), and on the
  bare baseline for every action except `puzzle.rated.solve`.
- **D14 — Roles are data; code picks none.** Roles carry `when` predicates
  (AND across keys, any-of within a key, missing fact = `null`); the plan
  roles use exclusive predicates (`auth` × `membership`) so the paid role can
  keep lacking `billing:subscribe`. `@libs/permissions` only turns raw inputs
  into `Facts` (`auth: anonymous|verified`, `membership: active|none`, grace
  logic moved from `resolvePlanRole` into `resolveAccessFacts`).
  `usePlanRole` / `resolvePlanRole` stay (billing's own screen imports
  `usePlanRole`) but now read the role the policy assigned; feature code uses
  only `usePermissions` / `useCan`. The settings screen's plan label moved
  into the policy package (`useAccessLabel`, same strings).
- **D15 — Snapshot = existing synced rows.** No new endpoint or cache: the
  policy is the synced `client_config.permission_policy` row (now carrying
  `version`, `activeFromMs` and retained `history`), facts come from synced
  rows, and the new synced `permissions_quota_ledger` table (owner-scoped
  `permissionQuotaLedger` query, `user:<actor>` topic) holds consumption.
  The table is named `permissions_quota_ledger` because `defineTable` requires
  the domain prefix.
- **D16 — Consume semantics.** One function (`applyConsume`) is the
  consume: idempotent on (owner, idempotency key) — an existing key is a
  no-op — with a unique index as backstop; it evaluates under the synced
  policy + facts and appends a ledger row. The client runs it optimistically
  inside `consumeQuota` (device clock, a hint); on server replay the host's
  authorize hook runs it first with the host clock (window + `consumed_at`
  from server time, so a device clock set forward or backward cannot mint
  quota), and the body then finds the key consumed and no-ops. The policy
  version is the one active at the client timestamp clamped to server time
  (offline replay under the version of the moment). Consequence (P0
  reading): an offline attempt is charged to the window it replays in;
  overdraft tolerance is §22.4 P1. Denials are permanent `MutationError`s
  whose code is the reason and whose meta carries the decision, so the server
  records a write rejection and the optimistic row rolls back through the
  existing rebase. Count-then-insert relies on one owner's replays being
  serialized (as the sim and the Worker process a batch in one transaction);
  a per-owner advisory lock is left for when concurrent replays of one owner
  become possible.
- **D17 — No stored timezone.** Nothing in the app stores a user timezone,
  so the anonymous quota uses `utcMidnight`. `userLocalMidnight` is fully
  implemented and DST-tested in the kernel (America/New_York 2026-03-08 /
  2026-11-01) and takes a zone once one is stored.
- **D18 — Server enforcement hook.** `@pkgs/sync-engine` had no server-side
  mutation guard, so `createSyncApp` gained `authorizeMutation` (runs in the
  replay transaction before the body with `{ name, args, tx, env,
  serverNow }`; `MutationError` rejects; framework bookkeeping mutations skip
  it) with tests (`pkgs/sync-engine/tests/server-authorize-mutation.test.ts`).
  `serverNow` is on the hook context rather than `env`: setting
  `env.serverNow` on the HTTP route (the sim harness already does) switches
  `ensureProfile` into an untested replay branch that renames users, so the
  route's `env` is unchanged. `MUTATION_ACTIONS` (in `@libs/permissions`)
  declares every product mutation: puzzle writes → `puzzles:play`,
  `createSpace` / `joinSpace` → their space permissions, `consumeQuota` →
  `quota` (the hook performs the server-clock consume), everything else
  `public` (their bodies already check identity or per-space roles;
  declaring stricter grants would change existing behavior). An undeclared
  mutation is rejected at replay, and
  `apps/server/tests/mutation-actions-contract.test.ts` fails CI when a
  registered mutation lacks a declaration. There are no billing mutations
  (billing is REST), so the map has no billing entries.
- **D19 — Action ids.** `ACTION` (`domain.verb`) is a TS catalog so typos fail
  type-checking; the pre-existing colon-form `PERMISSION` ids stay (billing
  and spaces use them) — both are just policy keys. Catalogued: the §22.7 P0
  actions plus `coach.enabled`, `coach.explanations.view`,
  `coach.refutation.view`, `stats.overview.view` for later Phase-1 slices.
  Context (`ctx`) and scopes are P1 and not modelled yet.
- **D20 — Client API and denial surface.** `usePermissions()` exposes
  `can` / `remaining` / `consume` / `gate` / `treatment` / `unlock`, all from
  local synced state through the same `evaluateQuota` the mutation runs.
  `<Gated>` applies the config treatment (default `lock` for grants, `soft`
  for quotas). `DenialSurface` is the only renderer of unlock copy; copy keys
  map to Lingui messages in `libs/permissions/src/public/unlock-copy.ts` and
  CTA targets to routes there. The chess limit screen renders it with the
  existing `chess-puzzle-limit` handle and identical strings. The chess coach
  line for the limited state no longer mentions upgrading (neutral copy), so
  no upsell text is authored outside the registry.
- **D21 — Chess charge point.** A rated puzzle is charged when the driver
  places a new puzzle (`armStart`), never on rejoin / spectate / reload of a
  room puzzle. Key = `puzzle.rated.solve:<puzzleId>:<client UTC day>`: a
  reload or replay that re-places the same puzzle that day is a no-op. On
  denial the finished puzzle is cleared and the denial surface shows; a timer
  on `resetsAtMs` (injected `Timers`) and any policy / fact change that makes
  `can` allow again retry automatically. `resolvePuzzlePickState` now ranks
  `limited` above a pending next pick (a denied pick is not "loading").
  `usePuzzlesPlayedToday` / `usePermissionLimit` / `LIMIT.puzzlesPerDay` and
  the hard-coded upsell copy were deleted.
- **D22 — §22.11 lint scope.** Three Grit plugins: repo-wide tier identifiers
  (`no-tier-vocabulary.grit`), `plan:` literals
  (`no-tier-vocabulary-string.grit`), and bare tier words as identifiers in
  `libs/chess` (`no-tier-words-puzzle.grit`, test files excluded — there
  "guest" is the space-presence role). Allowlist: `libs/permissions`,
  `pkgs/permissions` (the generic resolver's own tests use plan-shaped
  fixture names), `libs/billing`, `pkgs/billing*`, and apps/product billing
  sim/test files (apps/server has no billing route files). One feature hit was
  renamed (`plan` → `stage` in `opponent-stager.ts`). The grep test is
  `libs/tools/scripts/tier-vocabulary.test.ts`. The spec's generic words
  (`plan`, `tier`, `free`, …) are not banned repo-wide (query plans, rename
  plans, UI tiers).
- **D23 — Where each §34 quota row is proven.** The product sim
  (`apps/product/tests/chess-puzzle-quota.test.tsx`) drives the real UI for:
  one unit charged per start, the limit reached mid-puzzle with the board
  completing, the next start denied (denial surface shown, never charged on
  the server), and sign-in lifting the limit. Advancing ~24 h of virtual time
  through the full UI sim exceeds the 90 s per-test budget (every UI
  interval fires), so window rollover, device clock skew, two-device racing
  and offline replay under an older policy version are proven one level down
  against the real mutation + real SQL (`libs/permissions/tests/
  consume-quota.test.ts`, seeded) and the window math by the seeded kernel
  property test. The ledger-row invariant (rows = distinct keys, ≤ limit per
  day) is asserted after every product step.
- **D24 — Lingui macros only in `.tsx`.** The bun test preload compiles
  Lingui macros for `.tsx` files only; a `.ts` module importing
  `@lingui/core/macro` crashed the app shell in the product sim. The two copy
  modules in `@libs/permissions` are `.tsx` for that reason.
- **D25 — Synced timestamp formats.** Ledger rows synced from Postgres arrive
  as Postgres text (`2024-06-01 00:00:01.2+00`), which neither sorts against
  ISO strings nor `Date.parse`s. Window counting therefore reads the owner's
  rows and filters with one parser (`ledgerTimeMs`) instead of comparing
  timestamps in SQL; covered by a regression test.

- **D26 — Sign-in fact from the session identity.** The `auth` fact is
  "not anonymous and bound to an account", read from the mutation / request
  identity (`isAnon`, `accountId`) — the rule the server already used — not
  from a synced `auth_users` row, which lags right after sign-in and made the
  local hint and the local consume disagree. Membership still comes from the
  synced `billing_subscriptions` row. The chess gate's automatic retry is
  edge-triggered (only when the local answer flips from denied to allowed),
  so a hint/consume disagreement can never spin.

## Slice 3 — puzzle data + Lichess ingest (§4, §23, §35)

- **D27 — `moves[]` stays a text column.** §38 is logical (§0.0): the §4
  `moves[]` is the existing space-separated `chess_puzzles.moves` text column.
  The pure model (`Puzzle` in `@libs/chess/public/puzzle-data`) exposes
  `moves` as an array plus the derived `solverColor` (inverse of the FEN side
  to move) and `positionKey`; ingest stores the canonical UCI line (castling
  written king-onto-rook is normalized to king-two-squares). No other column
  was renamed (`nb_plays` = `plays`, `game_url` = `sourceGameUrl`).
- **D28 — Indexes are declared, not derived.** `defineTable` supports
  `indexes` / `uniqueIndexes` (auth, billing, matchmaking use them), so
  `chess_puzzles` now declares `ix` on `rating` and `popularity` (the pool /
  band queries filter on rating and order by popularity) and `ux` on
  `position_key`. Themes and opening tags are JSON arrays filtered only on
  the client (`json_each` over the synced band) and no server query reads
  them in Phase 1, so they get no index; an index for them belongs with
  §10.3 / §10.4 (P1) when a server query filters on them. The seed's
  `--defer-indexes` still drops non-unique indexes during a bulk load; the
  declared ones come back on the next `db:migrate` reconcile. Proven on real
  SQL by `libs/chess/tests/puzzle-data/puzzle-ingest-sql.test.ts`
  (`pragma_index_list`).
- **D29 — Dedupe key.** `position_key` = FNV-1a 64 (`fnv1a64Hex`, the
  existing deterministic hash in `@pkgs/room`) of FEN fields 1–4 + `|` + the
  canonical line. Clocks are excluded (they do not change the puzzle).
  Nullable: rows seeded before this slice keep `NULL` (unique indexes allow
  many NULLs, so the schema-evolution `unique-index-added` warning printed by
  `schema:snapshot` cannot turn into a failed `CREATE UNIQUE INDEX`); they are not backfilled, because rewriting ~4M rows is the WAL surge
  the fast path exists to avoid — a fresh seed or a re-seed of the table
  fills them. Each batch first reads the stored ids / keys it collides with
  and splits the batch (`partitionPuzzleBatch`): an id match counts as
  `duplicateId` (a resumed / repeated run, not bad content) before a
  position match (`duplicatePosition`); `ON CONFLICT DO NOTHING` (no target,
  both unique keys) stays as the backstop.
- **D30 — Validation reasons.** `missingField`, `invalidFen`,
  `malformedMove`, `tooShort` (< 2 plies), `illegalMove`, `oddLength` (ends on
  the opponent's move), `invalidNumber` (rating / RD / plays must be integers
  ≥ 0; popularity may be negative — Lichess's vote ratio is −100…100).
  "FEN valid" includes cross-field consistency chess.js does not check: each
  castling right needs its king and rook on their home squares, and an
  en-passant square needs the double-pushed pawn in front of it and empty
  squares behind. That check was added to the kernel as
  `fenConsistencyError` (`@pkgs/chess-rules/fen`, own tests) rather than
  tightening `parseFen`, so board code that parses hand-written FENs is
  unaffected. A castling move whose right is missing from the FEN is
  `illegalMove`.
- **D31 — One ingest path.** Every writer goes through `PuzzleIngestTally`
  (validate + per-reason counts) and `PuzzleSeedFastPath.insertPuzzleTableRows`
  (dedupe): the streaming Lichess seed (counts in the batch / done /
  dry-run reporter lines), the committed load-file seeder (now accepts the
  raw Lichess header too, and gained `ingest()` returning the summary), the
  web sim seed, and the load-file export (only validated rows are written).
  The seeder's DATABASE_URL policy block moved to `resolveToolingDatabaseUrl`
  so the new validation job shares it.
- **D32 — §35 job.** `bun run --filter @libs/chess validate:puzzles`
  streams the live table (keyset pages of 5000 by id, default) and/or any
  `--source` CSV / `.csv.zst` / URL through the same validator, reports
  per-reason counts + the first 20 failures, and exits 1 on any invalid row.
  Duplicate positions are tracked per source (one file or the table), since
  separate fixture files legitimately share rows. Cost: ~0.6 ms per puzzle on
  the loaded dev machine (chess.js `move` dominates), i.e. roughly 40 min for
  the full ~4M-row database — acceptable for an offline job; the canonical
  form is computed from the SAN instead of chess.js verbose history, which
  was 40 % of the cost.
- **D33 — Fixture fix.** `libs/chess/scripts/fixtures/lichess-puzzles-sample.csv`
  (referenced nowhere) held two one-move lines from the start position — both
  invalid (`tooShort`). Its rows were replaced with two real Lichess puzzles
  (one White-to-solve, one Black-to-solve) under the same ids. The 2000-row
  load file, the Node sim CSV and the 50-row web fixture were all valid and
  are unchanged.
- **D34 — Ingest scenario shape.** The product sim
  (`apps/product/tests/chess-puzzle-ingest.test.tsx`) ingests through the
  real load-file seeder against the sim's server database (the streaming
  seed needs a Postgres TCP session and secrets, which the sim does not
  have; both share the validator and deduping insert — D31). The orientation
  probe (`Handles.chessPuzzleBoardOrientation`) reads the same accessor the
  board renders with. The Node sim fixture only has Black-to-solve puzzles and
  other chess scenarios exhaust exactly those three, so the White-to-solve
  puzzle comes from the scenario's own ingest rather than a fixture change.
- **D35 — Load flake in the gate, not a code failure.** The first two gate
  runs failed only on `@libs/tools#test` "classifier is fast (10k paths)"
  (a 50 ms wall-clock budget; measured 80–540 ms at load average ~110). It is
  in the affected set only because `bun.lock` changed, this slice touches no
  `libs/tools` file, and it passed on retry when the load dipped; the test was
  left unchanged. Final gate: 392/392 tasks, exit 0.

## Slice 4 — Solve flow (§5, §6, §3)

- **D36 — A wrong move is never applied.** §5 allows "piece returns (or
  stays briefly then reverts)". The room now rejects the ply without
  changing `displayFen`: the board bumps `layoutKey`, so the dragged piece
  snaps back to where it started and the from/to squares flash red. The
  `previousDisplayFen` attr existed only to undo the applied wrong move and
  was deleted (Retry keeps `displayFen` / `solveIdx`).
- **D37 — The rated outcome is one interaction row, written once.** New
  interaction kind `failed` joins `solved` / `abandoned` as an *outcome*
  row; a play has at most one, and it is the first one (§5 "rating is
  affected only by the first outcome"). First wrong move → `failed`
  immediately (rating updates at once through the existing projection);
  "Show solution" before resolution → `failed`; a clean or hinted solve →
  `solved`; Skip → `abandoned`. A solve after a fail writes no row at all,
  so the game log / result panel keep showing the loss. Guards: an in-memory
  latch keyed by the room attempt (`puzzleId|startedAtMs`), the synced log
  (`hasPlayOutcome`), and `projectPuzzleEloFromInteractions`, which folds
  only the first outcome of each play even if history ever holds two.
- **D38 — Acceptance beyond the stored move.** `judgePuzzleMove`
  (`@libs/chess/public/chess-puzzle-move-judge`, pure, kernel-backed)
  accepts: the expected move in canonical UCI (castling entered as
  king-onto-rook and the promotion piece both normalize through
  `@pkgs/chess-rules`), **any checkmating move** on any ply (§34: an
  alternative or faster mate ends the puzzle as solved — the room's line is
  rewritten to what was played), and a **transposition**, read as the
  solver's next line move played one turn early when the opponent's reply
  stays legal and the pair reaches the same position (FEN fields 1–4, new
  kernel helper `isSamePosition`). A single ply can never reach the expected
  move's position by another route, so the one-ply reading of §34 is the
  order swap. Everything else legal is `wrong`; anything illegal is no move
  at all (snap back, no penalty).
- **D39 — Timings.** Opening pause 500 ms (§5: 400–600), opponent reply
  400 ms (§5: 300–500), shown solution 600 ms per ply, all on the injected
  `Timers` in the opponent stager. Input stays locked for the hold plus the
  piece slide.
- **D40 — "Show solution" is a room transition, not the hint arrow.** New
  command `ShowChessPuzzleSolution` → event `ChessPuzzleSolutionShown` →
  new terminal status `revealed`: the room jumps to the end of the line, the
  stager plays the remaining plies out, and the attempt is in review
  (scrub back / forward, Next, Retry; the board is not interactive). The
  pre-existing `RevealChessPuzzleSolution` arrow stays the second step of
  the P1 progressive hint, so the hint tests are unchanged.
- **D41 — Leaving keeps the attempt pending (§5).** Back / Next no longer
  abandon; `appendAbandoned` and the abandon-on-leave path were deleted.
  Leaving keeps the room's puzzle (it is only cleared when the attempt is
  finished), and the play screen re-places the room's puzzle on return
  without arming a new start (no second quota consume, no second `started`
  row — `hasPendingPlay` also suppresses the restored attempt's `started`).
  Skip stays the one explicit forfeit. Consequence: the stats scenario that
  read "Abandoned" after a wrong move + leave now reads "Failed" (the wrong
  move is the loss), and the controls scenario "wrong → Retry → solve" logs
  Failed, not Solved.
- **D42 — Auto-advance lives in the feed prefs for now.** Slice 11 owns the
  settings screen, so `off / after 1 s / immediately` is a field on the
  device-local puzzle-feed config with a segment in the feed settings modal.
  It is deliberately left out of `chessPuzzleFeedConfigFingerprint`, so
  changing it does not re-pick the puzzle on the board. It fires only on a
  live solve (`solving → solved`) through the injected `Timers`.
- **D43 — Haptics became an injected port.** §5 asks for a haptic on the
  success state. `HapticsPort` already existed in `@pkgs/device` but was
  wired nowhere; it is now on `ClientEnv` exactly like the clipboard
  (`wallWebHaptics` in the browser root, `createRecordingHaptics` in every
  sim env) with a `HapticsProvider` / `useHaptics` Solid binding. The puzzle
  feedback hook fires `success` on a solve and `error` on a wrong move, and
  scenarios read the recorded calls.
- **D44 — Board input primitives.** `@pkgs/chess-rules/moves` gained
  `castlingFromRookInput` / `castlingRookTargets`; `@pkgs/chess-board-core`
  uses them so a king dropped (or tapped) onto its own rook castles and the
  rook square is listed as a legal target. The puzzle board passes
  `autoPromoteQueen={false}` explicitly — §3 forbids silent auto-queening in
  puzzles whatever a future setting says.
- **D45 — Theme filter SQL.** The feed's theme filter had never been
  exercised: SQLite does not resolve an outer column inside a subquery's
  table-valued function, so `EXISTS (SELECT 1 FROM json_each(themes) …)`
  failed with "no such column: themes" on every client read. The local
  condition is now `instr(themes, '"<theme>"') > 0` per selected theme,
  which is exact because the ids are quoted in the synced JSON array.
- **D46 — Motif fixtures are their own file.** The three-puzzle Node sim
  fixture is exhausted exactly by other scenarios (D34), so the nine
  hand-built motif puzzles (underpromotion, capture-promotion mate, en
  passant, castling, two mates on the last ply, a faster mate mid-line,
  transposition, a Black-solver promotion and a check at the start) live in
  `apps/product/fixtures/chess-puzzles-motifs.sim.csv`, are ingested by the
  scenario through the real load-file seeder, and are validated by the §35
  job test. Each row carries one otherwise-unused Lichess theme, so the
  feed's theme filter serves exactly the puzzle a scenario is about — a real
  user path, not a test-only selector.
- **D47 — Where the millisecond assertions live.** The sim's UI wait pump
  fast-forwards virtual time to the next due timer, so a product-level
  assertion "the board is still locked 200 ms in" races the pump. The exact
  frames and lock windows are asserted in the stager's seeded unit test
  (manual timers), and the product scenarios assert what cannot race: the
  setup move has played before the solver may move, the reply plays by
  itself, and the board is locked in `wrong` and after the attempt ends.
- **D48 — Combobox `doneDataSet` / theme search.** Selecting a feed theme
  from a scenario needs the virtualized combobox to render the row, so
  `selectFeedTheme` searches by label first and then closes the picker
  through the multi-select footer, which now takes a `doneDataSet`
  identifier like every other addressable control.
- **D49 — One escalating hint button (design feedback).** The solving action
  bar offered both an escalated "Hint → Solution" button and a separate
  "Solution" action, which read as the same thing twice. The separate slot is
  gone; the single button now steps Hint (highlight) → Solution (full arrow) →
  Solution (§6: plays the rest of the line out, then review), so §6 keeps an
  entry point while solving. The `wrong` state keeps its own Solution action —
  there is no hint button there, so nothing is duplicated.
- **D50 — Glicko-2 is its own package.** §8 asks for Glicko-2 for the player
  and the puzzle side of the pairing. The math is product-agnostic, so it
  lives in `@pkgs/glicko2` (`glicko2Update` / `glicko2Decay` /
  `glicko2ExpectedScore`), mirroring `@pkgs/chess-rules`' layout, with the
  published worked example from Glickman's paper as a test vector plus seeded
  fast-check properties. `@libs/chess` wraps it in
  `shared/chess/chess-puzzle-rating.ts`, which owns the puzzle-specific
  constants and the rounding.
- **D51 — Rating state is integral on the wire.** [`DETERMINISM.md`](DETERMINISM.md)
  already prescribed "float then `Math.round` for persisted ratings".
  `chess_puzzle_profiles` therefore stores `rating` and `rating_deviation` as
  rounded integers and volatility as `volatility_micros` (σ × 1e6). Rounding
  once per attempt absorbs any last-bit difference between the client's and
  the server's `Math.exp`, so the optimistic value and the replayed one agree
  exactly.
- **D52 — One mechanism for "this puzzle already moved your rating".** The new
  `chess_puzzle_rating_events` table holds at most one row per (owner,
  puzzle), keyed by the deterministic id `<ownerId>|<puzzleId>`. That single
  primary key is what enforces §8 "repeat attempts never affect rating", what
  makes an offline attempt replayed twice (or out of order) idempotent, and
  what makes a §9 exhausted-pool re-serve unrated — no separate `rated` flag
  on the wire, no UI-side rule. It doubles as the §8 `P1` rating history the
  stats graph and game log read.
- **D53 — The client sends the attempt, not a rating.** `upsertPuzzleProfile`
  (which stored whatever the client computed) is gone, replaced by
  `ratePuzzleAttempt`, which derives the new profile inside the mutation
  transaction from the stored profile plus the puzzle's rating/deviation. The
  same definition produces the optimistic local row and the authoritative one
  on replay, and the engine rebases the client onto the server's. The
  Elo-only helpers (`updatePuzzleRating`, `projectPuzzleEloFromInteractions`,
  `puzzleEloK`, `PUZZLE_PROFILE_RD_STUB`, `PUZZLE_ELO_*`) are deleted; stats,
  the sparkline, the game log and the result panel read the ledger instead of
  re-folding history. `ChessPuzzleEloChip` / `ChessPuzzleEloDelta` are renamed
  to `ChessPuzzleRatingChip` / `ChessPuzzleRatingDelta` and carry the
  provisional marker and the "Unrated · already played" face.
- **D54 — The seed rating moves 1200 → 1500.** §8 states new users start at
  1500, so `PUZZLE_RATING_DEFAULT` is the Glicko-2 default and the feed's
  `PUZZLE_FEED_RATING_DEFAULT` / `resolveProfilePuzzleRating` follow it. The
  node sim fixture sits at ~1200, i.e. below the window — which is exactly the
  §34 "rating at extremes where few puzzles exist" case, handled by the
  widening step of §9 rather than by re-rating the fixture. Existing
  expectations that hard-coded 1200 (`chess-puzzle-stats`,
  `chess-puzzle-spectator`, `chess-puzzle-feed`) were updated.
- **D55 — Provisional until RD < 110.** §8 leaves the threshold open ("until
  RD drops below a threshold"). 110 is the conventional Glicko "established"
  bar and is reached in roughly a dozen attempts against comparably rated
  puzzles. The marker is a `?` suffix on the rating chip and the result
  panel's headline.
- **D56 — The puzzle side of the pairing does not move yet.** §8 `P0` pairs
  the player against the puzzle; updating *puzzle* ratings is the `P1` row, so
  the puzzle's stored `rating` / `rating_deviation` are read-only opponents.
  A puzzle row with no deviation is treated as RD 80.
- **D57 — Selection window formula.** §9 asks for "±100–200, widening with
  RD". Implemented as
  `half = 100 + 100 × clamp((RD − 30) / (350 − 30), 0, 1)` rounded — ±200 for
  a brand-new player, ±100 once the rating is settled. The half-window is
  published on the pick-status probe (`window=`) so scenarios can assert it.
- **D58 — Quality bars are popularity and play count.** §9 asks for a
  "popularity / play-count / report threshold". The Lichess corpus this app
  ingests has **no report-count column**, so the filter is
  `popularity >= 50 AND nb_plays >= 5`, applied to every candidate read
  including the exhausted-pool fallback. If a report count is ever ingested it
  becomes a third condition in the same place.
- **D59 — Pick order, and why widening waits for the pool.** Selection tries
  (1) unseen inside the ±window, (2) unseen anywhere (rating at an extreme),
  (3) the oldest-attempted puzzle. Step 2 is gated on the pool subscription
  being ready: bands hydrate one response at a time, so an empty window before
  the first hydrate means "not downloaded yet", not "nothing at your level" —
  without the gate the first puzzle of a session came from whichever band
  happened to land first. Step 3 only applies to the default "hide played
  puzzles" feed; every other history filter already serves attempted puzzles
  on its own terms.
- **D60 — The exhausted feed is no longer a dead end.** §9 says the pool
  falls back to oldest-first instead of stopping, so
  `chess-puzzle-exhaust.test.tsx` no longer expects the empty-pool block after
  the last unseen puzzle: it expects the oldest attempt to come round again,
  unrated. The empty-pool block and its "include played puzzles" recovery are
  still covered by the same file, through a theme filter that matches nothing
  (and by the offline scenario).
- **D61 — One account, two devices.** §34 needs the same account signed in on
  two devices. The sim's Google address is derived from the actor id, so a new
  `signInWithGoogleAsAccount(actorId, accountActorId)` action signs one actor
  in with another's address — the real second-device path, no test-only hook.
- **D62 — Rating / selection fixtures are re-rated real puzzles.**
  `apps/product/fixtures/chess-puzzles-rating.sim.csv` (14 rows clustered on
  1500, so RD converges at a realistic rate) and
  `chess-puzzles-selection.sim.csv` (4 in-window, 5 below the quality bars, 3
  outside the window) are rows from the checked-in Lichess web fixture with
  the rating / popularity / play-count columns rewritten. The positions and
  solutions are untouched, both files pass `validate:puzzles`, and both are
  listed in the §35 validation-job test.
- **D63 — The one deleted test file.** `libs/chess/src/shared/chess/chess-puzzle-rating.test.ts`
  tested the Elo helpers, which §8 replaces with Glicko-2, so the functions it
  called no longer exist. Its coverage was rewritten, not dropped:
  `libs/chess/tests/puzzle-session/rating.test.ts` (11 tests, in the location
  AGENTS.md prescribes) plus `@pkgs/glicko2`'s reference-vector and property
  tests. No other existing test was deleted or skipped anywhere in this work.
