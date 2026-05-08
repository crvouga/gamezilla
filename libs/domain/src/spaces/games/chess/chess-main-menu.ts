import { createAttrNamespace } from '@gamezilla/lib/attribute';
import {
  createMessageNamespace,
  createMessageRouter,
  isPlainRecord,
} from '@gamezilla/lib/message';
import type { HandleResult, RoomState } from '@gamezilla/room';

const gamesNs = createAttrNamespace('games');

export const CHESS_MAIN_MENU_ROOT = 0;
export const CHESS_MAIN_MENU_PUZZLE = 1;

export type ChessMainMenuScreen =
  | typeof CHESS_MAIN_MENU_ROOT
  | typeof CHESS_MAIN_MENU_PUZZLE;

function readChessMainMenuScreen(v: unknown): ChessMainMenuScreen {
  if (v === CHESS_MAIN_MENU_PUZZLE) return CHESS_MAIN_MENU_PUZZLE;
  return CHESS_MAIN_MENU_ROOT;
}

/** Room keys for the chess in-space main menu (sub-screen under `games/selected === chess`). */
export const ChessMainMenuScreenAttr = {
  screen: gamesNs('chessMainMenuScreen', readChessMainMenuScreen),
} as const;

function validateSetChessMainMenuScreenPayload(
  payload: unknown
): payload is { screen: ChessMainMenuScreen } {
  if (!isPlainRecord(payload)) return false;
  if (!('screen' in payload)) return false;
  const s = payload['screen'];
  return s === CHESS_MAIN_MENU_ROOT || s === CHESS_MAIN_MENU_PUZZLE;
}

export const chessCmdNs = createMessageNamespace('chessCmd');
export const SetChessMainMenuScreen = chessCmdNs(
  'SET_MAIN_MENU_SCREEN',
  validateSetChessMainMenuScreenPayload
);

export const chessEvtNs = createMessageNamespace('chessEvt');
export const ChessMainMenuScreenSet = chessEvtNs(
  'MAIN_MENU_SCREEN_SET',
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
