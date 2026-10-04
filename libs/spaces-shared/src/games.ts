import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared/message';
import { createMessageRouter } from '@pkgs/message-shared/router';
import type { HandleResult, RoomState } from '@pkgs/room-shared/types';

import type { GameCommandContext, GameDefinition } from './game';

export type SelectedGameId = string | null;

function readSelectedGameId(value: unknown): SelectedGameId {
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const gamesRoomNs = createAttrNamespace('games');

/** Namespaced keys in {@link RoomState} for the space games slice. */
export const GamesRoomAttr = {
  selected: gamesRoomNs.textOrNull('selected', readSelectedGameId),
} as const;

function validateSelectGamePayload(
  payload: unknown
): payload is { game: SelectedGameId } {
  if (!isPlainRecord(payload)) return false;
  if (!('game' in payload)) return false;
  const game = payload['game'];
  return game === null || (typeof game === 'string' && game.trim().length > 0);
}

export const gamesCmdNs = createMessageNamespace('games-cmd');
export const SelectGame = gamesCmdNs('select-game', validateSelectGamePayload);

export const gamesEvtNs = createMessageNamespace('games-evt');
export const GameSelected = gamesEvtNs('selected', validateSelectGamePayload);

/**
 * Factory for the games command router. The set of allowed game ids comes
 * from the runtime registry passed at composition time; spaces itself is
 * game-agnostic and never references any specific game module.
 */
export function createGamesCommandRouter(games: readonly GameDefinition[]) {
  const allowedIds = new Set(games.map((g) => g.id));
  return createMessageRouter<RoomState, GameCommandContext, HandleResult>(
    gamesCmdNs
  ).on(SelectGame, (_state, _identity, cmd) => {
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
  });
}

/**
 * Factory for the games event reducer. Applies the `selected` attr and
 * invokes the previously-selected game's `resetRoomState` (if any) so per-game
 * attributes are cleared when the host switches away.
 */
export function createGamesEventReducer(games: readonly GameDefinition[]) {
  const byId = new Map(games.map((g) => [g.id, g]));
  return createMessageRouter<RoomState, void, RoomState>(gamesEvtNs).on(
    GameSelected,
    (state, _identity, event) => {
      const previous = GamesRoomAttr.selected.from(state);
      const next = event.payload.game;
      let result: RoomState = { ...state, ...GamesRoomAttr.selected(next) };
      if (previous !== null && previous !== next) {
        const game = byId.get(previous);
        if (game?.resetRoomState !== undefined) {
          result = game.resetRoomState(result);
        }
      }
      return result;
    }
  );
}
