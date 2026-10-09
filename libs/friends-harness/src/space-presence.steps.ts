import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import {
  closeSpaceMembers,
  openSpaceMembers,
} from '@libs/spaces-harness/space-actions';
import { presenceShown } from '@libs/spaces-harness/space-presence-reads';
import { spaceScreenOf } from '@libs/spaces-harness/space-screen-read';
import { readSpacePresenceCount } from '@libs/spaces-harness/spaces-ui-reads';

Given("{actor} is viewing the space's presence", async (w, actor: Actor) => {
  await w.s.apply(openSpaceMembers, actor);
});

When("{actor} views the space's presence", async (w, actor: Actor) => {
  await w.s.apply(openSpaceMembers, actor);
});

When("{actor} stops viewing the space's presence", async (w, actor: Actor) => {
  await w.s.apply(closeSpaceMembers, actor);
});

Then(
  "{actor} sees {int} people/person in the space's presence",
  async (w, actor: Actor, count: number) => {
    await w.s.until((s) => readSpacePresenceCount(s, actor), {
      pred: (actual) => actual === count,
      maxMs: 20_000,
    });
  }
);

Then("{actor} no longer sees the space's presence", async (w, actor: Actor) => {
  expect(await w.s.read(presenceShown, actor)).toBe(false);
});

Then('{actor} is back in the lobby', async (w, actor: Actor) => {
  expect(await w.s.read(spaceScreenOf, actor)).toBe('lobby');
});

Then('{actor} sees they have left the space', async (w, actor: Actor) => {
  expect(await w.s.read(spaceScreenOf, actor)).toBe('left');
});
