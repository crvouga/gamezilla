import { QUORIDOR_PLAYABLE } from '@libs/quoridor-harness-ts/quoridor-playable';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import { observeBotGameJourney, startBotGameJourney } from './bot-game-journey';
import { readPublicGameSession } from './game-session-party-turn';
import { check, expectVisible, tap } from './journey-gestures';
import type { JourneyWorld } from './journey-types';

type World = JourneyWorld & { readonly memo: Map<string, unknown> };
const { Given, When, Then } = stepsFor<World>();

function retainedCard(w: World): string {
  const id = w.memo.get('quoridor-space');
  check(typeof id === 'string' && id.length > 0, 'Missing Quoridor space');
  return Handles.spaceLobbyCard(id);
}

Given(
  'Alice is playing Classic Quoridor against a bot on a fresh device',
  (w) => startBotGameJourney(w.journey, 'Classic Quoridor')
);

// regression: space-bar-actions-hidden
When('Alice moves to e2 and sees the bot reply', async (w) => {
  await observeBotGameJourney(w.journey, 'Classic Quoridor');
  w.memo.set('quoridor-space', (await w.journey.spaceLink()).split('/')[2]);
  await w.journey.act('playQuoridorOpening', async (ui) => {
    await QUORIDOR_PLAYABLE.shared.automation.turns.perform(
      ui,
      'game-session-board',
      'e2'
    );
    await expectVisible(ui, 'game-session-review-move-2');
    const board = await readPublicGameSession(ui);
    check(
      board.status === 'active' && board.ply === 2,
      'Expected the bot reply'
    );
    w.memo.set('quoridor-position', board.position);
    w.memo.set('quoridor-turn', board.turn);
    for (const action of [
      Handles.spaceMembersButton,
      Handles.spaceSettings,
      Handles.spaceEnd,
      Handles.spaceClose,
    ]) {
      await expectVisible(ui, action);
    }
  });
});

When('Alice minimizes her space', (w) =>
  w.journey.act('minimizeSpace', (ui) => tap(ui, Handles.spaceClose))
);

Then('Alice sees her space in the lobby', (w) =>
  w.journey.act('findRetainedSpace', (ui) => expectVisible(ui, retainedCard(w)))
);

When('Alice opens that space from the lobby', (w) =>
  w.journey.act('openRetainedSpace', (ui) => tap(ui, retainedCard(w)))
);

Then('Alice sees the same board and turn in her Classic Quoridor game', (w) =>
  w.journey.act('observeResumedQuoridor', async (ui) => {
    await expectVisible(ui, 'game-session-review-move-2');
    const board = await readPublicGameSession(ui);
    check(
      board.status === 'active' &&
        board.position === w.memo.get('quoridor-position') &&
        board.turn === w.memo.get('quoridor-turn'),
      'The game did not resume at the bot reply'
    );
  })
);
