import {
  contentTap,
  leaveContentStage,
} from '@libs/game-puzzle-harness-ts/content-journey-device';
import {
  openJourneyAttempt,
  startJourneyAttempt,
  waitForJourneyPosition,
} from '@libs/game-puzzle-harness-ts/content-journey-playing';
import { refusePositionSave } from '@libs/game-puzzle-harness-ts/refuse-position-save';
import {
  hostSpace,
  JOURNEY_WAIT_MS,
} from '@libs/runtime-harness-ts/journey-gestures';
import type { JourneyWorld } from '@libs/runtime-harness-ts/journey-types';
import { openSokobanLibrary } from '@libs/runtime-harness-ts/sokoban-authoring-journey';
import { observeSokobanJourneyCounts } from '@libs/sokoban-harness-ts/sokoban-journey-board';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';

type World = JourneyWorld & { memo: Map<string, unknown> };

export function registerSokobanRecovery<W extends World>(
  database: (world: W) => Promise<Parameters<typeof refusePositionSave>[0]>
) {
  const { Given, When, Then } = stepsFor<W>();
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
        await observeSokobanJourneyCounts(device, 0, 0);
      });
    }
  );

  When('her device cannot save her first step to the right', async (w) => {
    const restore = await refusePositionSave(await database(w));
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

  When('Alice chooses Retry once', async (w) => {
    await w.journey.act('retrySokobanStep', async (ui) => {
      await ui.get('content-retry-position').tap({ timeoutMs });
      await waitForJourneyPosition({ ui, timeoutMs });
    });
  });

  Then('her puzzle shows one move and zero pushes', async (w) => {
    await w.journey.act('observeSavedStep', (ui) =>
      observeSokobanJourneyCounts({ ui, timeoutMs }, 1, 0)
    );
  });

  Then('reopening that attempt shows one move and zero pushes', async (w) => {
    const id = w.memo.get('attempt');
    if (typeof id !== 'string') throw new Error('Missing starter attempt');
    await w.journey.act('reopenSokobanAttempt', async (ui) => {
      const device = { ui, timeoutMs };
      await leaveContentStage(device);
      await openJourneyAttempt(device, id);
      await observeSokobanJourneyCounts(device, 1, 0);
    });
  });
}
