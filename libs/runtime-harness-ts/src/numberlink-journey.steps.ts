import type { PublishedJourneyPack } from '@libs/game-puzzle-harness-ts/content-journey-pack';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import type { JourneyWorld } from './journey-types';
import {
  authorNumberlinkJourney,
  observeNumberlinkJourneyPack,
} from './numberlink-authoring-journey';
import {
  continueNumberlinkAcrossDevices,
  type NumberlinkContinuity,
  observeNumberlinkContinuity,
} from './numberlink-continuity-journey';
import {
  keepNumberlinkOfflineWork,
  type NumberlinkOfflineJourney,
  observeKeptOfflineNumberlink,
} from './numberlink-offline-journey';
import {
  type NumberlinkRevisionJourney,
  observeEarlierNumberlink,
  reviseNumberlinkJourney,
} from './numberlink-revision-journey';

const { When, Then } = stepsFor<
  JourneyWorld & { memo: Map<string, unknown> }
>();

When(
  'Alice authors, playtests and publishes a Numberlink pack from a fresh device',
  async (w) => {
    w.memo.set('numberlink-pack', await authorNumberlinkJourney(w.journey));
  }
);

Then("Bob discovers the Numberlink pack in Alice's chosen order", async (w) => {
  const pack = w.memo.get('numberlink-pack') as
    | PublishedJourneyPack
    | undefined;
  if (pack === undefined)
    throw new Error('Alice has not published her Numberlink pack');
  await observeNumberlinkJourneyPack(w.journey, pack);
});

When(
  'Bob plays a Numberlink pack, closes the app and continues on his other device',
  async (w) => {
    w.memo.set(
      'numberlink-continuity',
      await continueNumberlinkAcrossDevices(w.journey)
    );
  }
);

Then(
  'Bob keeps his Numberlink attempt and can continue that pack',
  async (w) => {
    const kept = w.memo.get('numberlink-continuity') as
      | NumberlinkContinuity
      | undefined;
    if (kept === undefined)
      throw new Error('The cross-device Numberlink journey has not run');
    await observeNumberlinkContinuity(w.journey, kept);
  }
);

When(
  'Alice republishes Numberlink after Bob has started her pack',
  async (w) => {
    w.memo.set('numberlink-revision', await reviseNumberlinkJourney(w.journey));
  }
);

Then(
  'Bob can resume his Numberlink attempt in the unchanged pack edition',
  async (w) => {
    const kept = w.memo.get('numberlink-revision') as
      | NumberlinkRevisionJourney
      | undefined;
    if (kept === undefined)
      throw new Error('The Numberlink revision journey has not run');
    await observeEarlierNumberlink(w.journey, kept);
  }
);

When(
  'Alice authors Numberlink and Bob plays an available Numberlink pack offline',
  async (w) => {
    w.memo.set(
      'numberlink-offline',
      await keepNumberlinkOfflineWork(w.journey)
    );
  }
);

Then(
  'both people keep their Numberlink work when the connection returns',
  async (w) => {
    const kept = w.memo.get('numberlink-offline') as
      | NumberlinkOfflineJourney
      | undefined;
    if (kept === undefined)
      throw new Error('The offline Numberlink journey has not run');
    await observeKeptOfflineNumberlink(w.journey, kept);
  }
);
