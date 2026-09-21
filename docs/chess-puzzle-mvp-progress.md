# Chess puzzle Phase 1 MVP — progress

Phase 1 `P0` items of [`chess-puzzle-mvp.md`](chess-puzzle-mvp.md), in the order
§37 gives. A box is ticked only when the slice's seeded sim scenarios pass and
`turbo run typecheck lint test --filter=...[origin/main]` exits 0; the commit
hash is the slice commit. Assumptions: [`overnight-decisions.md`](overnight-decisions.md).

| # | Slice | Spec | Status | Commit |
| - | ----- | ---- | ------ | ------ |
| 1 | Rules core + perft | §1 P0, §35 perft/round-trip | done | 4ef94c80b |
| 2 | Permission layer, permissive baseline | §22.1–22.7 P0, §22.11 P0, §35 permission tests | done | 5aed447b3 |
| 3 | Lichess ingest + validation | §4 P0, §23 P0, §35 DB validation | done | 21d7588fc |
| 4 | Solve flow | §5 P0, §6 P0, §3 P0 castling/promotion input rules | done | 2e8938ad7 |
| 5 | Rating mutator (Glicko-2) | §8 P0 | done | 2311c1742 |
| 6 | Selection | §9 P0, §10.1/10.2 P0 | done | 2311c1742 |
| 7 | Review | §7 P0 | done | |
| 8 | Coach v1 | §36 P0 | pending | |
| 9 | Stats | §15 P0 | done | |
| 10 | Anonymous + sign-in | §19 P0 | pending | |
| 11 | Settings basics | §21 (Phase 1 basics), §36.10 P0 | pending | |

## Item checklist

Filled in per slice as it lands.

### Slice 1 — Rules core (§1)

Kernel: `@pkgs/chess-rules` (`fen`, `uci`, `moves`). Tests: `bun run --filter @pkgs/chess-rules test`.

- [x] §1 Full legal move generation — chess.js adopted behind `legalMoves` / `legalMovesOf` (D4); validated by perft + seeded walks (`tests/perft.test.ts`, `tests/properties.test.ts`)
- [x] §1 Castling: both sides, rights, not out of/through/into check, attacked rook OK — `tests/moves.test.ts` "castling"
- [x] §1 En passant: capture square, next move only, horizontal pin — `tests/moves.test.ts` "en passant"
- [x] §1 Promotion to Q/R/B/N incl. capture-promotions — `tests/moves.test.ts` "promotion"
- [x] §1 Check, checkmate, stalemate detection — `positionStatus`, `applyUci` flags; `tests/moves.test.ts`
- [x] §1 Pins and discovered check via legality filter — `tests/moves.test.ts` "pins"
- [x] §1 FEN parse + serialize (6 fields), validation, useful errors — `parseFen` / `serializeFen`; `tests/fen.test.ts`
- [x] §1 UCI parse/serialize — `parseUci` / `formatUci`; `tests/uci.test.ts`
- [x] §1 SAN generate + parse with disambiguation, `+`, `#`, `=Q`, `O-O(-O)` — `sanFromUci` / `uciFromSan`; `tests/moves.test.ts`
- [x] §1 Perft suite on startpos, Kiwipete, positions 3–6 — `tests/perft.test.ts` (depths: D5)
- [x] §35 SAN/FEN round-trip property tests — `tests/properties.test.ts` (seeded)
- [x] §3 Castling accepted via king-two-squares and king-onto-own-rook — `playUci` / `applyUci` normalization

### Slice 2 — Permission layer (§22)

Kernel: `@pkgs/permissions` (extended). Policy: `@libs/permissions`. Tests:
`bun run --filter @pkgs/permissions test`, `bun run --filter @libs/permissions test`,
`bun run --filter @pkgs/sync-engine test` (authorize hook),
`apps/server/tests/mutation-actions-contract.test.ts`,
`libs/tools/scripts/tier-vocabulary.test.ts`, product sims
`libs/chess/tests/e2e/puzzle-quota.test.tsx` (in `@libs/chess` `test:e2e`). Decisions D12–D26.

