import type { Actor } from '@libs/harness/parameter-types';
import { stepsFor } from '@pkgs/gherkin-shared/registry';
import { type JourneyWorld, journeyDevice } from './journey-types';
import {
  expectMultiplayerInvitation,
  expectMultiplayerLoss,
  expectMultiplayerWin,
  expectNoMultiplayerGame,
  expectSharedMultiplayerGame,
  prepareMultiplayerPair,
  prepareUnfinishedMultiplayerGame,
  resignMultiplayerJourney,
  startMultiplayerSearch,
} from './multiplayer-journey';

const { Given, When, Then } = stepsFor<JourneyWorld>();

Given('Alice and Bob have accounts on fresh devices', (w) =>
  prepareMultiplayerPair(w.journey)
);
Given(
  'Alice and Bob have accounts and an unfinished multiplayer chess game',
  (w) => prepareUnfinishedMultiplayerGame(w.journey)
);
Given('{actor} is a guest on a fresh device', (w) =>
  w.journey.open('anonymous')
);
Given('{actor} is finding a multiplayer chess opponent', (w, actor: Actor) =>
  journeyDevice(w.journey, actor)(
    'startMultiplayerSearch',
    startMultiplayerSearch
  )
);
When('{actor} starts finding a multiplayer chess opponent', (w, actor: Actor) =>
  journeyDevice(w.journey, actor)(
    'startMultiplayerSearch',
    startMultiplayerSearch
  )
);
Then(
  'Alice and Bob have the same multiplayer chess game within {int} seconds',
  (w, seconds: number) => expectSharedMultiplayerGame(w.journey, seconds * 1000)
);
When('{actor} resigns multiplayer chess', (w, actor: Actor) =>
  journeyDevice(w.journey, actor)(
    'resignMultiplayerJourney',
    resignMultiplayerJourney
  )
);
Then(
  'both people see {actor} won the multiplayer game',
  async (w, actor: Actor) => {
    await journeyDevice(w.journey, actor)(
      'expectMultiplayerWin',
      expectMultiplayerWin
    );
    await journeyDevice(w.journey, actor === 'alice' ? 'bob' : 'alice')(
      'expectMultiplayerLoss',
      expectMultiplayerLoss
    );
  }
);
Given("Alice's device went offline before Bob resigned", async (w) => {
  await w.journey.offline();
  await w.journey.actAsGuest(
    'resignMultiplayerJourney',
    resignMultiplayerJourney
  );
});
When(
  '{actor} opens multiplayer chess with a connection again',
  async (w, actor: Actor) => {
    await w.journey.online();
    await journeyDevice(w.journey, actor)('openAcceptedMultiplayerGame', (ui) =>
      ui.get('multiplayer-game').expect.visible({ timeoutMs: 20_000 })
    );
  }
);
Then('{actor} sees the accepted multiplayer result', (w, actor: Actor) =>
  journeyDevice(w.journey, actor)('expectMultiplayerWin', expectMultiplayerWin)
);
Then('{actor} is invited to sign in', (w, actor: Actor) =>
  journeyDevice(w.journey, actor)(
    'expectMultiplayerInvitation',
    expectMultiplayerInvitation
  )
);
Then('{actor} has no multiplayer chess game', (w, actor: Actor) =>
  journeyDevice(w.journey, actor)(
    'expectNoMultiplayerGame',
    expectNoMultiplayerGame
  )
);

import '@libs/harness/define';
