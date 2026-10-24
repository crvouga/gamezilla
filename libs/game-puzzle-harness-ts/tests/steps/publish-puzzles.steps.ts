import { expect } from 'bun:test';
import { arrangeContentDraft } from '@libs/game-puzzle-harness-ts/content-actions';
import {
  contentDetailsOpen,
  contentDiscoverable,
  contentDraftTitle,
  currentSavedContentDraft,
} from '@libs/game-puzzle-harness-ts/content-observations';
import {
  arrangePublishedContent,
  publishContentDraft,
  publishEarlierContent,
  publishOtherContentDraft,
  reviseContentDraft,
  withdrawContent,
} from '@libs/game-puzzle-harness-ts/content-publication-actions';
import {
  contentEditionTitles,
  contentIssue,
  contentValidationIssues,
  contentValidationStatus,
} from '@libs/game-puzzle-harness-ts/content-publication-observations';
import {
  publishThroughScreen,
  validateThroughScreen,
} from '@libs/game-puzzle-harness-ts/publication-screen-actions';
import { Given, Then, When } from './world';

Given('Alice owns a valid puzzle draft with no title', async (w) => {
  await w.run.apply(arrangeContentDraft, 'alice:phone', {
    title: '',
    valid: true,
  });
});

Given('Alice has published the puzzle {string}', async (w, title: string) => {
  await w.run.apply(arrangePublishedContent, title);
});

Given(
  'Alice has a valid working draft titled {string}',
  async (w, title: string) => {
    await w.run.apply(reviseContentDraft, title);
  }
);

Given(
  'Alice has published {string} after the earlier edition {string}',
  async (w, current: string, earlier: string) => {
    await w.run.apply(arrangePublishedContent, earlier);
    await w.run.apply(reviseContentDraft, current);
    await w.run.apply(publishContentDraft, 'alice:phone');
  }
);

When('Alice publishes her puzzle draft', async (w) => {
  await w.run.apply(publishThroughScreen);
});

When(
  'Alice renames its working draft to {string}',
  async (w, title: string) => {
    await w.run.apply(reviseContentDraft, title);
  }
);

When(
  'Alice publishes the earlier saved draft {string} again',
  async (w, title: string) => {
    await w.run.apply(publishEarlierContent, title);
  }
);

When('Alice withdraws the puzzle {string}', async (w, title: string) => {
  await w.run.apply(withdrawContent, 'alice:phone', title);
});

When("Bob publishes Alice's puzzle draft", async (w) => {
  await w.run.apply(publishOtherContentDraft);
});

When("Bob withdraws Alice's puzzle {string}", async (w, title: string) => {
  await w.run.apply(withdrawContent, 'bob:phone', title);
});

When('Alice validates her puzzle draft', async (w) => {
  await w.run.apply(validateThroughScreen);
});

Then(
  'Bob can discover the published puzzle {string}',
  async (w, title: string) => {
    expect(
      await w.run.until((s) => contentDiscoverable(s, 'bob:phone', title), {
        pred: Boolean,
        maxMs: 5_000,
      })
    ).toBe(true);
  }
);

Then('Alice sees its published edition', async (w) => {
  expect(await w.run.read(contentEditionTitles)).not.toEqual([]);
});

Then(
  'Alice is told to correct the puzzle details before publication',
  async (w) => {
    expect(await w.run.read(contentIssue, 'alice:phone')).toBe(
      'PUZZLE_DETAILS_INVALID'
    );
  }
);

Then('Alice is told to name the puzzle before publication', async (w) => {
  expect(await w.run.read(contentIssue, 'alice:phone')).toBe(
    'PUZZLE_TITLE_REQUIRED'
  );
});

Then('Alice can resume editing her puzzle details', async (w) => {
  expect(await w.run.read(contentDetailsOpen, 'alice:phone')).toBe(true);
});

Then("Alice's working draft is titled {string}", async (w, title: string) => {
  expect(await w.run.read(contentDraftTitle, 'alice:phone')).toBe(title);
});

Then(
  'Alice can still inspect the earlier edition {string}',
  async (w, title: string) => {
    expect(await w.run.read(contentEditionTitles)).toContain(title);
  }
);

Then(
  'Alice sees one published edition of {string}',
  async (w, title: string) => {
    expect(await w.run.read(contentEditionTitles)).toEqual([title]);
  }
);

Then('Alice can still edit its working draft', async (w) => {
  expect(
    await w.run.read(currentSavedContentDraft, 'alice:phone')
  ).not.toBeNull();
});

Then('Alice is told the puzzle is ready for publication', async (w) => {
  expect(await w.run.read(contentValidationStatus)).toBe('valid');
});

Then('Alice is told which puzzle details need correction', async (w) => {
  expect(await w.run.read(contentValidationIssues)).toBe(true);
});

Then("Alice's incomplete draft is kept", async (w) => {
  expect(
    await w.run.read(currentSavedContentDraft, 'alice:phone')
  ).not.toBeNull();
});