- [x] §22.1 One entry point — `can`/`decide`, `consume`/`decideQuota` (`@pkgs/permissions`); client `usePermissions()`, server `authorizeAppMutation` + `requirePermission`
- [x] §22.1 No tier coupling — Grit rules + grep test (§22.11 rows below)
- [x] §22.1 Facts in, permissions out — `resolveAccessFacts` / `readAccessFacts` → `resolveSubject` (`libs/permissions/tests/catalog-resolution.test.ts`)
- [x] §22.1 Authoritative via the sync engine — synced ledger + `consumeQuota` mutation; server replay re-evaluates, denial = write rejection + rollback (`consume-quota.test.ts`, `chess-puzzle-quota.test.tsx`)
- [x] §22.1 Config-driven with versioning — `client_config.permission_policy` with `version` / `activeFromMs` / `history` (`decision.test.ts` "policy versions")
- [x] §22.1 Denials carry a reason + unlockRef resolved via config — `decision.test.ts`; `DenialSurface`
- [x] §22.2 Actions (`domain.verb`) — `ACTION` catalog
- [x] §22.2 Quotas (limit/window/resetBoundary) — `QuotaGrant`, `quotaWindowBounds` (`quota-window.test.ts`, DST)
- [x] §22.2 Caps — existing `limits` / `checkLimit` (unchanged)
- [x] §22.2 Parameters — role `params`, `paramsOf` (most permissive)
- [x] §22.2 Context — not modelled beyond `amount` (scopes are P1; D19)
- [x] §22.2 Decision shape — `Decision` (`resetsAtMs` = timestamp)
- [x] §22.3 Resolver inputs (facts) — auth state + membership incl. grace; others enter as new fact keys, no code change
- [x] §22.3 Resolver output + `policyVersion` + `factsHash` — `resolveSubject`, `factsHash`
- [x] §22.3 Merging: boolean union, max quotas/caps, most permissive params, restrictions last — `decision.test.ts` "merge semantics"
- [x] §22.3 Roles are bundles with `when` predicates — `DEFAULT_PERMISSION_POLICY`
- [x] §22.3 Baseline role `when: always` — `ROLE.baseline` (D13)
- [x] §22.4 Idempotent consume — ledger unique (owner, key); seeded property test (`consume-quota.test.ts`), product invariant after every step
- [x] §22.4 Consume at start; board completes — `useRatedStartGate` (D21); `chess-puzzle-quota.test.tsx`
- [x] §22.4 Windows from server time; userLocalMidnight — host clock in the replay guard (`consume-quota.test.ts` skew tests); UTC boundary (no stored timezone, D17)
- [x] §22.4 Remaining + resetsAt on every decision — `decideQuota`; `usePermissions().remaining`
- [x] §22.5 Snapshot delivery via synced rows — policy row, facts rows, ledger (D15)
- [x] §22.5 Single client API + `<Gated>` — `usePermissions`, `Gated`
- [x] §22.5 Three UI treatments from config — `treatmentOf` (`hide`/`lock`/`soft`, defaults lock/soft)
- [x] §22.5 One shared denial surface — `DenialSurface` + `unlock-copy.ts` registry; chess limit renders it
- [x] §22.6 Every mutator declares its action; undeclared fails CI — sync-engine `authorizeMutation` hook (`server-authorize-mutation.test.ts`), `MUTATION_ACTIONS`, contract test
- [ ] §22.6 Run tokens embed the decision — no timed runs exist yet (Rush/Storm are out of this slice); `Decision` carries `policyVersion` for when they land
- [x] §22.6 Batch replay under the policy active at client timestamp — `policyAt(clientAt)` (`consume-quota.test.ts` "offline replay")
- [x] §22.7 P0 actions `puzzle.rated.solve`, `puzzle.practice.solve`, `account.sync.enable`, `account.data.export` (+ coach/stats actions for later slices)
- [x] §22.11 Package boundaries — only `@libs/permissions` reads auth/billing facts; chess imports `@libs/permissions/public/*` only
- [x] §22.11 Lint denylist outside policy/billing — `no-tier-vocabulary*.grit`, `no-tier-words-puzzle.grit` (D22)
- [x] §22.11 Action names are constants — `ACTION` catalog
- [ ] §22.11 Analytics events carry action/decision/reason/policyVersion — the app has no analytics event bus to extend yet; decisions already carry reason + policyVersion
- [x] §35 Permission tests: resolver fixtures, baseline coverage, merge semantics, idempotent consume/replay, window rollover, contract test, grep test — files above
- [x] §34 Two devices consume the last unit — server serializes, one wins (`consume-quota.test.ts`)
- [x] §34 Device clock manipulation — server-time window (`consume-quota.test.ts`)
- [x] §34 Policy version published mid-session / offline replay — (`consume-quota.test.ts`)
- [x] §34 Limit hit while a puzzle is on the board: it completes, the next start is denied and never charged — `chess-puzzle-quota.test.tsx`; window rollover re-allows — `consume-quota.test.ts` + kernel window property test (product-level 24 h advance infeasible, D23)

