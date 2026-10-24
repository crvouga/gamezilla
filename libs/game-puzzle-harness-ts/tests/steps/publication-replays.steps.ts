import { expect } from 'bun:test';
import { contentNotice } from '@libs/game-puzzle-harness-ts/content-observations';
import { withdrawContent } from '@libs/game-puzzle-harness-ts/content-publication-actions';
import { saveNamedPackOrder } from '@libs/game-puzzle-harness-ts/named-pack-actions';
import { publishPackDraft } from '@libs/game-puzzle-harness-ts/pack-actions';
import { packEditionTitles } from '@libs/game-puzzle-harness-ts/pack-observations';
import {
  publishEarlierPack,
  publishOtherPackDraft,
  reviseChosenPackPuzzle,
} from '@libs/game-puzzle-harness-ts/retained-content-actions';
import { Given, Then, When } from './world';

Given(
  "the pack's puzzle {string} now has a published edition {string}",
  async (w, title: string, newTitle: string) => {
    await w.run.apply(reviseChosenPackPuzzle, title, newTitle);
  }
);

Given(
  'Alice has withdrawn the puzzle/pack {string}',
  async (w, title: string) => {
    await w.run.apply(withdrawContent, 'alice:phone', title);
  }
);

Given(
  'Alice has published a later pack edition containing {string}',
  async (w, titles: string) => {
    await w.run.apply(saveNamedPackOrder, 'alice:phone', titles);
    await w.run.apply(publishPackDraft);
  }
);

When("Bob publishes Alice's pack draft", async (w) => {
  await w.run.apply(publishOtherPackDraft);
});

When("Bob withdraws Alice's pack {string}", async (w, title: string) => {
  await w.run.apply(withdrawContent, 'bob:phone', title);
});

When(
  'Alice publishes the earlier saved pack draft containing {string} again',
  async (w, titles: string) => {
    await w.run.apply(publishEarlierPack, titles);
  }
);

Then('Bob is told only the author may change that pack', async (w) => {
  expect(await w.run.read(contentNotice, 'bob:phone')).toBe('not_granted');
});

Then(
  'Alice sees one published pack edition of {string}',
  async (w, title: string) => {
    expect(await w.run.read(packEditionTitles)).toEqual([title]);
  }
);
