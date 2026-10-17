import type { GameCommandContext } from '@libs/spaces-shared/game';
import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared/message';
import { createMessageRouter } from '@pkgs/message-shared/router';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared/types';

/**
 * Chess's own screens in the space-wide game screen. The game's choices and
 * the shared custom-game, opponent and history screens belong to the
 * platform.
 */
export const CHESS_SCREEN = {
  puzzle: 'puzzle',
  stats: 'stats',
  statsReview: 'stats-review',
  settings: 'settings',
  settingsDeveloper: 'settings-developer',
  settingsDeveloperPuzzles: 'settings-developer-puzzles',
  settingsDeveloperUi: 'settings-developer-ui',
  settingsDeveloperUiDetail: 'settings-developer-ui-detail',
};

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

/** Room keys for what chess's own screens have selected. */
export const ChessScreensAttr = {
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

export const chessScreensCommandRouter = createMessageRouter<
  RoomState,
  GameCommandContext,
  HandleResult
>(chessCmdNs)
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

export const chessScreensEventReducer = createMessageRouter<
  RoomState,
  void,
  RoomState
>(chessEvtNs)
  .on(ChessSelectedUiComponentSet, (state, _identity, ev) => ({
    ...state,
    ...ChessScreensAttr.selectedUiComponentName(ev.payload.name),
  }))
  .on(ChessSelectedReviewPuzzleSet, (state, _identity, ev) => ({
    ...state,
    ...ChessScreensAttr.selectedReviewPuzzleId(ev.payload.puzzleId),
    ...ChessScreensAttr.selectedReviewSolveIdx(ev.payload.solveIdx),
  }))
  .on(ChessPuzzleReviewSeekSet, (state, _identity, ev) => ({
    ...state,
    ...ChessScreensAttr.selectedReviewSolveIdx(ev.payload.solveIdx),
  }));
