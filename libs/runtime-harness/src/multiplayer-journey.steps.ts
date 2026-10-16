import type { Actor } from '@libs/harness/parameter-types';
import { stepsFor } from '@pkgs/gherkin-shared/registry';
import type { JourneyHost, JourneyWorld } from './journey-types';
import {
  establishMultiplayerSearch,
  expectMultiplayerInvitation,
  expectMultiplayerLoss,
  expectMultiplayerWin,
  expectNoMultiplayerGame,
  expectSharedMultiplayerGame,
  openMultiplayerJourney,
  openWithE4AndE5,
  prepareMultiplayerPair,
  prepareUnfinishedMultiplayerGame,
  resignMultiplayerJourney,
  startMultiplayerSearch,
} from './multiplayer-journey';

const { Given, When, Then } = stepsFor<JourneyWorld>();

function device(host: JourneyHost, actor: Actor): JourneyHost['act'] {
  if (actor === 'alice') return host.act;
  if (actor === 'bob') return host.actAsGuest;
  throw new Error(`the two-person journey has no device for ${actor}`);
}

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
Given(
  '{actor} is finding a {word} multiplayer chess opponent',
  (w, actor: Actor, timeControl: string) =>
    device(w.journey, actor)(
      'establishMultiplayerSearch',
      establishMultiplayerSearch(timeControl)
    )
);
When(
  '{actor} starts finding a {word} multiplayer chess opponent',
  (w, actor: Actor, timeControl: string) =>
    device(w.journey, actor)(
      'startMultiplayerSearch',
      startMultiplayerSearch(timeControl)
    )
);
When('White and Black open with e4 and e5 in multiplayer chess', (w) =>
  openWithE4AndE5(w.journey)
);
Then(
  'Alice and Bob have the same multiplayer chess game within {int} seconds',
  (w, seconds: number) => expectSharedMultiplayerGame(w.journey, seconds * 1000)
);
When('{actor} resigns multiplayer chess', (w, actor: Actor) =>
  device(w.journey, actor)('resignMultiplayerJourney', resignMultiplayerJourney)
);
Then(
  'both people see {actor} won the multiplayer game',
  async (w, actor: Actor) => {
    await device(w.journey, actor)(
      'expectMultiplayerWin',
      expectMultiplayerWin
    );
    await device(w.journey, actor === 'alice' ? 'bob' : 'alice')(
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
    await device(w.journey, actor)(
      'openMultiplayerJourney',
      openMultiplayerJourney
    );
  }
);
Then('{actor} sees the accepted multiplayer result', (w, actor: Actor) =>
  device(w.journey, actor)('expectMultiplayerWin', expectMultiplayerWin)
);
Then('{actor} is invited to sign in', (w, actor: Actor) =>
  device(w.journey, actor)(
    'expectMultiplayerInvitation',
    expectMultiplayerInvitation
  )
);
Then('{actor} has no multiplayer chess game', (w, actor: Actor) =>
  device(w.journey, actor)('expectNoMultiplayerGame', expectNoMultiplayerGame)
);

import '@libs/harness/define';