### Slice 3 — Puzzle data + Lichess ingest (§4, §23)

Kernel extension: `@pkgs/chess-rules/fen` `fenConsistencyError`. Model +
validator: `@libs/chess/public/puzzle-data`. Ingest: `root/server/seed-chess-puzzles/`
(`puzzle-ingest.ts`, `fast-path.ts`). Job: `root/server/validate-chess-puzzles/`,
`bun run --filter @libs/chess validate:puzzles`. Tests:
`bun run --filter @pkgs/chess-rules test`, `bun run --filter @libs/chess test`
(`tests/puzzle-data/*`), product sims `libs/chess/tests/e2e/puzzle-ingest.test.tsx`
+ `chess-puzzle-fixtures.test.ts` (in `@libs/chess` `test:e2e`). Decisions D27–D34.

- [x] §4 Fields id, fen, moves[] (UCI), rating, ratingDeviation, themes[], plays, popularity, sourceGameUrl, openingTags[] — `Puzzle` (`puzzle-validation.ts`); physical form = existing `chess_puzzles` columns + `position_key` (D27)
- [x] §4 Lichess convention (FEN before the setup move; user plays moves[1], [3], …; line ends on a user move) — `validatePuzzleFields` (`oddLength` / `tooShort`); `validate-puzzle.test.ts`, seeded property test `validate-puzzle.property.test.ts`
- [x] §4 Solver colour = inverted FEN side to move — `solverColor`; product sim asserts the served board orientation for a White-to-solve and a Black-to-solve puzzle (`chess-puzzle-ingest.test.tsx`)
- [x] §4 Seeded from the Lichess CC0 DB — existing streaming seed (`seed:puzzles`), now validating + deduping (D31)
- [x] §23 Parse CSV (PuzzleId, FEN, Moves, Rating, RatingDeviation, Popularity, NbPlays, Themes, GameUrl, OpeningTags) — `validateLichessPuzzleRow`; load-file seeder accepts the Lichess header too
- [x] §23 Load to DB — `PuzzleSeedFastPath.insertPuzzleTableRows` (all seed paths); `puzzle-ingest-sql.test.ts`, `chess-puzzle-ingest.test.tsx`
- [x] §23 Indexes on rating, themes, opening, popularity — declared `ix` rating / popularity + `ux` position_key via `defineTable`; themes / opening not indexed (client-only JSON filters in Phase 1, D28); `puzzle-ingest-sql.test.ts`
- [x] §23 Validation: every move legal, line ends on solver move, FEN valid, no duplicates by position hash + solution — `validatePuzzleFields` + `fenConsistencyError` + `partitionPuzzleBatch` (D29, D30); per-reason counts in the seed reporter
- [x] §35 Full-database validation job — `validate:puzzles` (DB or CSV, exit 1 on invalid); run over every checked-in fixture CSV (`validate-chess-puzzles-job.test.ts`, `chess-puzzle-fixtures.test.ts`); one unreferenced fixture fixed (D33)
- [x] §34 Castling rights in FEN wrong/missing — wrong rights → `invalidFen`, castling without the right → `illegalMove` (`validate-puzzle.test.ts`, product ingest sim)
- [x] §34 En passant as the solution; en passant illegal due to a pin — `validate-puzzle.test.ts`
- [x] §34 Promotion / underpromotion / capture-promotion lines — `validate-puzzle.test.ts` (solve-time input is slice 4)
- [x] §34 Puzzle where solver is Black: orientation flipped — `chess-puzzle-ingest.test.tsx`

