import { expect, test } from 'bun:test';
import {
  CHESS_TURN_GAMES,
  chessGameShared,
} from '@libs/chess-sub-shared/chess-game';
import { CustomGamesChanged } from '@libs/game-session-shared/custom-game-commands';
import { withCustomGames } from '@libs/game-session-shared/custom-game-definition';
import {
  BOT_CUSTOM_GAME_SIDE,
  type CustomGame,
  CustomGamesAttr,
  newCustomGame,
} from '@libs/game-session-shared/custom-game-state';
import { SpaceEnded } from '@libs/spaces-shared/space-log-messages';
import {
  CancelScheduleEffect,
  ScheduleEffect,
} from '@pkgs/room-root-shared/builtin';

const session = withCustomGames(chessGameShared, CHESS_TURN_GAMES);
const active: CustomGame = {
  ...newCustomGame(
    'friday-game',
    'alice',
    CHESS_TURN_GAMES.byId('chess').initial()
  ),
  status: 'active',
  black: { kind: 'person', person: 'bob' },
  ready: ['white', 'black'],
  startedAt: 0,
  turnStartedAt: 0,
};

function endSpace(game: CustomGame): CustomGame {
  const result = session.reactToSpaceEvent?.(
    CustomGamesAttr({ current: game, history: [] }),
    {
      identity: 'alice',
      ts: 10_000,
      commandId: 'space-ending',
      random: () => 0,
    },
    SpaceEnded({})
  );
  if (result == null) return game;
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  const changed = result.events.find(CustomGamesChanged.is);
  if (changed === undefined) throw new Error('game ending has no outcome');
  const current = changed.payload.games.current;
  if (current === null) throw new Error('game ending erased its history');
  return current;
}

// Demoted from custom-game-completion: the ended space has no game screen.
// regression: custom-game-ended-space-unobservable
test('ending a space cancels its unfinished game without a winner', () => {
  const result = endSpace(active);
  expect(result.status).toBe('cancelled');
  expect(result.outcome).toBe('cancelled');
  expect(result.endedAt).toBe(10_000);
});

test('ending a space preserves a completed result verbatim', () => {
  const completed: CustomGame = {
    ...active,
    status: 'completed',
    outcome: 'white wins by resignation',
    endedAt: 5_000,
  };
  expect(endSpace(completed)).toEqual(completed);
});

// regression: custom-game-ended-space-unobservable
test('ending a two-bot game cancels it and leaves no bot wake', () => {
  const game = {
    ...active,
    white: BOT_CUSTOM_GAME_SIDE,
    black: BOT_CUSTOM_GAME_SIDE,
  };
  const result = endSpace(game);
  expect(result.status).toBe('cancelled');
  expect(result.outcome).toBe('cancelled');
  const state = CustomGamesAttr({ current: result, history: [] });
  for (const effects of [
    session.recoverEffects(state),
    session.recoverLocalEffects?.(state) ?? [],
  ]) {
    expect(effects.some(ScheduleEffect.is)).toBe(false);
    expect(effects.some(CancelScheduleEffect.is)).toBe(true);
  }
});
