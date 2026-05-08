import { createAttrNamespace } from '@gamezilla/lib/attribute';
import {
  createMessageNamespace,
  createMessageRouter,
  isPlainRecord,
} from '@gamezilla/lib/message';
import type { HandleResult, RoomState } from '@gamezilla/room';

export const CHESS_SCREEN = {
  root: 'root',
  puzzle: 'puzzle',
  puzzlePlay: 'puzzle-play',
};

export type ChessMainMenuScreen =
  (typeof CHESS_SCREEN)[keyof typeof CHESS_SCREEN];

function readChessMainMenuScreen(v: unknown): ChessMainMenuScreen {
  if (v === CHESS_SCREEN.puzzle) return CHESS_SCREEN.puzzle;
  if (v === CHESS_SCREEN.puzzlePlay) return CHESS_SCREEN.puzzlePlay;
  return CHESS_SCREEN.root;
}

const gamesNs = createAttrNamespace('chess', 'main-menu');

/** Room keys for the chess in-space main menu (sub-screen under `games/selected === chess`). */
export const ChessMainMenuScreenAttr = {
  screen: gamesNs('screen', readChessMainMenuScreen),
} as const;

function validateSetChessMainMenuScreenPayload(
  payload: unknown
): payload is { screen: ChessMainMenuScreen } {
  if (!isPlainRecord(payload)) return false;
  if (!('screen' in payload)) return false;
  const s = payload['screen'];
  return (
    s === CHESS_SCREEN.root ||
    s === CHESS_SCREEN.puzzle ||
    s === CHESS_SCREEN.puzzlePlay
  );
}

export const chessCmdNs = createMessageNamespace('chess-cmd');
export const SetChessMainMenuScreen = chessCmdNs(
  'set-main-menu-screen',
  validateSetChessMainMenuScreenPayload
);

export const chessEvtNs = createMessageNamespace('chess-evt');
export const ChessMainMenuScreenSet = chessEvtNs(
  'main-menu-screen-set',
  validateSetChessMainMenuScreenPayload
);

export const chessMainMenuCommandRouter = createMessageRouter<
  RoomState,
  string,
  HandleResult
>(chessCmdNs).on(SetChessMainMenuScreen, (_state, _identity, cmd) => ({
  ok: true,
  events: [ChessMainMenuScreenSet({ screen: cmd.payload.screen })],
}));

export const chessMainMenuEventReducer = createMessageRouter<
  RoomState,
  void,
  RoomState
>(chessEvtNs).on(ChessMainMenuScreenSet, (state, _identity, ev) => ({
  ...state,
  ...ChessMainMenuScreenAttr.screen(ev.payload.screen),
}));