### Slice 4 — Solve flow (§5, §6, §3)

Room FSM: `libs/chess/src/shared/chess/` (`chess-puzzle-move-judge.ts`,
`-play-router.ts`, `-play-reducer.ts`, `-play-terminal-handlers.ts`,
`-opponent-stage.ts`). Outcome model: `chess-puzzle-derive.ts` /
`-rating.ts` / `-interaction-entities.ts` + `public/chess-puzzle/`
(`use-chess-puzzle-interaction-recorder.ts`,
`chess-puzzle-interaction-status-sync.ts`). Primitives extended:
`@pkgs/chess-rules` (`castlingFromRookInput`, `castlingRookTargets`,
`isSamePosition`), `@pkgs/chess-board-core` (king-onto-rook castling),
`@pkgs/device` + `ClientEnv` (haptics port), `@pkgs/ui` Combobox
(`doneDataSet`), `@apps/product` sim runtime (`restartActor`). Tests:
`bun run --filter @pkgs/chess-rules test`,
`bun run --filter @pkgs/chess-board-core test`,
`bun run --filter @libs/chess test` (`tests/puzzle-session/move-judge.test.ts`,
`outcome.test.ts`, `opponent-stager.test.ts`, `action-bar-plan.test.ts`),
product sims `libs/chess/tests/e2e/puzzle-solve-flow.test.tsx` +
`chess-puzzle-solve-session.test.tsx` (both in `@libs/chess` `test:e2e`). Fixtures:
`apps/product/fixtures/chess-puzzles-motifs.sim.csv` (validated by the §35
job test). Decisions D36–D48.

- [x] §5 Next puzzle already in memory when the previous ends (prefetch) — local-pool pick (`useNextPuzzleId`); the pick-status probe carries the next id before the current resolves, and Next transitions with the network partitioned (`chess-puzzle-solve-session.test.tsx`)
- [x] §5 Pre-setup position, ~500 ms pause, then the opponent's setup move animates with last-move highlight — `PUZZLE_OPENING_PREVIEW_MS` + opponent stager (`opponent-stager.test.ts`); the served board shows the setup move played (`chess-puzzle-solve-flow.test.tsx`)
- [x] §5 Orientation set before first paint (no visible flip) — solver renders nothing until the room holds this puzzle (`use-chess-puzzle-solver.ts`); orientation asserted for a White- and a Black-solver puzzle
- [x] §5 Prompt "Your turn — find the best move for White/Black" — `ChessPuzzleStatusHeader`; asserted for both colours
- [x] §5 Compare the user move after normalizing castling notation and promotion piece — `judgePuzzleMove` (`move-judge.test.ts`); castling entered both ways and an underpromotion vs queen in the sims
- [x] §5 Correct + line continues → opponent reply auto-plays after ~400 ms, input re-enabled — `PUZZLE_REPLY_PREVIEW_MS` (`opponent-stager.test.ts`, product clean-solve scenario)
- [x] §5 Correct final move → success state, sound, haptic, result panel — `usePuzzleStatusFeedback` + `useHaptics` + summary card (haptics asserted in the sim)
- [x] §5 Final-move mate rule: any checkmating move counts — `judgePuzzleMove` `via: 'mate'`; sim plays the other mate
- [x] §5 Wrong move → red feedback, the piece returns, the puzzle is marked failed once, rating updates immediately — D36/D37; `failed` row written on the transition (`chess-puzzle-solve-flow.test.tsx`, `chess-puzzle-stats.test.tsx`)
- [x] §5 Rating is affected only by the first outcome — one outcome row per play + projection guard (`outcome.test.ts`); retry-then-solve keeps the loss (`chess-puzzle-controls.test.tsx`)
- [x] §5 Result panel: solved/failed, animated rating delta, new rating — `ChessPuzzleCelebrationOverlay` (titles per outcome, existing Elo animation)
- [x] §5 Primary CTA "Next puzzle" + auto-advance setting (off / after 1 s / immediately) — summary CTA (`chess-puzzle-summary-next`) and the feed-settings segment (D42); auto-advance scenario in `chess-puzzle-solve-session.test.tsx`
- [x] §5 Leaving mid-puzzle: the puzzle stays pending and is restored (no free skip, no silent fail) — D41; leave/return and app-kill scenarios
- [x] §6 "Show solution" plays the remaining line then enters review; counts as a fail if unresolved — `ShowChessPuzzleSolution` → `revealed` (D40); `chess-puzzle-solve-flow.test.tsx`
- [x] §3 Only the side to move is interactive; input locked during the opponent animation and after the puzzle ends — board `interactive` gate (`opponentAnimating`, D47); opponent-piece drag ignored, locked in `wrong` and after the end
- [x] §3 Promotion picker, never auto-queen in puzzles — `autoPromoteQueen={false}`; picker asserted for a White and a Black solver
- [x] §3 Castling accepted via king-two-squares and king-onto-own-rook — kernel + board input (D44); both entered in the sim
- [x] §3 Drop on an illegal square snaps back: no penalty, no wrong move — router rejects with `invalidCommand`; asserted with the interaction log unchanged
- [x] §34 Underpromotion is the solution (auto-queen ignored) / promotion with capture / promotion mate across piece choice — motif fixtures `solveUP1`, `solveCAP1`
- [x] §34 En passant as the solution — `solveEP1`
- [x] §34 Castling as the solution, entered as king-takes-rook — `solveCAS1`
- [x] §34 Final move has multiple mates; a non-final faster mate ends the puzzle as solved — `solveMM1`, `solveFM1`
- [x] §34 A move that transposes to the stored line is accepted — `solveTR1` (D38)
- [x] §34 Solver is Black: orientation, prompt and promotion picker follow — `solveBP1`
- [x] §34 King in check at puzzle start — `solveCK1`
- [x] §34 Tapping "Next" twice quickly advances exactly one puzzle — one-advance latch (`use-puzzle-player-handlers.ts`); `chess-puzzle-solve-session.test.tsx`
- [x] §34 App killed mid-puzzle — `restartApp` scenario: same puzzle restored pending, no outcome, no second start or quota consume
- [x] §35 Solve-flow tests: correct path, wrong path, alt-mate acceptance, promotion variants, castling input variants — `move-judge.test.ts` + the product scenarios above
- [ ] §5 P1 rows (header rating/timer, themes hidden until the end, progress dots, soft-fail, session summary) and §6 P1 progressive-hint extensions — out of this slice; existing hint behaviour kept working

