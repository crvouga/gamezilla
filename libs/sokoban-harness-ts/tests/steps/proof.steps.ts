import { expect } from 'bun:test';
import { editTitleInBuilder } from '@libs/game-puzzle-harness-ts/builder-session';
import {
  contentDeviceOffline,
  contentDeviceOnline,
} from '@libs/game-puzzle-harness-ts/offline-actions';
import { editSokobanSquare } from '@libs/sokoban-harness-ts/sokoban-building';
import {
  changeSokobanRules,
  completeSokobanPlaytest,
  ordinaryCompletions,
  playableBy,
  playtestSokobanDraft,
  privatePlaytestOpens,
  proofShown,
  publicationWaiting,
  publishedBoard,
  publishSokobanDraft,
  stopSokobanPlaytest,
  toldToPlaytest,
} from '@libs/sokoban-harness-ts/sokoban-proof';
import { Given, Then, When } from './world';

const ALICE = 'alice:phone';
type World = Parameters<Parameters<typeof Given>[1]>[0];

const complete = (w: World) => w.run.apply(completeSokobanPlaytest);
const outside = (w: World, square: string) =>
  w.run.apply(editSokobanSquare, 'outside', square);
const changeRules = (w: World) => w.run.apply(changeSokobanRules);
const offline = (w: World) => w.run.apply(contentDeviceOffline, ALICE);

Given('Alice has completed a playtest of her Sokoban draft', complete);
Given('Alice is playtesting her Sokoban draft', (w) =>
  w.run.apply(playtestSokobanDraft)
);
Given(
  'Alice has stopped a playtest of her Sokoban draft before completing it',
  (w) => w.run.apply(stopSokobanPlaytest)
);
Given(
  'Alice has completed a playtest of her Sokoban draft and since edited the board by painting {string} as outside',
  async (w, square: string) => {
    await complete(w);
    await outside(w, square);
  }
);
Given(
  'Alice has completed a playtest of her Sokoban draft, edited the board by painting {string} as outside and completed another playtest',
  async (w, square: string) => {
    await complete(w);
    await outside(w, square);
    await complete(w);
  }
);
Given(
  "Alice has completed a playtest of her Sokoban draft before Sokoban's rules changed",
  async (w) => {
    await complete(w);
    await changeRules(w);
  }
);
Given(
  "Alice has completed a playtest of her Sokoban draft before Sokoban's rules changed and another since",
  async (w) => {
    await complete(w);
    await changeRules(w);
    await complete(w);
  }
);
Given('Alice has published her playtested Sokoban draft', async (w) => {
  await complete(w);
  await w.run.apply(publishSokobanDraft);
});
Given(
  'Alice is playtesting her Sokoban draft on her offline phone',
  async (w) => {
    await offline(w);
    await w.run.apply(playtestSokobanDraft);
  }
);
Given(
  'Alice has completed a playtest of her Sokoban draft on her offline phone',
  async (w) => {
    await offline(w);
    await complete(w);
  }
);
Given(
  'Alice has chosen to publish her playtested Sokoban draft on her offline phone',
  async (w) => {
    await offline(w);
    await complete(w);
    await w.run.apply(publishSokobanDraft);
  }
);

When('Alice playtests her puzzle draft', (w) =>
  w.run.apply(playtestSokobanDraft)
);
When('Alice completes that playtest', complete);
When('Alice stops her playtest before it is complete', (w) =>
  w.run.apply(stopSokobanPlaytest)
);
When('Alice publishes her puzzle draft', (w) =>
  w.run.apply(publishSokobanDraft)
);
When('Alice edits the board by painting {string} as outside', outside);
When(
  'Alice changes only the details of her Sokoban draft, renaming it {string}',
  (w, title: string) => w.run.apply(editTitleInBuilder, ALICE, title)
);
When("Sokoban's rules change", changeRules);
When("Alice's phone is back online", (w) =>
  w.run.apply(contentDeviceOnline, ALICE)
);

const proven = (w: World, expected: boolean) =>
  w.run.until(proofShown, { pred: (shown) => shown === expected, maxMs: 5000 });

Then('Alice sees her Sokoban board is proven', async (w) => {
  expect(await proven(w, true)).toBe(true);
});
Then('Alice sees her Sokoban board is not proven', async (w) => {
  expect(await proven(w, false)).toBe(false);
});
Then('Alice can play the private draft {string}', async (w, _title: string) => {
  expect(await w.run.read(privatePlaytestOpens)).toBe(true);
});
Then(
  'Alice cannot play the private draft {string}',
  async (w, _title: string) => {
    expect(await w.run.read(privatePlaytestOpens)).toBe(false);
  }
);
Then(
  'Alice has no ordinary completion for {string}',
  async (w, _title: string) => {
    expect(await w.run.read(ordinaryCompletions, ALICE)).toBe(0);
  }
);
Then(
  'Alice is told to complete a playtest of this board before publication',
  async (w) => {
    expect(await w.run.read(toldToPlaytest)).toBe(true);
  }
);
Then('Alice is told publication waits for her connection', async (w) => {
  expect(await w.run.read(publicationWaiting)).toBe(true);
});
Then('Bob can play the Sokoban puzzle {string}', async (w, title: string) => {
  expect(
    await w.run.until((s) => playableBy(s, 'bob:phone', title), {
      pred: (board) => board !== null,
      maxMs: 5000,
    })
  ).not.toBeNull();
});
Then(
  'Bob cannot play the Sokoban puzzle {string}',
  async (w, title: string) => {
    expect(await w.run.read(playableBy, 'bob:phone', title)).toBeNull();
  }
);
Then(
  'Bob can still play the Sokoban puzzle {string} as published',
  async (w, title: string) => {
    const published = await w.run.read(publishedBoard, title);
    expect(
      await w.run.until((s) => playableBy(s, 'bob:phone', title), {
        pred: (board) => board === published,
        maxMs: 5000,
      })
    ).toBe(published);
  }
);
