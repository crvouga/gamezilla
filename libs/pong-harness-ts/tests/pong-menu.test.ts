import { expect, test } from 'bun:test';
import { readCustomGameScreen } from '@libs/game-session-harness-ts/custom-game-screen';
import { establishLocalPong } from '@libs/pong-harness-ts/pong-actions';
import { establishPongLocalStage } from '@libs/pong-harness-ts/pong-local-actions';
import { pongView } from '@libs/pong-harness-ts/pong-view';
import { openHarness } from './open-pong-harness';

test('a simulation-only registration reaches the shared custom-game choices', async () => {
  // regression: simulation-client-catalog-dropped-registration
  await using s = await openHarness();
  await s.apply(establishLocalPong, false);
  expect((await s.read(readCustomGameScreen, 'alice'))?.current?.status).toBe(
    'configuring'
  );
});

// regression: finished-local-pong-fixture-runs-past-victory-budget
test('the finished local Pong fixture plays a deciding point against Bob', async () => {
  await using s = await openHarness({ seed: 1 });
  await s.apply(establishPongLocalStage, {
    actor: 'alice',
    opponent: 'person',
    stage: 'finished',
  });
  const court = await s.read(pongView);
  expect(court.stage).toBe('finished');
  expect(Math.max(court.score.left, court.score.right)).toBe(1);
}, 60_000);
