import type { GameCommandContext } from '@libs/spaces-shared/game';
import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared/message';
import { createMessageRouter } from '@pkgs/message-shared/router';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared/types';

export const CHESS_SCREEN = {
  root: 'root',
  puzzle: 'puzzle',
  customGame: 'custom-game',
  multiplayer: 'multiplayer',
  stats: 'stats',
  statsReview: 'stats-review',
  settings: 'settings',
  settingsDeveloper: 'settings-developer',
  settingsDeveloperUi: 'settings-developer-ui',
  settingsDeveloperUiDetail: 'settings-developer-ui-detail',
};

export type ChessMainMenuScreen =
  (typeof CHESS_SCREEN)[keyof typeof CHESS_SCREEN];

const ALL_SCREENS = new Set<string>(Object.values(CHESS_SCREEN));

function readChessMainMenuScreen(v: unknown): ChessMainMenuScreen {
  if (typeof v === 'string' && ALL_SCREENS.has(v)) {
    return v as ChessMainMenuScreen;
  }
  return CHESS_SCREEN.root;
}

function readSelectedUiComponentName(v: unknown): string | null {
  if (v === null) return null;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function readSelectedReviewPuzzleId(v: unknown): string | null {
  if (v === null) return null;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function readNonNegativeInteger(v: unknown): number {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return v;
  return 0;
}

function isNonNegativeInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

const gamesNs = createAttrNamespace('chess', 'main-menu');

/** Room keys for the chess in-space main menu (sub-screen under `games/selected === chess`). */
export const ChessMainMenuScreenAttr = {
  screen: gamesNs.text('screen', readChessMainMenuScreen),
  selectedUiComponentName: gamesNs.textOrNull(
    'selected-ui-component-name',
    readSelectedUiComponentName
  ),
  selectedReviewPuzzleId: gamesNs.textOrNull(
    'selected-review-puzzle-id',
    readSelectedReviewPuzzleId
  ),
  /** Review timeline cursor; `0` means unset (jump-to-end pending). */
  selectedReviewSolveIdx: gamesNs.integer(
    'selected-review-solve-idx',
    readNonNegativeInteger
  ),
} as const;

function isChessMainMenuScreen(v: unknown): v is ChessMainMenuScreen {
  return typeof v === 'string' && ALL_SCREENS.has(v);
}

function validateSetChessMainMenuScreenPayload(
  payload: unknown
): payload is { screen: ChessMainMenuScreen } {
  if (!isPlainRecord(payload)) return false;
  if (!('screen' in payload)) return false;
  return isChessMainMenuScreen(payload['screen']);
}

function validateSetChessSelectedUiComponentPayload(
  payload: unknown
): payload is { name: string | null } {
  if (!isPlainRecord(payload)) return false;
  if (!('name' in payload)) return false;
  const n = payload['name'];
  if (n === null) return true;
  if (typeof n !== 'string') return false;
  return n.trim().length > 0;
}

export type SetChessSelectedReviewPuzzlePayload = {
  puzzleId: string | null;
  solveIdx: number;
};

function validateSetChessSelectedReviewPuzzlePayload(
  payload: unknown
): payload is SetChessSelectedReviewPuzzlePayload {
  if (!isPlainRecord(payload)) return false;
  if (!('puzzleId' in payload) || !('solveIdx' in payload)) return false;
  if (!isNonNegativeInteger(payload['solveIdx'])) return false;
  const id = payload['puzzleId'];
  if (id === null) return true;
  if (typeof id !== 'string') return false;
  return id.trim().length > 0;
}

function validateSeekChessPuzzleReviewPayload(
  payload: unknown
): payload is { solveIdx: number } {
  if (!isPlainRecord(payload)) return false;
  return isNonNegativeInteger(payload['solveIdx']);
}

export const chessCmdNs = createMessageNamespace('chess-cmd');
export const SetChessMainMenuScreen = chessCmdNs(
  'set-main-menu-screen',
  validateSetChessMainMenuScreenPayload
);
export const SetChessSelectedUiComponent = chessCmdNs(
  'set-selected-ui-component',
  validateSetChessSelectedUiComponentPayload
);
export const SetChessSelectedReviewPuzzle = chessCmdNs(
  'set-selected-review-puzzle',
  validateSetChessSelectedReviewPuzzlePayload
);
export const SeekChessPuzzleReview = chessCmdNs(
  'seek-puzzle-review',
  validateSeekChessPuzzleReviewPayload
);

export const chessEvtNs = createMessageNamespace('chess-evt');
export const ChessMainMenuScreenSet = chessEvtNs(
  'main-menu-screen-set',
  validateSetChessMainMenuScreenPayload
);
export const ChessSelectedUiComponentSet = chessEvtNs(
  'selected-ui-component-set',
  validateSetChessSelectedUiComponentPayload
);
export const ChessSelectedReviewPuzzleSet = chessEvtNs(
  'selected-review-puzzle-set',
  validateSetChessSelectedReviewPuzzlePayload
);
export const ChessPuzzleReviewSeekSet = chessEvtNs(
  'puzzle-review-seek-set',
  validateSeekChessPuzzleReviewPayload
);

export const chessMainMenuCommandRouter = createMessageRouter<
  RoomState,
  GameCommandContext,
  HandleResult
>(chessCmdNs)
  .on(SetChessMainMenuScreen, (_state, _identity, cmd) => ({
    ok: true,
    events: [ChessMainMenuScreenSet({ screen: cmd.payload.screen })],
  }))
  .on(SetChessSelectedUiComponent, (_state, _identity, cmd) => ({
    ok: true,
    events: [ChessSelectedUiComponentSet({ name: cmd.payload.name })],
  }))
  .on(SetChessSelectedReviewPuzzle, (_state, _identity, cmd) => ({
    ok: true,
    events: [
      ChessSelectedReviewPuzzleSet({
        puzzleId: cmd.payload.puzzleId,
        solveIdx: cmd.payload.solveIdx,
      }),
    ],
  }))
  .on(SeekChessPuzzleReview, (_state, _identity, cmd) => ({
    ok: true,
    events: [ChessPuzzleReviewSeekSet({ solveIdx: cmd.payload.solveIdx })],
  }));

export const chessMainMenuEventReducer = createMessageRouter<
  RoomState,
  void,
  RoomState
>(chessEvtNs)
  .on(ChessMainMenuScreenSet, (state, _identity, ev) => ({
    ...state,
    ...ChessMainMenuScreenAttr.screen(ev.payload.screen),
  }))
  .on(ChessSelectedUiComponentSet, (state, _identity, ev) => ({
    ...state,
    ...ChessMainMenuScreenAttr.selectedUiComponentName(ev.payload.name),
  }))
  .on(ChessSelectedReviewPuzzleSet, (state, _identity, ev) => ({
    ...state,
    ...ChessMainMenuScreenAttr.selectedReviewPuzzleId(ev.payload.puzzleId),
    ...ChessMainMenuScreenAttr.selectedReviewSolveIdx(ev.payload.solveIdx),
  }))
  .on(ChessPuzzleReviewSeekSet, (state, _identity, ev) => ({
    ...state,
    ...ChessMainMenuScreenAttr.selectedReviewSolveIdx(ev.payload.solveIdx),
  }));
