import { pressBackUntilVisible } from '@libs/harness-ts/driver-gestures';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import {
  check,
  expectVisible,
  JOURNEY_WAIT_MS,
  openGameSetupInSpace,
  tap,
} from './journey-gestures';
import type { JourneyWorld } from './journey-types';

const { When, Then } = stepsFor<JourneyWorld>();

When('they set up Quoridor with an open second seat', (w) =>
  w.journey.act('setUpQuoridor', async (ui) => {
    await openGameSetupInSpace(ui, 'quoridor', 'custom-game');
    await tap(ui, 'custom-game-create');
    await expectVisible(ui, 'custom-game-setup-seats');
  })
);

When('they choose Pong and reopen their space', async (w) => {
  const link = await w.journey.spaceLink();
  await w.journey.act('openPongSetup', async (ui) => {
    await pressBackUntilVisible(ui, Handles.gameMenu('pong'), JOURNEY_WAIT_MS);
    await openGameSetupInSpace(ui, 'pong', 'custom-game');
    await expectVisible(ui, 'custom-game-content');
  });
  await w.journey.reopen();
  await w.journey.openLink(link);
});

Then('they see the Quoridor seats and can cancel that game', (w) =>
  w.journey.act('recoverQuoridorSeats', async (ui) => {
    await ui
      .get('custom-game-mode')
      .expect.text('Quoridor', { exact: false, timeoutMs: JOURNEY_WAIT_MS });
    await expectVisible(ui, 'custom-game-white-host');
    await ui
      .get('custom-game-black-person')
      .expect.text('Open', { exact: false });
    await expectVisible(ui, 'custom-game-cancel');
    await ui.get('custom-game-play-bot').expect.hidden();
  })
);

When('they ask to cancel Quoridor', (w) =>
  w.journey.act('confirmQuoridorCancellation', async (ui) => {
    await tap(ui, 'custom-game-cancel');
    await expectVisible(ui, 'custom-game-cancel-confirm');
  })
);

When('they confirm the cancellation', (w) =>
  w.journey.act('cancelQuoridor', async (ui) => {
    await tap(ui, 'custom-game-cancel-confirm');
    await tap(ui, 'custom-game-cancel-done');
  })
);

Then('they can start Pong against a bot', (w) =>
  w.journey.act('offerPong', async (ui) => {
    await ui
      .get('custom-game-mode')
      .expect.text('Pong', { exact: false, timeoutMs: JOURNEY_WAIT_MS });
    await expectVisible(ui, 'custom-game-play-bot');
  })
);

Then('choosing the Pong bot brings them to their paddle on the court', (w) =>
  w.journey.act('playPongBot', async (ui) => {
    await tap(ui, 'custom-game-play-bot');
    await expectVisible(ui, 'custom-game-board');
    await ui
      .get('custom-game-versus')
      .expect.hidden({ timeoutMs: JOURNEY_WAIT_MS });
    const paddle = ui.get('custom-game-board-first-paddle');
    check(
      (await paddle.attribute('data-controlled')) === 'true',
      'the host cannot move the left Pong paddle'
    );
    await ui.get('custom-game-reopen').expect.hidden();
  })
);
