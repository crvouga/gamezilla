import '@libs/harness-ts/define';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import type { JourneyWorld } from './journey-types';
import { observePongVictory, playPongJourney } from './pong-journey';
import type { PongJourneyStart } from './pong-journey-court';
import {
  acceptPongRematch,
  observePongRematch,
  observePongTarget,
  offerPongRematch,
} from './pong-rematch-journey';

type PongJourneyWorld = JourneyWorld & { readonly memo: Map<string, unknown> };
const { When, Then } = stepsFor<PongJourneyWorld>();

function start(w: PongJourneyWorld): PongJourneyStart {
  const value = w.memo.get('pong-start') as PongJourneyStart | undefined;
  if (value === undefined) throw new Error('Pong has not started');
  return value;
}

When('Alice and Bob play Pong from fresh devices', async (w) => {
  w.memo.set('pong-start', await playPongJourney(w.journey));
});
Then('Alice and Bob see Alice has won Pong', (w) =>
  observePongVictory(w.journey, start(w))
);
When('{actor} offers a rematch', (w, actor: string) =>
  offerPongRematch(w.journey, actor)
);
When('{actor} accepts the rematch', (w, actor: string) =>
  acceptPongRematch(w.journey, actor)
);
Then(
  'Alice and Bob see a new Pong game with their paddles swapped and both scores at zero',
  (w) => observePongRematch(w.journey, start(w))
);
Then('Pong keeps the same target score', (w) =>
  observePongTarget(w.journey, start(w).targetScore)
);
