import { expect, test } from 'bun:test';
import {
  confirmMultiplayerCommand,
  openMultiplayerChess,
} from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { givenMultiplayerSpace } from '@libs/chess-matchmaking-harness/multiplayer-spaces';
import {
  awaitGameMatch,
  givenMultiplayerRating,
  givenOpponentSearch,
} from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import {
  shownMultiplayerLineup,
  shownMultiplayerSearch,
} from '@libs/game-matchmaking-harness/multiplayer-presentation';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import { openHarness } from './open-chess-harness';

// regression: game-ui-matchmaking-fields
test('a 40-second search and a 3+2 lineup expose all their visible details', async () => {
  await using s = await openHarness('arena-match-details');
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(givenMultiplayerSpace, 'alice');
  await s.apply(givenOpponentSearch, 'alice', '5+0');
  await s.apply(openMultiplayerChess, 'alice');
  await s.advanceTime(40_000);
  expect(await s.read(shownMultiplayerSearch, 'alice')).toEqual({
    message: 'Looking for a 5+0 chess opponent.',
    elapsedSeconds: 40,
  });
  await s.apply(confirmMultiplayerCommand, 'alice', 'stop');
  await s.apply(givenOpponentSearch, 'alice', '3+2');
  await s.apply(signInWithGoogle, 'bob');
  await s.apply(givenMultiplayerSpace, 'bob');
  await s.apply(givenMultiplayerRating, 'bob', 'blitz', {
    rating: 1620,
    games: 20,
  });
  await s.apply(givenOpponentSearch, 'bob', '3+2');
  await s.apply(awaitGameMatch, 'alice', 'bob', true);
  expect(await s.read(shownMultiplayerLineup, 'alice')).toEqual({
    opponent: 'bob (1620)',
    timeControl: '3+2',
    colour: 'You play White',
  });
}, 120_000);
