import { expect } from 'bun:test';
import {
  playedPosition,
  shownPlay,
} from '@libs/sokoban-harness-ts/sokoban-play';
import {
  retryPositionSave,
  stepRightWithoutSaving,
} from '@libs/sokoban-harness-ts/sokoban-save-retry';
import { playView } from '@libs/sokoban-harness-ts/sokoban-screen';
import { Then, When } from './world';

const device = 'bob:phone';

When('Bob steps right but his device cannot save the move', (w) =>
  w.run.apply(stepRightWithoutSaving, device)
);
Then('Bob sees that his previous position is still saved', async (w) => {
  expect(
    await w.run.read(
      (s) =>
        playView(s, device).getByTestId('content-position-save-status')
          .textContent
    )
  ).toBe('Your previous position is still saved on this device.');
  expect((await w.run.read(playedPosition, device))?.position).toMatchObject({
    moves: 0,
    worker: { x: 1, y: 1 },
  });
});
When('Bob retries the move after his device can save again', (w) =>
  w.run.apply(retryPositionSave, device)
);
Then('Bob sees one saved step to the right', async (w) => {
  expect((await w.run.read(playedPosition, device))?.position).toMatchObject({
    moves: 1,
    worker: { x: 2, y: 1 },
  });
  expect(await w.run.read(shownPlay, device)).toMatchObject({
    moves: 1,
    pushes: 0,
  });
});
