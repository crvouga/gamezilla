import type { PublishedJourneyPack } from '@libs/game-puzzle-harness-ts/content-journey-pack';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import type { JourneyWorld } from './journey-types';
import {
  beginSokobanAuthoring,
  observeSokobanPack,
  publishSokobanPack,
  type SokobanAuthoring,
} from './sokoban-authoring-journey';
import {
  continueSokobanOnOtherDevice,
  finishSokobanPuzzle,
  observeNextSokobanPuzzle,
  observeSokobanWhereStopped,
  playSokobanPartway,
  type SokobanContinuity,
} from './sokoban-continuity-journey';
import {
  keepSokobanWorkOffline,
  observePublicationWaiting,
  observeReconnectedSokoban,
  publishSokobanWhileOffline,
  reconnectSokobanPeople,
  type SokobanOfflineJourney,
} from './sokoban-offline-journey';

type World = JourneyWorld & { memo: Map<string, unknown> };
const { When, Then } = stepsFor<World>();

function remembered<T>(w: World, key: string): T {
  const value = w.memo.get(key) as T | undefined;
  if (value === undefined) throw new Error(`The ${key} journey has not run`);
  return value;
}

When(
  'Alice authors and playtests a Sokoban puzzle from a fresh device',
  async (w) => {
    w.memo.set('sokoban-authoring', await beginSokobanAuthoring(w.journey));
  }
);

When(
  'Alice publishes it in a new pack after another Sokoban puzzle',
  async (w) => {
    const authoring = remembered<SokobanAuthoring>(w, 'sokoban-authoring');
    w.memo.set('sokoban-pack', await publishSokobanPack(w.journey, authoring));
  }
);

Then("Bob discovers the Sokoban pack in Alice's chosen order", async (w) => {
  await observeSokobanPack(
    w.journey,
    remembered<PublishedJourneyPack>(w, 'sokoban-pack')
  );
});

When(
  'Bob plays a Sokoban puzzle of a pack partway and closes the app',
  async (w) => {
    w.memo.set('sokoban-continuity', await playSokobanPartway(w.journey));
  }
);

When('Bob continues that Sokoban puzzle on his other device', async (w) => {
  await continueSokobanOnOtherDevice(
    w.journey,
    remembered<SokobanContinuity>(w, 'sokoban-continuity')
  );
});

Then('Bob sees his Sokoban attempt exactly where he stopped', async (w) => {
  await observeSokobanWhereStopped(
    w.journey,
    remembered<SokobanContinuity>(w, 'sokoban-continuity')
  );
});

When('Bob finishes that Sokoban puzzle', async (w) => {
  await finishSokobanPuzzle(w.journey);
});

Then('Bob is offered the next puzzle of that Sokoban pack', async (w) => {
  await observeNextSokobanPuzzle(
    w.journey,
    remembered<SokobanContinuity>(w, 'sokoban-continuity')
  );
});

When(
  'Alice edits a Sokoban draft and Bob plays the Sokoban starter pack offline',
  async (w) => {
    w.memo.set('sokoban-offline', await keepSokobanWorkOffline(w.journey));
  }
);

When('Alice publishes that Sokoban draft while offline', async (w) => {
  await publishSokobanWhileOffline(w.journey);
});

Then('Alice is told publication waits for her connection', async (w) => {
  await observePublicationWaiting(w.journey);
});

When('their connection returns', async (w) => {
  await reconnectSokobanPeople(w.journey);
});

Then(
  "both people keep their Sokoban work and Bob discovers Alice's Sokoban puzzle",
  async (w) => {
    await observeReconnectedSokoban(
      w.journey,
      remembered<SokobanOfflineJourney>(w, 'sokoban-offline')
    );
  }
);
