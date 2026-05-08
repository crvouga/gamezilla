import { createAttrNamespace } from '@gamezilla/lib/attribute';
import {
  createMessageNamespace,
  createMessageRouter,
  isPlainRecord,
} from '@gamezilla/lib/message';
import type { HandleResult, RoomState } from '@gamezilla/room';
import { CHESS_MAIN_MENU_PUZZLE } from './puzzle/puzzle-main-menu';
import { CHESS_MAIN_MENU_PUZZLE_PLAY } from './puzzle/puzzle-play-screen';

const gamesNs = createAttrNamespace('games');

export const CHESS_MAIN_MENU_ROOT = 0;
export { CHESS_MAIN_MENU_PUZZLE } from './puzzle/puzzle-main-menu';
export { CHESS_MAIN_MENU_PUZZLE_PLAY } from './puzzle/puzzle-play-screen';

export type ChessMainMenuScreen =
  | typeof CHESS_MAIN_MENU_ROOT
  | typeof CHESS_MAIN_MENU_PUZZLE
  | typeof CHESS_MAIN_MENU_PUZZLE_PLAY;

function readChessMainMenuScreen(v: unknown): ChessMainMenuScreen {
  if (v === CHESS_MAIN_MENU_PUZZLE) return CHESS_MAIN_MENU_PUZZLE;
  if (v === CHESS_MAIN_MENU_PUZZLE_PLAY) return CHESS_MAIN_MENU_PUZZLE_PLAY;
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
  return (
    s === CHESS_MAIN_MENU_ROOT ||
    s === CHESS_MAIN_MENU_PUZZLE ||
    s === CHESS_MAIN_MENU_PUZZLE_PLAY
  );
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
