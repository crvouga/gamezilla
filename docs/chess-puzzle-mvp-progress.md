# Chess puzzle Phase 1 MVP — progress

Phase 1 `P0` items of [`chess-puzzle-mvp.md`](chess-puzzle-mvp.md), in the order
§37 gives. A box is ticked only when the slice's seeded sim scenarios pass and
`turbo run typecheck lint test --filter=...[origin/main]` exits 0; the commit
hash is the slice commit. Assumptions: [`overnight-decisions.md`](overnight-decisions.md).

| # | Slice | Spec | Status | Commit |
| - | ----- | ---- | ------ | ------ |
| 1 | Rules core + perft | §1 P0, §35 perft/round-trip | pending | |
| 2 | Permission layer, permissive baseline | §22.1–22.7 P0, §22.11 P0, §35 permission tests | pending | |
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
