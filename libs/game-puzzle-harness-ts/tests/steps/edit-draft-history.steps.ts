import { expect } from 'bun:test';
import { contentDraftTitle } from '@libs/game-puzzle-harness-ts/content-observations';
import {
  editDraftTitleThroughScreen,
  movePackPuzzleThroughScreen,
  redoDraftEditThroughScreen,
  saveDraftDetailsThroughScreen,
  undoDraftEditThroughScreen,
} from '@libs/game-puzzle-harness-ts/draft-history-actions';
import {
  contentDraftHasValidDetails,
  draftEditChoices,
} from '@libs/game-puzzle-harness-ts/draft-history-observations';
import { contentDeviceOffline } from '@libs/game-puzzle-harness-ts/offline-actions';
import { Given, Then, When } from './world';

Given(
  'Alice has edited its draft title to {string}',
  async (w, title: string) => {
    await w.run.apply(editDraftTitleThroughScreen, 'alice:phone', title);
  }
);

Given(
  'Alice has edited its draft title to {string} and then {string}',
  async (w, first: string, second: string) => {
    await w.run.apply(editDraftTitleThroughScreen, 'alice:phone', first);
    await w.run.apply(editDraftTitleThroughScreen, 'alice:phone', second);
  }
);

Given('Alice has saved valid puzzle details', async (w) => {
  await w.run.apply(saveDraftDetailsThroughScreen, 'alice:phone', true);
});

Given(
  'Alice has moved {string} before {string} in the pack draft',
  async (w, title: string, before: string) => {
    await w.run.apply(
      movePackPuzzleThroughScreen,
      'alice:phone',
      title,
      before
    );
  }
);

Given('Alice has undone her last draft edit', async (w) => {
  await w.run.apply(undoDraftEditThroughScreen, 'alice:phone');
});

Given('Alice has undone the draft title {string}', async (w, title: string) => {
  await w.run.apply(editDraftTitleThroughScreen, 'alice:phone', title);
  await w.run.apply(undoDraftEditThroughScreen, 'alice:phone');
});

Given(
  'Alice has undone the draft title edits {string} and {string}',
  async (w, first: string, second: string) => {
    await w.run.apply(editDraftTitleThroughScreen, 'alice:phone', first);
    await w.run.apply(editDraftTitleThroughScreen, 'alice:phone', second);
    await w.run.apply(undoDraftEditThroughScreen, 'alice:phone');
    await w.run.apply(undoDraftEditThroughScreen, 'alice:phone');
  }
);

Given('Alice has undone saving valid puzzle details', async (w) => {
  await w.run.apply(saveDraftDetailsThroughScreen, 'alice:phone', true);
  await w.run.apply(undoDraftEditThroughScreen, 'alice:phone');
});

Given(
  'Alice has undone moving {string} before {string} in the pack draft',
  async (w, title: string, before: string) => {
    await w.run.apply(
      movePackPuzzleThroughScreen,
      'alice:phone',
      title,
      before
    );
    await w.run.apply(undoDraftEditThroughScreen, 'alice:phone');
  }
);

// The edit reaches the tablet before the phone loses its connection, so the
// tablet can only show the undone title once the phone's undo arrives.
Given(
  'Alice has undone the draft title {string} on her offline phone',
  async (w, title: string) => {
    await w.run.apply(editDraftTitleThroughScreen, 'alice:phone', title);
    await w.run.until((s) => contentDraftTitle(s, 'alice:tablet'), {
      pred: (shown) => shown === title,
      maxMs: 5000,
    });
    await w.run.apply(contentDeviceOffline, 'alice:phone');
    await w.run.apply(undoDraftEditThroughScreen, 'alice:phone');
  }
);

When('Alice undoes her last draft edit', async (w) => {
  await w.run.apply(undoDraftEditThroughScreen, 'alice:phone');
});

When('Alice redoes her last draft edit', async (w) => {
  await w.run.apply(redoDraftEditThroughScreen, 'alice:phone');
});

// The two words are the builder's choices, "undo" and "redo".
Then(
  'Alice is offered {word} but no {word} for her draft',
  async (w, offered: string, withheld: string) => {
    expect(await w.run.read(draftEditChoices, 'alice:phone')).toMatchObject({
      [offered]: true,
      [withheld]: false,
    });
  }
);

Then('Alice is offered undo and redo for her draft', async (w) => {
  expect(await w.run.read(draftEditChoices, 'alice:phone')).toEqual({
    undo: true,
    redo: true,
  });
});

Then('Alice is not offered undo or redo for her draft', async (w) => {
  expect(await w.run.read(draftEditChoices, 'alice:phone')).toEqual({
    undo: false,
    redo: false,
  });
});

Then('Alice cannot redo the replaced draft edit', async (w) => {
  expect((await w.run.read(draftEditChoices, 'alice:phone')).redo).toBe(false);
});

Then("Alice's private puzzle draft has valid details", async (w) => {
  expect(await w.run.read(contentDraftHasValidDetails, 'alice:phone')).toBe(
    true
  );
});
