import { expect } from 'bun:test';
import {
  arrangeRefusedPackPublication,
  chooseOfflinePackPublication,
  prepareChosenRecoveryPuzzle,
  republishChosenRecoveryPuzzle,
  withdrawChosenRecoveryPuzzle,
} from '@libs/game-puzzle-harness-ts/publication-recovery-actions';
import {
  publicationRefusalVisible,
  publicationWaitingVisible,
} from '@libs/game-puzzle-harness-ts/publication-recovery-screen-observations';
import { Given, Then } from './world';

Given(
  'Alice has chosen to publish the pack {string} containing {string} on her offline phone',
  async (w, pack: string, titles: string) => {
    await w.run.apply(chooseOfflinePackPublication, { pack, titles });
  }
);

Given(
  "Alice has withdrawn the pack's puzzle {string} on her tablet",
  async (w, title: string) => {
    await w.run.apply(withdrawChosenRecoveryPuzzle, title);
  }
);

Given(
  "Alice's publication of the pack {string} containing {string} was refused after {string} was withdrawn",
  async (w, pack: string, titles: string, withdrawn: string) => {
    await w.run.apply(arrangeRefusedPackPublication, {
      pack,
      titles,
      withdrawn,
    });
  }
);

Given(
  'the chosen puzzle {string} is published again',
  async (w, title: string) => {
    await w.run.apply(republishChosenRecoveryPuzzle, title);
  }
);

Given(
  'Alice has a valid working draft of the chosen puzzle {string}',
  async (w, title: string) => {
    await w.run.apply(prepareChosenRecoveryPuzzle, title);
  }
);

Then(
  'Alice can read why the pack was not published while editing its draft',
  async (w) => {
    expect(await w.run.read(publicationRefusalVisible)).toBe(true);
  }
);

Then('Alice is told publication waits for her connection', async (w) => {
  expect(await w.run.read(publicationWaitingVisible)).toBe(true);
});
