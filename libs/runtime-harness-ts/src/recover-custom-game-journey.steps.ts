import { pressBackUntilVisible } from '@libs/harness-ts/driver-gestures';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import {
  expectVisible,
  JOURNEY_WAIT_MS,
  pickGameInSpace,
  tap,
} from './journey-gestures';
import type { JourneyWorld } from './journey-types';

const { When, Then } = stepsFor<JourneyWorld>();

When('they set up Quoridor with an open second seat', (w) =>
  w.journey.act('setUpQuoridor', async (ui) => {
    await pickGameInSpace(ui, 'quoridor');
    await tap(ui, Handles.gameChoice('custom-game'));
    await tap(ui, 'custom-game-create');
    await expectVisible(ui, 'custom-game-setup-seats');
  })
);

When('they choose Pong and reopen their space', async (w) => {
  const link = await w.journey.spaceLink();
  await w.journey.act('openPongSetup', async (ui) => {
    await pressBackUntilVisible(ui, Handles.gameMenu('pong'), JOURNEY_WAIT_MS);
    await pickGameInSpace(ui, 'pong');
    await tap(ui, Handles.gameChoice('custom-game'));
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

When('they choose to play the Pong bot', (w) =>
  w.journey.act('playPongBot', (ui) => tap(ui, 'custom-game-play-bot'))
);

Then('they see their paddle on the Pong court', (w) =>
  w.journey.act('showPongCourt', async (ui) => {
    try { await expectVisible(ui, 'custom-game-board-first-paddle'); } catch (error) { console.log('stage', [...((await ui.snapshotHtml()) ?? '').matchAll(/data-testid="([^"]+)"/g)].map(m=>m[1]).filter(x=>x?.includes('game')).join(' ')); throw error; }
    await expectVisible(ui, 'custom-game-board-ball');
  })
);
