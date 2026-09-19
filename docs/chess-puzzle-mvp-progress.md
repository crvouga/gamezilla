# Chess puzzle Phase 1 MVP — progress

Phase 1 `P0` items of [`chess-puzzle-mvp.md`](chess-puzzle-mvp.md), in the order
§37 gives. A box is ticked only when the slice's seeded sim scenarios pass and
`turbo run typecheck lint test --filter=...[origin/main]` exits 0; the commit
hash is the slice commit. Assumptions: [`overnight-decisions.md`](overnight-decisions.md).

| # | Slice | Spec | Status | Commit |
| - | ----- | ---- | ------ | ------ |
| 1 | Rules core + perft | §1 P0, §35 perft/round-trip | done | 4ef94c80b |
| 2 | Permission layer, permissive baseline | §22.1–22.7 P0, §22.11 P0, §35 permission tests | done | 5aed447b3 |
| 3 | Lichess ingest + validation | §4 P0, §23 P0, §35 DB validation | pending | |
| 4 | Solve flow | §5 P0, §6 P0, §3 P0 castling/promotion input rules | pending | |
| 5 | Rating mutator (Glicko-2) | §8 P0 | pending | |
| 6 | Selection | §9 P0, §10.1/10.2 P0 | pending | |
| 7 | Review | §7 P0 | pending | |
| 8 | Coach v1 | §36 P0 | pending | |
| 9 | Stats | §15 P0 | pending | |
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
`apps/product/tests/chess-puzzle-quota.test.tsx` (in `test:chess`). Decisions D12–D26.

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
(`tests/puzzle-data/*`), product sims `apps/product/tests/chess-puzzle-ingest.test.tsx`
+ `chess-puzzle-fixtures.test.ts` (in `test:chess`). Decisions D27–D34.

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
