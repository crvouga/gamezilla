import { Handles } from '@libs/test-ids-shared-ts/handles';
import { chessBoardSquareTestId } from '@pkgs/chess-board-core-shared-ts/probe';
import type { Square } from '@pkgs/chess-board-core-shared-ts/types';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import { check, expectVisible, JOURNEY_WAIT_MS, tap } from './journey-gestures';
import type { JourneyWorld } from './journey-types';
import { expectPuzzlePlayable } from './space-gestures';

const { Given, When, Then } = stepsFor<JourneyWorld>();

Given(
  'they have opened the shared four-move mate-in-two chess puzzle',
  async (w) => {
    await w.journey.openLink('/chess/puzzle/01Xbe');
    await w.journey.act('openMateInTwo', expectPuzzlePlayable);
  }
);

function playMove(from: Square, to: Square) {
  return (w: JourneyWorld) =>
    w.journey.act(`play-${from}-${to}`, async (ui) => {
      await expectVisible(ui, 'chess-puzzle-your-move');
      for (const square of [from, to]) {
        const cell = ui.get(
          chessBoardSquareTestId(Handles.chessPuzzleBoard, square)
        );
        await cell.wait('enabled', { timeoutMs: JOURNEY_WAIT_MS });
        await cell.key('enter');
      }
    });
}

Given('they have played g6-g5 on the chess puzzle board', playMove('g6', 'g5'));
When('they play a2-g2 on the chess puzzle board', playMove('a2', 'g2'));

When(
  'they open the line after the reply and choose an earlier move',
  async (w) => {
    await w.journey.act('reviewEarlierMove', async (ui) => {
      await tap(ui, 'chess-puzzle-line-open');
      await expectVisible(ui, Handles.chessPuzzleMovePly(2));
      await tap(ui, Handles.chessPuzzleMovePly(0));
    });
  }
);

When('they close the line and return to the latest move', async (w) => {
  await w.journey.act('returnToLatestMove', async (ui) => {
    await tap(ui, 'chess-puzzle-line-close');
    await tap(ui, 'chess-puzzle-return-live');
    await ui
      .get('chess-puzzle-return-live')
      .expect.hidden({ timeoutMs: JOURNEY_WAIT_MS });
  });
});

Then('the chess puzzle result shows Solved', async (w) => {
  await w.journey.act('observeSolvedResult', async (ui) => {
    await expectVisible(ui, Handles.chessPuzzleSummary);
    await ui.get(Handles.chessPuzzleStatusLabel).expect.text('Solved', {
      exact: true,
      timeoutMs: JOURNEY_WAIT_MS,
    });
    const outcome = await ui
      .get(Handles.chessPuzzleSummary)
      .attribute('data-outcome');
    check(
      outcome === 'solved',
      `Expected solved puzzle result, saw ${outcome}`
    );
  });
});
