/**
 * Stable payload refs for chess puzzle assistant (LLM resolves copy).
 */
type PayloadRow = {
  readonly ref: string;
  readonly key: string;
};

function buildKeyedRefs(
  prefix: string,
  keys: readonly string[]
): readonly PayloadRow[] {
  const counts = new Map<string, number>();
  const rows: PayloadRow[] = [];
  for (const key of keys) {
    const n = counts.get(key) ?? 0;
    counts.set(key, n + 1);
    const ref = `assistant.chess.puzzle.${prefix}.${key}.${n}`;
    rows.push({ ref, key });
  }
  return rows;
}

function groupByKey(
  rows: readonly PayloadRow[]
): ReadonlyMap<string, readonly string[]> {
  const m = new Map<string, string[]>();
  for (const r of rows) {
    const arr = m.get(r.key) ?? [];
    arr.push(r.ref);
    m.set(r.key, arr);
  }
  return m;
}

const FALLBACK_THEME_KEYS = ["invalid","invalid","invalid","start","start","start","start","progress","progress","progress","progress","wrong","wrong","wrong","wrong","retry","retry","retry","retry","solved","solved","solved","solved","solved"] as const;

const START_THEME_KEYS = ["mateIn1","mateIn1","mateIn1","mateIn2","mateIn2","mateIn2","mateIn3","mateIn3","mateIn4","mateIn4","mateIn5","mateIn5","anastasiaMate","anastasiaMate","arabianMate","arabianMate","backRankMate","backRankMate","balestraMate","balestraMate","blindSwineMate","blindSwineMate","bodenMate","bodenMate","cornerMate","cornerMate","doubleBishopMate","dovetailMate","dovetailMate","epauletteMate","epauletteMate","hookMate","hookMate","killBoxMate","morphysMate","morphysMate","operaMate","operaMate","pillsburysMate","pillsburysMate","smotheredMate","smotheredMate","swallowstailMate","swallowstailMate","triangleMate","vukovicMate","doubleCheck","doubleCheck","discoveredCheck","discoveredCheck","discoveredAttack","discoveredAttack","fork","fork","pin","pin","skewer","skewer","xRayAttack","deflection","deflection","attraction","interference","clearance","intermezzo","sacrifice","sacrifice","capturingDefender","hangingPiece","hangingPiece","trappedPiece","trappedPiece","exposedKing","exposedKing","attackingF2F7","enPassant","promotion","promotion","underPromotion","castling","quietMove","defensiveMove","defensiveMove","advancedPawn","collinearMove","zugzwang","pawnEndgame","knightEndgame","bishopEndgame","rookEndgame","queenEndgame","queenRookEndgame","kingsideAttack","queensideAttack","mate","mate","opening","middlegame","endgame","crushing","advantage","advantage","equality","oneMove","short","long","veryLong","master","masterVsMaster","superGM"] as const;

const PROGRESS_THEME_KEYS = ["mateIn1","mateIn2","mateIn2","mateIn3","mateIn3","mateIn4","mateIn4","mateIn5","mateIn5","anastasiaMate","arabianMate","backRankMate","bodenMate","operaMate","smotheredMate","morphysMate","cornerMate","killBoxMate","hookMate","dovetailMate","epauletteMate","triangleMate","doubleCheck","discoveredCheck","discoveredAttack","fork","pin","skewer","xRayAttack","deflection","attraction","interference","clearance","intermezzo","sacrifice","capturingDefender","hangingPiece","trappedPiece","exposedKing","attackingF2F7","enPassant","promotion","underPromotion","castling","quietMove","defensiveMove","advancedPawn","zugzwang","collinearMove","kingsideAttack","queensideAttack","crushing","advantage","equality","pawnEndgame","knightEndgame","bishopEndgame","rookEndgame","queenEndgame","queenRookEndgame","opening","middlegame","endgame","mate","oneMove","short","long","veryLong"] as const;

const WRONG_THEME_KEYS = ["mateIn1","mateIn1","mateIn2","mateIn2","mateIn3","mateIn3","mateIn4","mateIn5","fork","fork","pin","pin","skewer","skewer","sacrifice","sacrifice","discoveredAttack","discoveredCheck","doubleCheck","deflection","attraction","interference","clearance","intermezzo","hangingPiece","trappedPiece","capturingDefender","exposedKing","backRankMate","smotheredMate","anastasiaMate","arabianMate","bodenMate","operaMate","morphysMate","cornerMate","killBoxMate","hookMate","dovetailMate","epauletteMate","triangleMate","blindSwineMate","balestraMate","promotion","underPromotion","enPassant","castling","zugzwang","quietMove","defensiveMove","advancedPawn","collinearMove","attackingF2F7","kingsideAttack","queensideAttack","crushing","advantage","equality","mate","endgame","opening","middlegame","oneMove","short","long","veryLong","pawnEndgame","knightEndgame","bishopEndgame","rookEndgame","queenEndgame","queenRookEndgame"] as const;

