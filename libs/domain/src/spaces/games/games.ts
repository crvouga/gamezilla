import {
  createMessageNamespace,
  createMessageRouter,
  isPlainRecord,
} from '@gamezilla/lib/message';
import type { HandleResult, RoomState } from '@gamezilla/room';

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

export function validateSelectGamePayload(
  payload: unknown
): payload is { game: SelectedSpaceGame } {
  if (!isPlainRecord(payload)) return false;
  if (!('game' in payload)) return false;
  const game = payload['game'];
  return game === null || isSpaceGameDiscriminator(game);
}

export function gamesInitialState(): Pick<RoomState, 'selectedGame'> {
  return {
    selectedGame: null,
  };
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
>(gamesEvtNs).on(GameSelected, (state, _identity, event) => ({
  ...state,
  selectedGame: readSelectedSpaceGame(event.payload.game),
}));
