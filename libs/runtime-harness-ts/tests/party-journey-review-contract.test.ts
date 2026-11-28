import '@libs/harness-ts/preload';

import { expect, test } from 'bun:test';
import { QUORIDOR_HILL_PLAYABLE } from '@libs/quoridor-harness-ts/quoridor-playable';
import {
  observeGameSessionPartyJourney,
  type PublicGameSession,
  playGameSessionPartyJourney,
} from '@libs/runtime-harness-ts/game-session-party-journey';
import type { JourneyHost } from '@libs/runtime-harness-ts/journey-types';
import { openHarness } from './open-app-harness';
import { harnessJourneyHost } from './steps/journey-harness-host';

// regression: quoridor-party-wall-stops-at-preview
// regression: party-journey-plays-reviewed-position
// Same product-harness contract as libs/harness-ts/scripts/test-spec.ts.
// Exercise the completion adapter against the existing app's real review controls.
test('the Hill party returns a real reviewed board to the live position', async () => {
  await using s = await openHarness();
  const base = harnessJourneyHost({ s });
  let reviewed = false;
  const host: JourneyHost = {
    ...base,
    act: (name, gestures) =>
      base.act(name, async (ui) => {
        if (name === 'readPartyBoard' && !reviewed) {
          const raw = await ui
            .get('game-session-public')
            .attribute('data-state');
          const view = JSON.parse(raw!) as PublicGameSession;
          if (view.ply === 16) {
            expect(view.position).toBe(
              'quoridor:1:hill:e2,b5,e8,h5,e3,c5,e7,g5,e4,d4h,e5v,c5v,f4,c6,e6,f5'
            );
            await ui.get('game-session-review-move-15').tap();
            reviewed = true;
          }
        }
        await gestures(ui);
      }),
  };
  const finished = await playGameSessionPartyJourney(
    host,
    QUORIDOR_HILL_PLAYABLE
  );
  expect(reviewed).toBe(true);
  expect(finished.status).toBe('completed');
  expect(finished.outcome).not.toBe('');
  await observeGameSessionPartyJourney(host, finished);
}, 240_000);
