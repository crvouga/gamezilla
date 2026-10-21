import { expect } from 'bun:test';
import { Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { otherDevice } from '@libs/harness-ts/platform';
import { openSpaceLink } from '@libs/spaces-harness-ts/space-actions';
import { leaveOffered } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { rememberedSpaceLink } from './spaces.steps';

When(
  "{actor}'s other device opens {actor}'s space link",
  async (w, actor: Actor) => {
    await w.s.apply(openSpaceLink, otherDevice(actor), rememberedSpaceLink(w));
  }
);

Then("{actor}'s other device can leave the space", async (w, actor: Actor) => {
  expect(await w.s.read(leaveOffered, otherDevice(actor))).toBe(true);
});

Then('{actor} can leave the space', async (w, actor: Actor) => {
  expect(await w.s.read(leaveOffered, actor)).toBe(true);
});

Then('{actor} is not offered to leave the space', async (w, actor: Actor) => {
  expect(await w.s.read(leaveOffered, actor)).toBe(false);
});
