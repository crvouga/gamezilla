import {
  CHESS_PUZZLE_THEMES,
  isChessPuzzleTheme,
  type ChessPuzzleTheme,
} from '../../shared/chess-puzzle-themes';
import { assert } from '@gamezilla/lib/assert';

/**
 * Most-specific-first ordering. `pickDialogTheme` walks this and returns the
 * first match in the puzzle's theme set.
 */
const THEME_PRIORITY = [
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'mateIn4',
  'mateIn5',
  'anastasiaMate',
  'arabianMate',
  'backRankMate',
  'balestraMate',
  'blindSwineMate',
  'bodenMate',
  'cornerMate',
  'doubleBishopMate',
  'dovetailMate',
  'epauletteMate',
  'hookMate',
  'killBoxMate',
  'morphysMate',
  'operaMate',
  'pillsburysMate',
  'smotheredMate',
  'swallowstailMate',
  'triangleMate',
  'vukovicMate',
  'doubleCheck',
  'discoveredCheck',
  'discoveredAttack',
  'fork',
  'pin',
  'skewer',
  'xRayAttack',
  'deflection',
  'attraction',
  'interference',
  'clearance',
  'intermezzo',
  'sacrifice',
  'capturingDefender',
  'hangingPiece',
  'trappedPiece',
  'exposedKing',
  'attackingF2F7',
  'enPassant',
  'promotion',
  'underPromotion',
  'castling',
  'quietMove',
  'defensiveMove',
  'advancedPawn',
  'collinearMove',
  'zugzwang',
  'pawnEndgame',
  'knightEndgame',
  'bishopEndgame',
  'rookEndgame',
  'queenEndgame',
  'queenRookEndgame',
  'kingsideAttack',
  'queensideAttack',
  'mate',
  'opening',
  'middlegame',
  'endgame',
  'crushing',
  'advantage',
  'equality',
  'oneMove',
  'short',
  'long',
  'veryLong',
  'master',
  'masterVsMaster',
  'superGM',
] as const satisfies readonly ChessPuzzleTheme[];

export function pickDialogTheme(
  themes: readonly string[]
): ChessPuzzleTheme | null {
  if (themes.length === 0) return null;
  const themeSet = new Set<string>(themes);
  for (const theme of THEME_PRIORITY) {
    if (themeSet.has(theme)) return theme;
  }
  for (const raw of themes) {
    if (isChessPuzzleTheme(raw)) return raw;
  }
  return null;
}

export function assertThemePriorityCoversCatalog(): void {
  const priorityKeys = new Set<string>(THEME_PRIORITY);
  assert.ok(
    priorityKeys.size === THEME_PRIORITY.length,
    `THEME_PRIORITY contains duplicate themes (${priorityKeys.size} unique of ${THEME_PRIORITY.length})`,
    { unique: priorityKeys.size, total: THEME_PRIORITY.length }
  );
  for (const theme of CHESS_PUZZLE_THEMES) {
    assert.ok(
      priorityKeys.has(theme),
      `THEME_PRIORITY missing theme: ${theme}`,
      { theme }
    );
  }
}

assertThemePriorityCoversCatalog();
