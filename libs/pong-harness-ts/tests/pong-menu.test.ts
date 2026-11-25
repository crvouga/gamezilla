import { expect, test } from 'bun:test';
import { readCustomGameScreen } from '@libs/game-session-harness-ts/custom-game-screen';
import {
  partition,
  restartApp,
  restoreActorConnection,
} from '@libs/harness-ts/actions';
import { establishLocalPong } from '@libs/pong-harness-ts/pong-actions';
import {
  establishPongLocalStage,
  finishLocalPong,
  startLocalPong,
} from '@libs/pong-harness-ts/pong-local-actions';
import { prepareLocalPongViewer } from '@libs/pong-harness-ts/pong-local-courts';
import { joinSharedPong } from '@libs/pong-harness-ts/pong-shared-actions';
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

// regression: pong-local-finish-after-reconnect
test('the reconnected full match with seed 6 reaches a winning score', async () => {
  await using s = await openHarness({ seed: 6 });
  await s.apply(establishPongLocalStage, {
    opponent: 'person',
    stage: 'ready',
  });
  await s.apply(prepareLocalPongViewer);
  await s.apply(joinSharedPong);
  await s.apply(restartApp, 'alice');
  await s.apply(startLocalPong);
  await s.apply(partition, 'alice');
  await s.apply(restoreActorConnection, 'alice');
  await s.apply(finishLocalPong);
  const court = await s.read(pongView);
  expect(court.stage).toBe('finished');
  expect(Math.max(court.score.left, court.score.right)).toBe(11);
}, 60_000);
