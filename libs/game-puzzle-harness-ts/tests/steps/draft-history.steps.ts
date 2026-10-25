import { expect } from 'bun:test';
import {
  editDetailsInBuilder,
  editTitleInBuilder,
  movePackPuzzleUpInBuilder,
  offeredDraftEdits,
  redoDraftEditInBuilder,
  undoDraftEditInBuilder,
} from '@libs/game-puzzle-harness-ts/builder-session';
import {
  contentDiscoverable,
  contentDraftIncomplete,
  contentDraftTitle,
} from '@libs/game-puzzle-harness-ts/content-observations';
import { contentDeviceOffline } from '@libs/game-puzzle-harness-ts/offline-actions';
import { Given, Then, When } from './world';

const ALICE = 'alice:phone';
/** The counting game's details: a reachable target, or none yet. */
const VALID_DETAILS = '2';

Given(
  'Alice has edited its draft title to {string}',
  async (w, title: string) => {
    await w.run.apply(editTitleInBuilder, ALICE, title);
  }
);

Given(
  'Alice has edited its draft title to {string} and then {string}',
  async (w, first: string, second: string) => {
    await w.run.apply(editTitleInBuilder, ALICE, first);
    await w.run.apply(editTitleInBuilder, ALICE, second);
  }
);

Given('Alice has saved valid puzzle details', async (w) => {
  await w.run.apply(editDetailsInBuilder, ALICE, VALID_DETAILS);
});

Given(
  'Alice has moved {string} before {string} in the pack draft',
  async (w, title: string, _before: string) => {
    await w.run.apply(movePackPuzzleUpInBuilder, ALICE, title);
  }
);

Given('Alice has undone her last draft edit', async (w) => {
  await w.run.apply(undoDraftEditInBuilder, ALICE);
});

Given(
  'Alice has undone moving {string} before {string} in the pack draft',
  async (w, title: string, _before: string) => {
    await w.run.apply(movePackPuzzleUpInBuilder, ALICE, title);
    await w.run.apply(undoDraftEditInBuilder, ALICE);
  }
);

Given('Alice has undone saving valid puzzle details', async (w) => {
  await w.run.apply(editDetailsInBuilder, ALICE, VALID_DETAILS);
  await w.run.apply(undoDraftEditInBuilder, ALICE);
});

Given('Alice has undone the draft title {string}', async (w, title: string) => {
  await w.run.apply(editTitleInBuilder, ALICE, title);
  await w.run.apply(undoDraftEditInBuilder, ALICE);
});

Given(
  'Alice has undone the draft title {string} on her offline phone',
  async (w, title: string) => {
    await w.run.apply(contentDeviceOffline, ALICE);
    await w.run.apply(editTitleInBuilder, ALICE, title);
    await w.run.apply(undoDraftEditInBuilder, ALICE);
  }
);

Given(
  'Alice has undone the draft title edits {string} and {string}',
  async (w, first: string, second: string) => {
    await w.run.apply(editTitleInBuilder, ALICE, first);
    await w.run.apply(editTitleInBuilder, ALICE, second);
    await w.run.apply(undoDraftEditInBuilder, ALICE);
    await w.run.apply(undoDraftEditInBuilder, ALICE);
  }
);

When('Alice undoes her last draft edit', async (w) => {
  await w.run.apply(undoDraftEditInBuilder, ALICE);
});

When('Alice redoes her last draft edit', async (w) => {
  await w.run.apply(redoDraftEditInBuilder, ALICE);
});

Then('Alice is offered redo but no undo for her draft', async (w) => {
  expect(await w.run.read(offeredDraftEdits, ALICE)).toEqual({
    undo: false,
    redo: true,
  });
});

Then('Alice is offered undo and redo for her draft', async (w) => {
  expect(await w.run.read(offeredDraftEdits, ALICE)).toEqual({
    undo: true,
    redo: true,
  });
});

Then('Alice is offered undo but no redo for her draft', async (w) => {
  expect(await w.run.read(offeredDraftEdits, ALICE)).toEqual({
    undo: true,
    redo: false,
  });
});

Then('Alice is not offered undo or redo for her draft', async (w) => {
  expect(await w.run.read(offeredDraftEdits, ALICE)).toEqual({
    undo: false,
    redo: false,
  });
});

Then('Alice cannot redo the replaced draft edit', async (w) => {
  expect((await w.run.read(offeredDraftEdits, ALICE)).redo).toBe(false);
});

Then("Alice's private puzzle draft has valid details", async (w) => {
  expect(await w.run.read(contentDraftIncomplete, ALICE)).toBe(false);
  const title = await w.run.read(contentDraftTitle, ALICE);
  expect(await w.run.read(contentDiscoverable, 'bob:phone', title ?? '')).toBe(
    false
  );
});
