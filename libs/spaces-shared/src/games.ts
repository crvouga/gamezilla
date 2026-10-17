import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared/message';
import { createMessageRouter } from '@pkgs/message-shared/router';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared/types';

import type { GameCommandContext, GameDefinition } from './game';

export type SelectedGameId = string | null;

function readSelectedGameId(value: unknown): SelectedGameId {
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Where every game starts in a space: the game's choices. */
export const GAME_CHOICES_SCREEN = 'choices';

/** A screen key is a short lowercase slug the selected game resolves. */
const SCREEN_KEY = /^[a-z][a-z0-9-]{0,63}$/;

function isGameScreenKey(value: unknown): value is string {
  return typeof value === 'string' && SCREEN_KEY.test(value);
}

function readGameScreen(value: unknown): string {
  return isGameScreenKey(value) ? value : GAME_CHOICES_SCREEN;
}

const gamesRoomNs = createAttrNamespace('games');

/** Namespaced keys in {@link RoomState} for the space games slice. */
export const GamesRoomAttr = {
  selected: gamesRoomNs.textOrNull('selected', readSelectedGameId),
  /** What the selected game shows everyone in the space. */
  screen: gamesRoomNs.text('screen', readGameScreen),
} as const;

function validateSelectGamePayload(
  payload: unknown
): payload is { game: SelectedGameId } {
  if (!isPlainRecord(payload)) return false;
  if (!('game' in payload)) return false;
  const game = payload['game'];
  return game === null || (typeof game === 'string' && game.trim().length > 0);
}

function validateShowGameScreenPayload(
  payload: unknown
): payload is { screen: string } {
  return isPlainRecord(payload) && isGameScreenKey(payload['screen']);
}

export const gamesCmdNs = createMessageNamespace('games-cmd');
export const SelectGame = gamesCmdNs('select-game', validateSelectGamePayload);
/** Show one of the selected game's screens to everyone in the space. */
export const ShowGameScreen = gamesCmdNs(
  'show-screen',
  validateShowGameScreenPayload
);

export const gamesEvtNs = createMessageNamespace('games-evt');
export const GameSelected = gamesEvtNs('selected', validateSelectGamePayload);
export const GameScreenShown = gamesEvtNs(
  'screen-shown',
  validateShowGameScreenPayload
);

/**
 * Factory for the games command router. The set of allowed game ids comes
 * from the runtime registry passed at composition time; spaces itself is
 * game-agnostic and never references any specific game module.
 */
export function createGamesCommandRouter(games: readonly GameDefinition[]) {
  const allowedIds = new Set(games.map((g) => g.id));
  return createMessageRouter<RoomState, GameCommandContext, HandleResult>(
    gamesCmdNs
  )
    .on(SelectGame, (_state, _identity, cmd) => {
      const game = cmd.payload.game;
      if (game !== null && !allowedIds.has(game)) {
        return {
          ok: true,
          events: [GameSelected({ game: null })],
        };
      }
      return {
        ok: true,
        events: [GameSelected({ game })],
      };
    })
    .on(ShowGameScreen, (_state, _identity, cmd) => ({
      ok: true,
      events: [GameScreenShown({ screen: cmd.payload.screen })],
    }));
}

/**
 * Factory for the games event reducer. Applies the `selected` attr and, when
 * the host switches from one game to another, returns the space to the
 * game's choices and invokes
 * the previously-selected game's `resetRoomState` (if any) so per-game
 * attributes are cleared when the host switches away.
 */
export function createGamesEventReducer(games: readonly GameDefinition[]) {
  const byId = new Map(games.map((g) => [g.id, g]));
  return createMessageRouter<RoomState, void, RoomState>(gamesEvtNs)
    .on(GameSelected, (state, _identity, event) => {
      const previous = GamesRoomAttr.selected.from(state);
      const next = event.payload.game;
      let result: RoomState = { ...state, ...GamesRoomAttr.selected(next) };
      if (previous !== null && previous !== next) {
        result = { ...result, ...GamesRoomAttr.screen(GAME_CHOICES_SCREEN) };
        const game = byId.get(previous);
        if (game?.resetRoomState !== undefined) {
          result = game.resetRoomState(result);
        }
      }
      return result;
    })
    .on(GameScreenShown, (state, _identity, event) => ({
      ...state,
      ...GamesRoomAttr.screen(event.payload.screen),
    }));
}
