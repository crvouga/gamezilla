import { expect, test } from 'bun:test';
import { CustomGamesChanged } from '@libs/chess-custom-game-shared/custom-game-commands';
import {
  type CustomGame,
  CustomGamesAttr,
  newCustomGame,
} from '@libs/chess-custom-game-shared/custom-game-state';
import { chessGameShared } from '@libs/chess-feature-shared/chess-game';
import { SpaceEnded } from '@libs/spaces-shared/space-log-messages';

const active: CustomGame = {
  ...newCustomGame('friday-game', 'alice'),
  status: 'active',
  black: { kind: 'person', person: 'bob' },
  ready: ['white', 'black'],
  startedAt: 0,
};

function endSpace(game: CustomGame): CustomGame {
  const result = chessGameShared.reactToSpaceEvent?.(
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
  if (!result.ok) throw new Error(result.error.reason);
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
