import { expect } from 'bun:test';
import { Given, Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { cutConnection } from '@libs/harness/platform';
import { focusActor } from '@libs/harness/shell-actions';
import { recall, remember } from '@libs/harness/spec-world';
import { createSpace } from '@libs/spaces-harness/space-actions';
import {
  joinRetryOffered,
  readSpaceLink,
  spaceHostOfflineShown,
} from '@libs/spaces-harness/spaces-ui-reads';

const OFFLINE_SPACE_LINK = 'offlineSpaceLink';

Then('{actor} can try joining again', async (w, actor: Actor) => {
  expect(await w.s.read(joinRetryOffered, actor)).toBe(true);
});

Given('{actor} is offline on a fresh device', async (w, actor: Actor) => {
  expect(await w.s.read((s) => s.actors.has(actor))).toBe(false);
  await cutConnection(w, actor);
});

Given('{actor} is hosting a space created offline', async (w, actor: Actor) => {
  await cutConnection(w, actor);
  await w.s.apply(createSpace, actor);
  const link = await w.s.read(readSpaceLink, actor);
  expect(link).not.toBeNull();
  remember(w, OFFLINE_SPACE_LINK, link);
});

Then('{actor} is in the same space', async (w, actor: Actor) => {
  expect(await w.s.read(readSpaceLink, actor)).toBe(
    recall(w, OFFLINE_SPACE_LINK) as string
  );
});

Then(
  '{actor} is told the host is offline within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((surface) => spaceHostOfflineShown(surface, actor), {
      maxMs: seconds * 1_000,
    });
  }
);
