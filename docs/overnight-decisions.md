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
