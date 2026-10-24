import { savedContentCopyTitles } from '@libs/game-puzzle-harness-ts/content-observations';
import {
  arrangeKeptContentCopies,
  chooseKeptContentDraft,
} from '@libs/game-puzzle-harness-ts/draft-choice-actions';
import { Given, When } from './world';

Given(
  'Alice has kept the draft copies {string} and {string}',
  async (w, first: string, second: string) => {
    await w.run.apply(arrangeKeptContentCopies, first, second);
    await w.run.until((s) => savedContentCopyTitles(s, 'alice:phone'), {
      pred: (titles) => titles.includes(first) && titles.includes(second),
      maxMs: 5_000,
    });
  }
);

When('Alice chooses the draft copy {string}', async (w, title: string) => {
  await w.run.apply(chooseKeptContentDraft, 'alice:phone', title);
});

When("Bob chooses Alice's draft copy {string}", async (w, title: string) => {
  await w.run.apply(chooseKeptContentDraft, 'bob:phone', title);
});
