import { expect, test } from 'bun:test';
import { readCustomGameScreen } from '@libs/game-session-harness-ts/custom-game-screen';
import { establishLocalPong } from '@libs/pong-harness-ts/pong-actions';
import { openHarness } from './open-pong-harness';

test('a simulation-only registration reaches the shared custom-game choices', async () => {
  // regression: simulation-client-catalog-dropped-registration
  await using s = await openHarness(
    'simulation-client-catalog-dropped-registration'
  );
  await s.apply(establishLocalPong, false);
  expect((await s.read(readCustomGameScreen, 'alice'))?.current?.status).toBe(
    'configuring'
  );
});