### Slice 5 — Rating (§8)

Kernel: `@pkgs/glicko2` (new package). Domain:
`libs/chess/src/shared/chess/chess-puzzle-rating.ts` +
`chess-puzzle-rating-event.ts`. Mutation:
`use-cases/rate-puzzle-attempt/shared/rate-puzzle-attempt-mutation.ts`.
Query: `use-cases/load-puzzle-rating-events/shared/`. Tables:
`chess_puzzle_rating_events` (new) + `chess_puzzle_profiles.volatility_micros`.
Tests: `bun run --filter @pkgs/glicko2 test`,
`bun run --filter @libs/chess test`
(`tests/puzzle-session/rating.test.ts`, `rate-puzzle-attempt.test.ts`,
`completion.test.ts`), product sim
`libs/chess/tests/e2e/puzzle-rating.test.tsx` (in `@libs/chess` `test:e2e`).
Fixture: `apps/product/fixtures/chess-puzzles-rating.sim.csv`. Decisions
D50–D56, D61, D62.

- [x] §8 Glicko-2 for the player and the puzzle side of the pairing; each attempt is a game (solve = win, fail = loss) — `@pkgs/glicko2` + `applyPuzzleAttemptRating`; the published worked example and seeded properties in `pkgs/glicko2/tests/glicko2.test.ts`, the puzzle wrapper in `libs/chess/tests/puzzle-session/rating.test.ts`
- [x] §8 New users: 1500, RD 350, provisional "?" until RD drops below the threshold — `DEFAULT_PUZZLE_RATING_STATE`, `isProvisionalPuzzleRating` (D55); chip/result-panel marker asserted in `chess-puzzle-rating.test.tsx` ("a new player starts at 1500 provisional", "the provisional marker clears…")
- [x] §8 Server-authoritative rating; the client shows an optimistic estimate and reconciles — `ratePuzzleAttempt` derives the profile in the mutation transaction (D53); offline solve → reconnect → the client lands on the server value (`chess-puzzle-rating.test.tsx`)
- [x] §8 Repeat attempts on an already-seen puzzle never affect rating — the `chess_puzzle_rating_events` primary key (D52); asserted in `chess-puzzle-rating.test.tsx` ("a repeat attempt…"), `chess-puzzle-selection.test.tsx` ("pool exhaustion…") and `completion.test.ts`
- [x] §34 Offline attempts synced days later, out of order, or duplicated — the ledger key makes replay idempotent; `rate-puzzle-attempt.test.ts` replays a batch duplicated and reversed against real SQL, and the product scenario "an offline solve reconciles to the server value and never double-applies" asserts the server rating equals a direct recomputation with exactly one ledger row
- [x] §34 Same account on two devices simultaneously — `signInWithGoogleAsAccount` (D61); "two devices of one account converge on a single rating"
- [ ] §8 P1 rows (puzzle ratings move, reduced weight with extra information, RD inflation over inactivity, per-theme ratings, per-mode ratings, swing caps, zen mode) — out of this slice; the ledger already stores the per-attempt history those rows need

