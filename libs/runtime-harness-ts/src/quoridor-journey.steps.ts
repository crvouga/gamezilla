import {
  QUORIDOR_HILL_PLAYABLE,
  QUORIDOR_PLAYABLE,
} from '@libs/quoridor-harness-ts/quoridor-playable';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import { observeGameJourney, playGameJourney } from './game-journey';
import {
  observeGameSessionPartyJourney,
  type PublicGameSession,
  playGameSessionPartyJourney,
} from './game-session-party-journey';
import type { JourneyWorld } from './journey-types';

const { When, Then } = stepsFor<
  JourneyWorld & { readonly memo: Map<string, unknown> }
>();

When('Alice and Bob play Classic Quoridor from fresh devices', async (w) => {
  w.memo.set(
    'quoridor-first',
    await playGameJourney(w.journey, QUORIDOR_PLAYABLE)
  );
});
Then(
  'Alice and Bob see the same completed Classic Quoridor game',
  async (w) => {
    const first = w.memo.get('quoridor-first');
    if (typeof first !== 'boolean')
      throw new Error('Classic Quoridor did not start');
    await observeGameJourney(w.journey, QUORIDOR_PLAYABLE, first);
  }
);
When(
  'Alice and Bob play Four-Player King of the Hill with two bots from fresh devices',
  async (w) => {
    w.memo.set(
      'quoridor-hill-finished',
      await playGameSessionPartyJourney(w.journey, QUORIDOR_HILL_PLAYABLE)
    );
  }
);
Then(
  'Alice and Bob see the same completed Four-Player King of the Hill game',
  async (w) => {
    const finished = w.memo.get('quoridor-hill-finished') as
      | PublicGameSession
      | undefined;
    if (finished === undefined)
      throw new Error('King of the Hill did not finish');
    await observeGameSessionPartyJourney(w.journey, finished);
  }
);
