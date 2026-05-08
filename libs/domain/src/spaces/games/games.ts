import { createAttrNamespace } from '@gamezilla/lib/attribute';
import {
  createMessageNamespace,
  createMessageRouter,
  isPlainRecord,
} from '@gamezilla/lib/message';
import type { HandleResult, RoomState } from '@gamezilla/room';

import {
  CHESS_MAIN_MENU_ROOT,
  ChessMainMenuScreenAttr,
} from './chess/chess-main-menu';

export const SpaceGame = {
  chess: 'chess',
} as const;

export type SpaceGameDiscriminator = (typeof SpaceGame)[keyof typeof SpaceGame];
export type SelectedSpaceGame = SpaceGameDiscriminator | null;

const validSpaceGames = new Set<string>(Object.values(SpaceGame));

export function isSpaceGameDiscriminator(
  value: unknown
): value is SpaceGameDiscriminator {
  return typeof value === 'string' && validSpaceGames.has(value);
}

export function readSelectedSpaceGame(value: unknown): SelectedSpaceGame {
  return isSpaceGameDiscriminator(value) ? value : null;
}

const gamesRoomNs = createAttrNamespace('games');

/** Namespaced keys in {@link RoomState} for the space games slice. */
export const GamesRoomAttr = {
  selected: gamesRoomNs('selected', readSelectedSpaceGame),
} as const;

export function validateSelectGamePayload(
  payload: unknown
): payload is { game: SelectedSpaceGame } {
  if (!isPlainRecord(payload)) return false;
  if (!('game' in payload)) return false;
  const game = payload['game'];
  return game === null || isSpaceGameDiscriminator(game);
}

export const gamesCmdNs = createMessageNamespace('gamesCmd');
export const SelectGame = gamesCmdNs('SELECT_GAME', validateSelectGamePayload);

export const gamesEvtNs = createMessageNamespace('gamesEvt');
export const GameSelected = gamesEvtNs('SELECTED', validateSelectGamePayload);

export const gamesCommandRouter = createMessageRouter<
  RoomState,
  string,
  HandleResult
>(gamesCmdNs).on(SelectGame, (_state, _identity, cmd) => ({
  ok: true,
  events: [GameSelected({ game: cmd.payload.game })],
}));

export const gamesEventReducer = createMessageRouter<
  RoomState,
  void,
  RoomState
>(gamesEvtNs).on(GameSelected, (state, _identity, event) => {
  const game = readSelectedSpaceGame(event.payload.game);
  let next = { ...state, ...GamesRoomAttr.selected(game) };
  if (game !== SpaceGame.chess) {
    next = { ...next, ...ChessMainMenuScreenAttr.screen(CHESS_MAIN_MENU_ROOT) };
  }
  return next;
});
