import { expect } from 'bun:test';
import {
  contentDeviceOffline,
  contentDeviceOnline,
} from '@libs/game-puzzle-harness-ts/offline-actions';
import {
  playedPosition,
  shownPlay,
  toldOnScreen,
} from '@libs/sokoban-harness-ts/sokoban-play';
import {
  completedStarters,
  completeStarterPuzzle,
  continueStarterPack,
  offeredStarter,
  playingStarter,
  starterEditions,
  startStarterPuzzle,
} from '@libs/sokoban-harness-ts/sokoban-starter';
import { decodeSokobanBoard } from '@libs/sokoban-shared-ts/sokoban-definition';
import { Given, Then, When } from './world';

const BOB = 'bob:phone';
type World = Parameters<Parameters<typeof Given>[1]>[0];
const ORDINAL: Readonly<Record<string, number>> = { first: 0, second: 1 };

// The harness devices never sign in: every person here plays as a guest.
Given('Bob is a guest', () => undefined);
Given("Bob's phone has no connection", (w) =>
  w.run.apply(contentDeviceOffline, BOB)
);
Given('Bob is playing the first starter puzzle', (w) =>
  w.run.apply(startStarterPuzzle, BOB, 0)
);
Given('Bob has completed the first starter puzzle', (w) =>
  w.run.apply(completeStarterPuzzle, BOB, 0)
);
Given('Bob has completed every starter puzzle', async (w) => {
  const count = (await w.run.read(starterEditions)).puzzles.length;
  for (let index = 0; index < count; index += 1)
    await w.run.apply(completeStarterPuzzle, BOB, index);
});
Given(
  'Bob has completed the first starter puzzle on his offline phone',
  async (w) => {
    await w.run.apply(contentDeviceOffline, BOB);
    await w.run.apply(completeStarterPuzzle, BOB, 0);
  }
);

When('Bob starts the first starter puzzle', (w) =>
  w.run.apply(startStarterPuzzle, BOB, 0)
);
When('Bob continues the starter pack', (w) =>
  w.run.apply(continueStarterPack, BOB)
);
When("Bob's phone is back online", (w) =>
  w.run.apply(contentDeviceOnline, BOB)
);

async function atStart(w: World, ordinal: string): Promise<void> {
  expect(await w.run.read(playingStarter, BOB)).toBe(ORDINAL[ordinal] ?? -1);
  const played = await w.run.read(playedPosition, BOB);
  const board = decodeSokobanBoard(played?.definition ?? '');
  if (!board.valid) throw new Error('The starter board is unreadable');
  expect(played?.position.worker ?? null).toEqual(board.value.worker);
  expect(await w.run.read(shownPlay, BOB)).toMatchObject({
    moves: 0,
    pushes: 0,
  });
}

Then(
  "Bob sees the {word} starter puzzle's starting position",
  (w, ordinal: string) => atStart(w, ordinal)
);
Then(
  'Bob is offered the second starter puzzle as the next puzzle',
  async (w) => {
    expect(await w.run.read(offeredStarter, BOB)).toBe(1);
  }
);
Then('Bob is not offered an unfinished puzzle', async (w) => {
  expect(await w.run.read(toldOnScreen, BOB)).toBe('no-unfinished-puzzle');
});
Then("Bob's tablet shows the first starter puzzle completed", async (w) => {
  const done = await w.run.until((s) => completedStarters(s, 'bob:tablet'), {
    pred: (set) => set.has(0),
    maxMs: 5000,
  });
  expect(done.has(0)).toBe(true);
});
