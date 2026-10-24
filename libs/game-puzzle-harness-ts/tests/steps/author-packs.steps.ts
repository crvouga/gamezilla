import { expect } from 'bun:test';
import { copyContentEditorToTablet } from '@libs/game-puzzle-harness-ts/content-actions';
import { contentDraftTitle } from '@libs/game-puzzle-harness-ts/content-observations';
import { contentIssue } from '@libs/game-puzzle-harness-ts/content-publication-observations';
import {
  arrangeNamedPack,
  arrangeOtherGamePuzzle,
  editNamedPack,
  saveNamedPackOrder,
} from '@libs/game-puzzle-harness-ts/named-pack-actions';
import {
  arrangePackPuzzle,
  createPackDraft,
  createPuzzleInPack,
} from '@libs/game-puzzle-harness-ts/pack-actions';
import {
  keptPackOrderChoices,
  packDraftDetails,
  workingPackOrder,
} from '@libs/game-puzzle-harness-ts/pack-observations';
import { Given, Then, When } from './world';

Given(
  'Alice owns the pack draft {string} containing {string}',
  async (w, title: string, titles: string) => {
    await w.run.apply(arrangeNamedPack, { title, titles });
  }
);

Given(
  '{string} is a published puzzle of that game',
  async (w, title: string) => {
    await w.run.apply(arrangePackPuzzle, title);
  }
);

Given(
  '{string} is a published puzzle of another game',
  async (w, title: string) => {
    await w.run.apply(arrangeOtherGamePuzzle, title);
  }
);

Given(
  "Alice's phone and tablet had the pack draft {string} containing {string}",
  async (w, title: string, titles: string) => {
    await w.run.apply(arrangeNamedPack, { title, titles });
    await w.run.apply(copyContentEditorToTablet);
  }
);

Given(
  'Alice has saved the pack order {string} on her phone',
  async (w, titles: string) => {
    await w.run.apply(saveNamedPackOrder, 'alice:phone', titles);
  }
);

When(
  'Alice creates the pack draft {string} describing {string}',
  async (w, title: string, description: string) => {
    await w.run.apply(createPackDraft, { title, titles: [], description });
  }
);

When('Alice adds {string} to the pack draft', async (w, title: string) => {
  await w.run.apply(editNamedPack, { kind: 'add', title });
});

When(
  'Alice moves {string} before {string} in the pack draft',
  async (w, title: string, before: string) => {
    await w.run.apply(editNamedPack, { kind: 'move', title, before });
  }
);

When('Alice removes {string} from the pack draft', async (w, title: string) => {
  await w.run.apply(editNamedPack, { kind: 'remove', title });
});

When(
  'Alice creates the puzzle draft {string} from that pack',
  async (w, title: string) => {
    await w.run.apply(createPuzzleInPack, title);
  }
);

When(
  "Alice saves the pack order {string} from her tablet's earlier draft",
  async (w, titles: string) => {
    await w.run.apply(saveNamedPackOrder, 'alice:tablet', titles);
  }
);

Then(
  'Alice has a private pack draft {string} describing {string}',
  async (w, title: string, description: string) => {
    expect(await w.run.read(packDraftDetails)).toEqual({ title, description });
  }
);

Then(
  'the pack draft contains {string} in that order',
  async (w, titles: string) => {
    expect(await w.run.read(workingPackOrder, 'alice:phone')).toBe(titles);
  }
);

Then('the pack draft contains only {string}', async (w, title: string) => {
  expect(await w.run.read(workingPackOrder, 'alice:phone')).toBe(title);
});

Then('Alice is told pack puzzles must belong to the same game', async (w) => {
  expect(await w.run.read(contentIssue, 'alice:phone')).toBe(
    'PACK_GAME_MISMATCH'
  );
});

Then('Alice is told that puzzle is already in the pack', async (w) => {
  expect(await w.run.read(contentIssue, 'alice:phone')).toBe(
    'PACK_DUPLICATE_PUZZLE'
  );
});

Then('Alice can edit the puzzle draft {string}', async (w, title: string) => {
  expect(await w.run.read(contentDraftTitle, 'alice:phone')).toBe(title);
});

Then('Alice can choose either saved pack order', async (w) => {
  expect(
    await w.run.until(keptPackOrderChoices, {
      pred: (orders) =>
        orders.includes('Harbor, River, Valley') &&
        orders.includes('Valley, River, Harbor'),
      maxMs: 5000,
    })
  ).toEqual(
    expect.arrayContaining(['Harbor, River, Valley', 'Valley, River, Harbor'])
  );
});