const RETRY_THEME_KEYS = ["mateIn1","mateIn1","mateIn2","mateIn2","mateIn3","mateIn3","mateIn4","mateIn5","fork","pin","skewer","sacrifice","discoveredAttack","discoveredCheck","doubleCheck","deflection","attraction","interference","clearance","intermezzo","backRankMate","smotheredMate","anastasiaMate","operaMate","morphysMate","arabianMate","bodenMate","cornerMate","killBoxMate","hookMate","blindSwineMate","promotion","underPromotion","enPassant","castling","mate","endgame","opening","middlegame","hangingPiece","trappedPiece","capturingDefender","exposedKing","attackingF2F7","crushing","advantage","equality","quietMove","defensiveMove","zugzwang","advancedPawn","collinearMove","kingsideAttack","queensideAttack","oneMove","short","long","veryLong","pawnEndgame","knightEndgame","bishopEndgame","rookEndgame","queenEndgame","queenRookEndgame","master","masterVsMaster","superGM"] as const;

const SOLVED_THEME_KEYS = ["mateIn1","mateIn1","mateIn2","mateIn2","mateIn3","mateIn3","mateIn4","mateIn4","mateIn5","mateIn5","anastasiaMate","arabianMate","backRankMate","balestraMate","blindSwineMate","bodenMate","cornerMate","doubleBishopMate","dovetailMate","epauletteMate","hookMate","killBoxMate","morphysMate","operaMate","pillsburysMate","smotheredMate","swallowstailMate","triangleMate","vukovicMate","doubleCheck","discoveredCheck","discoveredAttack","fork","pin","skewer","xRayAttack","deflection","attraction","interference","clearance","intermezzo","sacrifice","capturingDefender","hangingPiece","trappedPiece","exposedKing","attackingF2F7","enPassant","promotion","underPromotion","castling","quietMove","defensiveMove","advancedPawn","collinearMove","zugzwang","pawnEndgame","knightEndgame","bishopEndgame","rookEndgame","queenEndgame","queenRookEndgame","kingsideAttack","queensideAttack","mate","opening","middlegame","endgame","crushing","advantage","equality","oneMove","short","long","veryLong","master","masterVsMaster","superGM"] as const;

/** One announce line per mate-in theme (refs only; copy from LLM). */
const ANNOUNCE_THEME_KEYS = [
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'mateIn4',
  'mateIn5',
  'mate',
] as const;

const START_ROWS = buildKeyedRefs('start', START_THEME_KEYS);
const PROGRESS_ROWS = buildKeyedRefs('progress', PROGRESS_THEME_KEYS);
const WRONG_ROWS = buildKeyedRefs('wrong', WRONG_THEME_KEYS);
const RETRY_ROWS = buildKeyedRefs('retry', RETRY_THEME_KEYS);
const SOLVED_ROWS = buildKeyedRefs('solved', SOLVED_THEME_KEYS);
const FALLBACK_ROWS = buildKeyedRefs('fallback', FALLBACK_THEME_KEYS);
const ANNOUNCE_ROWS = buildKeyedRefs('announce', ANNOUNCE_THEME_KEYS);

export const CHESS_PUZZLE_START_REFS_BY_THEME = groupByKey(START_ROWS);
export const CHESS_PUZZLE_PROGRESS_REFS_BY_THEME = groupByKey(PROGRESS_ROWS);
export const CHESS_PUZZLE_WRONG_REFS_BY_THEME = groupByKey(WRONG_ROWS);
export const CHESS_PUZZLE_RETRY_REFS_BY_THEME = groupByKey(RETRY_ROWS);
export const CHESS_PUZZLE_SOLVED_REFS_BY_THEME = groupByKey(SOLVED_ROWS);
export const CHESS_PUZZLE_ANNOUNCE_REFS_BY_THEME = groupByKey(ANNOUNCE_ROWS);

const FALLBACK_REFS_BY_EVENT = groupByKey(FALLBACK_ROWS);

export function chessPuzzleFallbackRefs(event: string): readonly string[] {
  return FALLBACK_REFS_BY_EVENT.get(event) ?? [];
}
