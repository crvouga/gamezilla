import { expect } from 'bun:test';
import { withdrawContent } from '@libs/game-puzzle-harness-ts/content-publication-actions';
import { contentIssue } from '@libs/game-puzzle-harness-ts/content-publication-observations';
import {
  arrangeNamedPack,
  arrangeUnpublishedPack,
  saveNamedPackOrder,
} from '@libs/game-puzzle-harness-ts/named-pack-actions';
import { publishPackDraft } from '@libs/game-puzzle-harness-ts/pack-actions';
import {
  packEditionOrders,
  publishedPackOrder,
} from '@libs/game-puzzle-harness-ts/pack-observations';
import { Given, Then, When } from './world';

Given(
  'Alice owns the pack draft {string} containing her unpublished puzzle {string}',
  async (w, title: string, puzzle: string) => {
    await w.run.apply(arrangeUnpublishedPack, title, puzzle);
  }
);

Given(
  'Alice owns the pack draft {string} containing the withdrawn puzzle {string}',
  async (w, title: string, titles: string) => {
    await w.run.apply(arrangeNamedPack, { title, titles });
    await w.run.apply(withdrawContent, 'alice:phone', titles);
  }
);

Given('Alice owns the empty pack draft {string}', async (w, title: string) => {
  await w.run.apply(arrangeNamedPack, { title, titles: '' });
});

Given(
  'Alice has published the pack {string} containing {string}',
  async (w, title: string, titles: string) => {
    await w.run.apply(arrangeNamedPack, { title, titles, published: true });
  }
);

Given(
  'Alice has a valid working pack draft containing {string}',
  async (w, titles: string) => {
    await w.run.apply(saveNamedPackOrder, 'alice:phone', titles);
  }
);

When('Alice publishes her pack draft', async (w) => {
  await w.run.apply(publishPackDraft);
});

When('Alice withdraws the pack {string}', async (w, title: string) => {
  await w.run.apply(withdrawContent, 'alice:phone', title);
});

Then(
  'Bob can discover the pack {string} with {string} in that order',
  async (w, title: string, titles: string) => {
    expect(
      await w.run.until((s) => publishedPackOrder(s, title), {
        pred: (order) => order === titles,
        maxMs: 5000,
      })
    ).toBe(titles);
  }
);

Then('Bob cannot discover the pack {string}', async (w, title: string) => {
  expect(await w.run.read(publishedPackOrder, title)).toBeNull();
});

Then("Alice is told to publish the pack's puzzles first", async (w) => {
  expect(await w.run.read(contentIssue, 'alice:phone')).toBe(
    'PACK_PUZZLE_UNPUBLISHED'
  );
});

Then('Alice is told a pack puzzle is no longer available', async (w) => {
  expect(await w.run.read(contentIssue, 'alice:phone')).toBe(
    'PACK_PUZZLE_UNAVAILABLE'
  );
});

Then('Alice is told to add a puzzle before publishing the pack', async (w) => {
  expect(await w.run.read(contentIssue, 'alice:phone')).toBe('PACK_EMPTY');
});

Then(
  "Bob's published pack still offers the puzzle edition {string}",
  async (w, title: string) => {
    expect(await w.run.read(publishedPackOrder, 'Rivers')).toBe(title);
  }
);

Then(
  "Bob's published pack contains {string} in that order",
  async (w, titles: string) => {
    expect(await w.run.read(publishedPackOrder, 'Rivers')).toBe(titles);
  }
);

Then('Alice can still inspect the earlier pack edition', async (w) => {
  expect(await w.run.read(packEditionOrders)).toEqual([
    'River, Valley',
    'Valley, River',
  ]);
});
