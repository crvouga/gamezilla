import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { cutConnection } from '@libs/harness-ts/platform';
import { backToTabs } from '@libs/harness-ts/shell-actions';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { chooseTheme } from '@libs/runtime-harness-ts/app-settings';
import { layoutPlaceAndPreferences } from '@libs/runtime-harness-ts/device-layout';
import {
  attemptSharedChoice,
  prepareSharedChoice,
  sharedChoiceCanBePutAside,
  sharedChoiceLink,
  sharedChoiceOffered,
} from '@libs/runtime-harness-ts/shared-choice-continuity';
import {
  askToJoinWithoutAnswer,
  joinClaimShown,
} from '@libs/spaces-harness-ts/space-join-interruption';

async function previewChoice(w: HarnessWorld, actor: Actor): Promise<string> {
  await w.s.apply(chooseTheme, actor, 'dark');
  await w.s.apply(backToTabs, actor);
  w.memo.set(
    'place-preferences',
    await w.s.read(layoutPlaceAndPreferences, actor)
  );
  await w.s.apply(prepareSharedChoice, actor);
  const link = await w.s.read(sharedChoiceLink, actor);
  w.memo.set(`sharedChoice:${actor}`, link);
  return link;
}

function linkOf(w: HarnessWorld, actor: Actor): string {
  const link = w.memo.get(`sharedChoice:${actor}`);
  if (typeof link !== 'string') throw new Error('No remembered shared choice');
  return link;
}

Given(
  '{actor} has a choice open that needs a connection and has not finished',
  async (w, actor: Actor) => {
    const link = await previewChoice(w, actor);
    await w.s.apply(askToJoinWithoutAnswer, actor, link);
  }
);

When('{actor} puts aside the unfinished choice', async (w, actor: Actor) => {
  await w.s.apply(backToTabs, actor);
});

Then('{actor} can put aside the unfinished choice', async (w, actor: Actor) => {
  expect(await w.s.read(sharedChoiceCanBePutAside, actor)).toBe(true);
});

Then(
  '{actor} is not told the unfinished choice succeeded',
  async (w, actor: Actor) => {
    expect(await w.s.read(joinClaimShown, actor, linkOf(w, actor))).toBe(false);
  }
);

Given(
  '{actor} was told a choice needs a connection',
  async (w, actor: Actor) => {
    await previewChoice(w, actor);
    await cutConnection(w, actor);
    await w.s.apply(attemptSharedChoice, actor);
  }
);

Then(
  '{actor} is offered to make that choice again',
  async (w, actor: Actor) => {
    expect(await w.s.read(sharedChoiceOffered, actor)).toBe(true);
  }
);

Then('the refused choice has not happened on its own', async (w) => {
  expect(await w.s.read(joinClaimShown, 'alice', linkOf(w, 'alice'))).toBe(
    false
  );
});
