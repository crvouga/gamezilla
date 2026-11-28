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
import { hostDeferringEnd } from './journey-space';
import type { JourneyWorld } from './journey-types';

const { Given, When, Then } = stepsFor<JourneyWorld>();

Given(
  'a host has set up Quoridor with an open second seat on a fresh device',
  async (w) => {
    await w.journey.open('anonymous');
    await hostDeferringEnd(w);
    await w.journey.act('setUpQuoridor', async (ui) => {
      await openGameSetupInSpace(ui, 'quoridor', 'vs-human');
      await tap(ui, 'game-session-create');
      await expectVisible(ui, 'game-session-setup-seats');
    });
  }
);

When('they choose Pong and reopen their space', async (w) => {
  const link = await w.journey.spaceLink();
  await w.journey.act('openPongSetup', async (ui) => {
    await pressBackUntilVisible(ui, Handles.gameMenu('pong'), JOURNEY_WAIT_MS);
    await openGameSetupInSpace(ui, 'pong', 'vs-human');
    await expectVisible(ui, 'game-session-content');
  });
  await w.journey.reopen();
  await w.journey.openLink(link);
});

Then('they see the Quoridor seats and can cancel that game', (w) =>
  w.journey.act('recoverQuoridorSeats', async (ui) => {
    await ui
      .get('game-session-mode')
      .expect.text('Quoridor', { exact: false, timeoutMs: JOURNEY_WAIT_MS });
    await expectVisible(ui, 'game-session-white-host');
    await ui
      .get('game-session-black-person')
      .expect.text('Open', { exact: false });
    await expectVisible(ui, 'game-session-cancel');
    await ui.get('play-bots-setup-seats').expect.hidden();
  })
);

When('they ask to cancel Quoridor', (w) =>
  w.journey.act('confirmQuoridorCancellation', async (ui) => {
    await tap(ui, 'game-session-cancel');
    await expectVisible(ui, 'game-session-cancel-confirm');
  })
);

When('they confirm the cancellation', (w) =>
  w.journey.act('cancelQuoridor', async (ui) => {
    await tap(ui, 'game-session-cancel-confirm');
    await tap(ui, 'game-session-cancel-done');
  })
);

Then('they can start Pong against a bot', (w) =>
  w.journey.act('offerPong', async (ui) => {
    await pressBackUntilVisible(
      ui,
      Handles.gameChoice('vs-bot'),
      JOURNEY_WAIT_MS
    );
    await tap(ui, Handles.gameChoice('vs-bot'));
    await expectVisible(ui, 'game-session-create');
  })
);

Then('choosing the Pong bot brings them to their paddle on the court', (w) =>
  w.journey.act('playPongBot', async (ui) => {
    await tap(ui, 'game-session-create');
    await tap(ui, 'game-session-ready');
    await tap(ui, 'game-session-start');
    await expectVisible(ui, 'game-session-board');
    await ui
      .get('game-session-versus')
      .expect.hidden({ timeoutMs: JOURNEY_WAIT_MS });
    const paddle = ui.get('game-session-board-first-paddle');
    check(
      (await paddle.attribute('data-controlled')) === 'true',
      'the host cannot move the left Pong paddle'
    );
    await ui.get('game-session-reopen').expect.hidden();
  })
);