### Slice 6 — Selection (§9)

Kernel: `libs/chess/src/shared/puzzle-session/next-puzzle-selection.ts`
(`puzzleSelectionHalfWindow`, quality bars, `buildExhaustedPuzzleCandidatesSql`,
`pickNextPuzzle`). Client: `use-next-puzzle-id.ts`,
`use-puzzle-candidates-query.ts`. Tests:
`bun run --filter @libs/chess test`
(`tests/puzzle-session/next-puzzle-selection.test.ts`), product sims
`libs/chess/tests/e2e/puzzle-selection.test.tsx` and the rewritten
`chess-puzzle-exhaust.test.tsx` (both in `@libs/chess` `test:e2e`). Fixture:
`apps/product/fixtures/chess-puzzles-selection.sim.csv`. Decisions D57–D60,
D62.

- [x] §9 Puzzles within a window around the user's rating (±100–200, widening with RD) — `puzzleSelectionHalfWindow` (D57); unit + monotonicity tests, and the product scenario reads the live half-window off the pick probe ("the window widens with RD and narrows as the rating settles")
- [x] §9 Never serve a puzzle already attempted in rated mode, until pool exhaustion, then oldest-first and unrated — `buildExhaustedPuzzleCandidatesSql` + `pickNextPuzzle` (D59); "no repeat while unseen puzzles remain…" and "pool exhaustion serves the oldest attempt first, unrated"; the attempt is unrated through the §8 ledger, not a separate flag (D52)
- [x] §9 Quality filter: exclude puzzles below a popularity / play-count threshold — `PUZZLE_MIN_POPULARITY` / `PUZZLE_MIN_PLAYS` on every candidate read (D58; the corpus has no report column); low-quality fixture rows are never served in any phase
- [x] §10.1 / §10.2 The existing feed knobs (difficulty offset, custom rating, theme filter, history filter) keep working on top of the P0 default — `chess-puzzle-feed.test.tsx`, `chess-puzzle-exhaust.test.tsx`
- [x] §34 User exhausts the puzzle pool / rating at extremes where few puzzles exist — the widening step serves unseen puzzles outside the window (the sim fixture sits ~300 points below the seed rating), then the exhausted step keeps the feed alive
- [ ] §9 P1/P2 rows (difficulty presets, target success rate tuning, balance, weakness weighting, prefetch batches, server-side seen set, tilt detection, session shaping, power-user filters) — out of this slice

### Slice 7 — Review (§7)

Kernel: `libs/chess/src/shared/puzzle-session/puzzle-nav.ts`
(`puzzleNavIntentFromKey`, `puzzleNavIntentFromSwipe`,
`resolvePuzzleNavTarget`, `isPuzzleSeekAnimated`) and
`libs/chess/src/shared/chess/chess-puzzle-notation.ts` (`formatSanNotation`).
UI: `public/chess-puzzle/chess-puzzle-move-history{,-nav,-ply,-bar}.tsx`,
`chess-puzzle-review-board.tsx`, `use-puzzle-review-board.ts`,
`puzzle-swipe-handlers.ts`, `chess-puzzle-review-e2e.tsx`. Primitive extended:
`@pkgs/ui-testing` `DriverKey` gained `home` / `end` (tests
`pkgs/ui-testing/tests/keys.test.ts`,
`pkgs/ui-testing-solid-dom/tests/dom-keys.test.ts`). Tests:
`bun run --filter @libs/chess test`
(`tests/puzzle-session/puzzle-nav.test.ts`, `move-notation.test.ts`), product
sim `libs/chess/tests/e2e/puzzle-review.test.tsx` (in `@libs/chess` `test:e2e`).
Decisions D64–D68, D70, D71.

