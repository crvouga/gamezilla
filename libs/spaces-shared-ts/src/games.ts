import { createAttrNamespace } from '@pkgs/attribute-shared-ts/attribute';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared-ts/message';
import { createMessageRouter } from '@pkgs/message-shared-ts/router';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared-ts/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';

import type { GameCommandContext, GameDefinition } from './game';

export type SelectedGameId = string | null;

function readSelectedGameId(value: unknown): SelectedGameId {
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Where every game starts in a space: the game's home (its choices). The
 * value is synced room state shared by every device, so it never changes.
 */
export const GAME_HOME_SCREEN = 'choices';

/** A screen key is a short lowercase slug the selected game resolves. */
const SCREEN_KEY = /^[a-z][a-z0-9-]{0,63}$/;

function isGameScreenKey(value: unknown): value is string {
  return typeof value === 'string' && SCREEN_KEY.test(value);
}

function readGameScreen(value: unknown): string {
  return isGameScreenKey(value) ? value : GAME_HOME_SCREEN;
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

/** Why the space cannot leave the screen a game holds it on. */
export const SPACE_HELD_REASON = 'the space stays on the game under way';

/** The screen one of `modules` holds the space on now, or `null`. */
export function heldGameScreen(
  modules: readonly GameDefinition[],
  state: RoomState
): string | null {
  for (const module of modules) {
    const screen = module.holdsSpace?.(state) ?? null;
    if (screen !== null) return screen;
  }
  return null;
}

function refuseHeld(): HandleResult {
  return {
    ok: false,
    error: { type: ROOM_ERROR_TYPE.conflict, reason: SPACE_HELD_REASON },
  };
}

/**
 * Factory for the games command router. The set of allowed game ids comes
 * from the runtime registry passed at composition time; spaces itself is
 * game-agnostic and never references any specific game module. While one
 * of `modules` holds the space (`holdsSpace`), the game and its screen stay.
 */
export function createGamesCommandRouter(
  games: readonly GameDefinition[],
  modules: readonly GameDefinition[] = games
) {
  const allowedIds = new Set(games.map((g) => g.id));
  return createMessageRouter<RoomState, GameCommandContext, HandleResult>(
    gamesCmdNs
  )
    .on(SelectGame, (state, _identity, cmd) => {
      const game = cmd.payload.game;
      if (
        heldGameScreen(modules, state) !== null &&
        game !== GamesRoomAttr.selected.from(state)
      )
        return refuseHeld();
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
    .on(ShowGameScreen, (state, _identity, cmd) => {
      const held = heldGameScreen(modules, state);
      if (held !== null && cmd.payload.screen !== held) return refuseHeld();
      return {
        ok: true,
        events: [GameScreenShown({ screen: cmd.payload.screen })],
      };
    });
}

/**
 * The games event reducer. Applies the `selected` attr and, when the host
 * switches from one game to another, returns the space to the game's
 * choices.
 */
export function createGamesEventReducer() {
  return createMessageRouter<RoomState, void, RoomState>(gamesEvtNs)
    .on(GameSelected, (state, _identity, event) => {
      const previous = GamesRoomAttr.selected.from(state);
      const next = event.payload.game;
      let result: RoomState = { ...state, ...GamesRoomAttr.selected(next) };
      if (previous !== null && previous !== next)
        result = { ...result, ...GamesRoomAttr.screen(GAME_HOME_SCREEN) };
      return result;
    })
    .on(GameScreenShown, (state, _identity, event) => ({
      ...state,
      ...GamesRoomAttr.screen(event.payload.screen),
    }));
}
