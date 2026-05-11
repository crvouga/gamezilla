/**
 * Maps `(DialogEvent, ChessPuzzleTheme | null)` to a coach line for
 * `SpeakingAvatar` in the puzzle play screen.
 *
 * Hash-map registry, not a `switch`: each entry is a `msg\`...\`` macro result
 * (a `MessageDescriptor`) registered at module load. Looking a dialog up is a
 * deterministic two-step `Map.get`:
 *
 * 1. `(event, pickDialogTheme(themes))` — most-specific themed line.
 * 2. `(event, null)` — guaranteed per-event fallback.
 *
 * Theme resolution walks {@link THEME_PRIORITY} in order, so a puzzle with
 * many themes (Lichess puzzles typically carry 4–7) always picks the same
 * line.
 *
 * The actual message text lives in `chess-puzzle-play-dialog-content.ts` —
 * split out so this module stays inside the size cap while still keeping the
 * supportive-teacher tone resolution centralized here. `msg` macros live with
 * the data so Lingui extracts the literals from their declaration site.
 */
import type { MessageDescriptor } from '@lingui/core';
import {
  CHESS_PUZZLE_THEMES,
  isChessPuzzleTheme,
  type ChessPuzzleTheme,
} from '../../shared/chess-puzzle-themes';
import {
  FALLBACK_ENTRIES,
  PROGRESS_ENTRIES,
  RETRY_ENTRIES,
  SOLVED_ENTRIES,
  START_ENTRIES,
  WRONG_ENTRIES,
} from './chess-puzzle-play-dialog-content';

type DialogMessage = MessageDescriptor;

export const DIALOG_EVENT = {
  loading: 'loading',
  invalid: 'invalid',
  start: 'start',
  progress: 'progress',
  wrong: 'wrong',
  retry: 'retry',
  solved: 'solved',
} as const;

export type DialogEvent = (typeof DIALOG_EVENT)[keyof typeof DIALOG_EVENT];

const DIALOG_EVENT_VALUES: readonly DialogEvent[] = Object.values(DIALOG_EVENT);

const KEY_SEP = '\u0000';
const NONE_THEME = '__none__';

function keyOf(event: DialogEvent, theme: ChessPuzzleTheme | null): string {
  return `${event}${KEY_SEP}${theme ?? NONE_THEME}`;
}

const dialogRegistry = new Map<string, DialogMessage>();

function reg(
  event: DialogEvent,
  theme: ChessPuzzleTheme | null,
  message: DialogMessage
): void {
  const key = keyOf(event, theme);
  if (dialogRegistry.has(key)) {
    throw new Error(`duplicate dialog registration: ${event}/${theme ?? '*'}`);
  }
  dialogRegistry.set(key, message);
}

/**
 * Most-specific-first ordering. `pickDialogTheme` walks this and returns the
 * first match in the puzzle's theme set, giving deterministic single-theme
 * resolution from a multi-theme puzzle row.
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

export function getPuzzlePlayDialog(
  event: DialogEvent,
  themes: readonly string[]
): DialogMessage {
  const theme = pickDialogTheme(themes);
  if (theme !== null) {
    const themed = dialogRegistry.get(keyOf(event, theme));
    if (themed !== undefined) return themed;
  }
  const fallback = dialogRegistry.get(keyOf(event, null));
  if (fallback === undefined) {
    throw new Error(`no fallback dialog registered for event ${event}`);
  }
  return fallback;
}

for (const [event, message] of FALLBACK_ENTRIES) {
  reg(event, null, message);
}
for (const [theme, message] of START_ENTRIES) {
  reg('start', theme, message);
}
for (const [theme, message] of PROGRESS_ENTRIES) {
  reg('progress', theme, message);
}
for (const [theme, message] of WRONG_ENTRIES) {
  reg('wrong', theme, message);
}
for (const [theme, message] of RETRY_ENTRIES) {
  reg('retry', theme, message);
}
for (const [theme, message] of SOLVED_ENTRIES) {
  reg('solved', theme, message);
}

validateDialogRegistry();

function validateDialogRegistry(): void {
  for (const event of DIALOG_EVENT_VALUES) {
    if (!dialogRegistry.has(keyOf(event, null))) {
      throw new Error(`missing fallback dialog for event ${event}`);
    }
  }
  const priorityKeys = new Set<string>(THEME_PRIORITY);
  if (priorityKeys.size !== THEME_PRIORITY.length) {
    throw new Error(
      `THEME_PRIORITY contains duplicate themes (${priorityKeys.size} unique of ${THEME_PRIORITY.length})`
    );
  }
  for (const theme of CHESS_PUZZLE_THEMES) {
    if (!priorityKeys.has(theme)) {
      throw new Error(`THEME_PRIORITY missing theme: ${theme}`);
    }
  }
}