- [x] §7 Move list with tappable moves — `ChessPuzzleMoveHistory` + `HistoryPlyChip`; a ply tap seeks in `chess-puzzle-review.test.tsx` ("buttons, the move list and the ends scrub the solved line")
- [x] §7 SAN / figurine option — `formatSanNotation` driven by `ChessPuzzleFeedConfig.notation` (defaults to SAN letters, D66); `move-notation.test.ts` + the SAN labels asserted in the review sim
- [x] §7 Current move highlighted — the `selected` branch of `HistoryPlyChip`, asserted at every scrub step through its own marker (D71)
- [x] §7 Scrubbing forward / back with buttons — `ChessPuzzleMoveNav` step controls on review, the existing action-bar Back / Forward on play
- [x] §7 Scrubbing with swipe — `puzzleNavIntentFromSwipe` + `puzzleSwipeHandlers` over the review board ("a horizontal swipe scrubs one ply at a time")
- [x] §7 Scrubbing with arrow keys — `useDocumentShortcuts` + `puzzleNavIntentFromKey`, review surface only (D64); "arrow keys step and Home / End jump"
- [x] §7 Jump to start / end — `resolvePuzzleNavTarget`; jump buttons flank the move list on both the review screen and the play move bar
- [x] §7 Board animates on single steps, snaps on jumps — `isPuzzleSeekAnimated` → `SmartChessBoard animations` (D65); asserted at every step of the review sim
- [x] §7 Review after a failed attempt and after "Show solution" both scrub the full line — "review after a failed attempt still scrubs the whole line", "the revealed state scrubs the full line in place"
- [x] §34 Puzzle retired / edited after being prefetched — review reads the row tombstone included (`useReviewPuzzleEntity`, D68); "a retired puzzle still opens in review from the game log"
- [ ] §7 P1 / P2 rows (play-it-out variations, engine analysis + eval bar, refutation lines, source game, copy FEN / PGN, play on vs computer, threats, opening explorer, comments, theme voting) — out of this slice

### Slice 9 — Stats (§15)

Verified against the slice 5 Glicko ledger rather than rewritten:
`deriveChessPuzzleStats` already folds `chess_puzzle_rating_events`, so all
three P0 figures count the §5 first outcome once per puzzle and ignore
repeat / unrated attempts (D69). Changed: `ChessPuzzleStatsCards` now carries
`chess-stats-played` / `-solved` / `-accuracy` test ids so the figures are
addressable. Test: `libs/chess/tests/e2e/puzzle-stats-p0.test.tsx` (in
`@libs/chess` `test:e2e`). Decision D69.

- [x] §15 Current rating — `ChessPuzzleRatingChip` on `chess-stats-screen.tsx` (`chess-stats-elo`); "rating, solved and accuracy are folds of the rating ledger" asserts it equals the server profile row
- [x] §15 Total solved — `deriveChessPuzzleStats.totalSolved` = ledger rows with outcome `solved`; recomputed from the server ledger in the same scenario, and unmoved by an unrated repeat ("an unrated repeat attempt moves none of the three figures")
- [x] §15 Overall accuracy — `round(totalSolved / totalPlayed * 100)` over the ledger, i.e. per attempt and per first outcome, never per move (D69)
- [x] §8 Provisional marker — `formatPuzzleRating` + `isProvisionalPuzzleRating`; visible for a fresh profile and gone once RD settles ("the provisional marker clears once RD settles, figures still hold")
- [ ] §15 P1 / P2 rows (rating graph with ranges, history list + filters, per-theme performance, dashboard windows + radar, activity heatmap, time stats, per-mode bests, weekly report, percentile, goals, export) — out of this slice
