import { Handles } from '@libs/test-ids-shared-ts/handles';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import { observeBotGameJourney } from './bot-game-journey';
import { readPublicCustomGame } from './custom-game-party-turn';
import { check, expectVisible, JOURNEY_WAIT_MS, tap } from './journey-gestures';
import type { JourneyWorld } from './journey-types';

type World = JourneyWorld & { readonly memo: Map<string, unknown> };
const { When, Then } = stepsFor<World>();

// regression: game-stage-back-minimizes-space
When(
  'Alice goes back from playing Classic Quoridor and is asked whether to resign',
  async (w) => {
    await observeBotGameJourney(w.journey, 'Classic Quoridor');
    w.memo.set('board-space', await w.journey.spaceLink());
    await w.journey.act('askToLeaveBoard', async (ui) => {
      await ui
        .get('custom-game-versus')
        .expect.hidden({ timeoutMs: JOURNEY_WAIT_MS });
      w.memo.set('board-position', (await readPublicCustomGame(ui)).position);
      await tap(ui, Handles.navBack);
      await ui
        .get('game-back-confirm')
        .expect.text('Resign game', { timeoutMs: JOURNEY_WAIT_MS });
      await expectVisible(ui, 'game-back-stay');
    });
  }
);

When('Alice decides to keep playing Classic Quoridor', (w) =>
  w.journey.act('keepPlaying', async (ui) => {
    await tap(ui, 'game-back-stay');
    await ui
      .get('game-back-confirm')
      .expect.hidden({ timeoutMs: JOURNEY_WAIT_MS });
    const game = await readPublicCustomGame(ui);
    check(
      game.status === 'active' &&
        game.position === w.memo.get('board-position'),
      'Staying must preserve the active position'
    );
  })
);

When('Alice confirms she wants to resign and go back', (w) =>
  w.journey.act('resignAndReturn', (ui) => tap(ui, 'game-back-confirm'))
);

Then('Alice sees the game choices in the same space', async (w) => {
  await w.journey.act('observePreviousGameChoices', async (ui) => {
    await expectVisible(ui, Handles.gameChoices);
    await expectVisible(ui, Handles.gameChoice('custom-game'));
    await ui.get('custom-game-content').expect.hidden();
  });
  check(
    (await w.journey.spaceLink()) === w.memo.get('board-space'),
    'Game choices opened outside the original space'
  );
});
