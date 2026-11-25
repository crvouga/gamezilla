import {
  contentTap,
  leaveContentStage,
} from '@libs/game-puzzle-harness-ts/content-journey-device';
import {
  openJourneyAttempt,
  startJourneyAttempt,
} from '@libs/game-puzzle-harness-ts/content-journey-playing';
import { refusePositionSave } from '@libs/game-puzzle-harness-ts/refuse-position-save';
import { actorLocalSql } from '@libs/harness-ts/identity';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import {
  hostSpace,
  JOURNEY_WAIT_MS,
} from '@libs/runtime-harness-ts/journey-gestures';
import type { JourneyWorld } from '@libs/runtime-harness-ts/journey-types';
import { openSokobanLibrary } from '@libs/runtime-harness-ts/sokoban-authoring-journey';
import { observeSokobanJourneyCounts } from '@libs/sokoban-harness-ts/sokoban-journey-board';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';

const { Given, When, Then } = stepsFor<HarnessWorld & JourneyWorld>();
const timeoutMs = JOURNEY_WAIT_MS;
const refused = 'Your previous position is still saved on this device.';

Given(
  'Alice is playing the first puzzle of the Sokoban starter pack',
  async (w) => {
    await w.journey.open('anonymous');
    await w.journey.act('startSokoban', async (ui) => {
      const device = { ui, timeoutMs };
      await hostSpace(ui);
      await openSokobanLibrary(ui);
      await contentTap(
        device,
        'content-bundled-bundled:sokoban:sokoban-starter'
      );
      await contentTap(device, 'content-pack-next');
      w.memo.set('attempt', await startJourneyAttempt(device));
      await ui.get('sokoban-board').expect.visible(device);
    });
  }
);

When('her device cannot save her first step to the right', async (w) => {
  const restore = await w.s.read(async (s) => {
    const db = actorLocalSql(s, 'alice');
    if (!db) throw new Error('Alice has no local database');
    return refusePositionSave(db);
  });
  try {
    await w.journey.act('stepRight', async (ui) => {
      await ui.get('sokoban-board').key('arrowRight');
      await ui
        .get('content-position-save-status')
        .expect.text(refused, { timeoutMs });
    });
  } finally {
    await restore();
  }
});

Then('Alice is told her previous position is still saved', async (w) => {
  await w.journey.act('observeRefusal', (ui) =>
    ui.get('content-position-save-status').expect.text(refused, { timeoutMs })
  );
});

Then('reopening that attempt shows zero moves and zero pushes', async (w) => {
  const id = w.memo.get('attempt');
  if (typeof id !== 'string') throw new Error('Missing starter attempt');
  await w.journey.act('reopenSokobanAttempt', async (ui) => {
    const device = { ui, timeoutMs };
    await leaveContentStage(device);
    await openJourneyAttempt(device, id);
    await observeSokobanJourneyCounts(device, 0, 0);
  });
});
