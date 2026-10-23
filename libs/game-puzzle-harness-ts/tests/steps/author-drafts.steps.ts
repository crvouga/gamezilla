import { expect } from 'bun:test';
import {
  arrangeContentDraft,
  changeContentMetadata,
  chooseContentGame,
  copyContentEditorToTablet,
  createContentDraft,
  openContentDraft,
  renameContentDraft,
  renameOtherContentDraft,
  saveContentDraft,
} from '@libs/game-puzzle-harness-ts/content-actions';
import {
  conflictingContentCopies,
  contentDetailsOpen,
  contentDiscoverable,
  contentDraftIncomplete,
  contentDraftTitle,
  contentNotice,
  currentSavedContentDraft,
  savedContentCopyTitles,
} from '@libs/game-puzzle-harness-ts/content-observations';
import { Given, Then, When } from './world';

Given('Alice has chosen a game offering puzzle creation', async (w) => {
  await w.run.apply(chooseContentGame, 'alice:phone');
});

Given('Alice owns the puzzle draft {string}', async (w, title: string) => {
  await w.run.apply(arrangeContentDraft, 'alice:phone', {
    title,
    valid: false,
  });
});

Given('Alice owns a valid puzzle draft {string}', async (w, title: string) => {
  await w.run.apply(arrangeContentDraft, 'alice:phone', { title, valid: true });
});

Given(
  'Alice owns a puzzle draft {string} with missing required details',
  async (w, title: string) => {
    await w.run.apply(arrangeContentDraft, 'alice:phone', {
      title,
      valid: false,
    });
  }
);

Given(
  'Alice has changed its description to {string} and difficulty to {string}',
  async (w, description: string, difficulty: string) => {
    await w.run.apply(changeContentMetadata, 'alice:phone', {
      description,
      difficulty,
    });
  }
);

Given(
  "Alice's phone and tablet had the puzzle draft {string}",
  async (w, title: string) => {
    await w.run.apply(arrangeContentDraft, 'alice:phone', {
      title,
      valid: false,
    });
    await w.run.apply(copyContentEditorToTablet);
  }
);

Given(
  'Alice has saved the title {string} on her phone',
  async (w, title: string) => {
    await w.run.apply(renameContentDraft, 'alice:phone', title);
  }
);

When('Alice creates the puzzle draft {string}', async (w, title: string) => {
  await w.run.apply(createContentDraft, 'alice:phone', title);
});

When("Bob opens Alice's puzzle draft {string}", async (w, title: string) => {
  await w.run.apply(openContentDraft, 'bob:phone', title);
});

When('Alice saves the puzzle draft', async (w) => {
  await w.run.apply(saveContentDraft, 'alice:phone');
});

When('Alice renames the puzzle draft to {string}', async (w, title: string) => {
  await w.run.apply(renameContentDraft, 'alice:phone', title);
});

When(
  "Bob renames Alice's puzzle draft to {string}",
  async (w, title: string) => {
    await w.run.apply(renameOtherContentDraft, 'bob:phone', title);
  }
);

When(
  "Alice saves the title {string} from her tablet's earlier draft",
  async (w, title: string) => {
    await w.run.apply(renameContentDraft, 'alice:tablet', title);
  }
);

Then(
  'Alice has a private puzzle draft titled {string}',
  async (w, title: string) => {
    expect(await w.run.read(contentDraftTitle, 'alice:phone')).toBe(title);
    expect(await w.run.read(contentDiscoverable, 'bob:phone', title)).toBe(
      false
    );
  }
);

Then('Bob cannot discover the puzzle {string}', async (w, title: string) => {
  expect(await w.run.read(contentDiscoverable, 'bob:phone', title)).toBe(false);
});

Then('Bob is told that puzzle draft is private', async (w) => {
  expect(await w.run.read(contentNotice, 'bob:phone')).toBe('private');
});

Then('Bob cannot read the puzzle details', async (w) => {
  expect(await w.run.read(contentDetailsOpen, 'bob:phone')).toBe(false);
});

Then(
  "Alice's reopened draft describes {string} with difficulty {string}",
  async (w, description: string, difficulty: string) => {
    expect(
      await w.run.read(currentSavedContentDraft, 'alice:phone')
    ).toMatchObject({ description, difficulty });
  }
);

Then(
  'Alice can resume editing the incomplete puzzle draft {string}',
  async (w, title: string) => {
    expect(await w.run.read(contentDraftTitle, 'alice:phone')).toBe(title);
    expect(await w.run.read(contentDraftIncomplete, 'alice:phone')).toBe(true);
  }
);

Then('Bob is told only the author may change that puzzle', async (w) => {
  expect(await w.run.read(contentNotice, 'bob:phone')).toBe('not_granted');
});

Then(
  "Alice's puzzle draft is still titled {string}",
  async (w, title: string) => {
    expect(await w.run.read(contentDraftTitle, 'alice:phone')).toBe(title);
  }
);

Then(
  'Alice can choose the draft copy {string} or {string}',
  async (w, first: string, second: string) => {
    const copies = await w.run.until(
      (s) => savedContentCopyTitles(s, 'alice:phone'),
      {
        pred: (titles) => titles.includes(first) && titles.includes(second),
        maxMs: 5_000,
      }
    );
    expect(copies).toEqual(expect.arrayContaining([first, second]));
  }
);

Then('Alice is told both draft copies were kept', async (w) => {
  expect(
    await w.run.until((s) => conflictingContentCopies(s, 'alice:phone'), {
      pred: Boolean,
      maxMs: 5_000,
    })
  ).toBe(true);
});
