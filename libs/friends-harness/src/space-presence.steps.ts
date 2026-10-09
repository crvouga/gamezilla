import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { focusActor } from '@libs/harness/shell-actions';
import {
  nameEveryoneSeesOf,
  profileIdOf,
} from '@libs/profile-harness/profile-ui-reads';
import {
  closeSpaceMembers,
  openSpaceLink,
  openSpaceMembers,
} from '@libs/spaces-harness/space-actions';
import { presenceShown } from '@libs/spaces-harness/space-presence-reads';
import { spaceScreenOf } from '@libs/spaces-harness/space-screen-read';
import {
  readSpacePresenceCount,
  spaceMemberName,
} from '@libs/spaces-harness/spaces-ui-reads';
import { rememberedSpaceLink } from './spaces.steps';

Given("{actor} is viewing the space's presence", async (w, actor: Actor) => {
  await w.s.apply(openSpaceMembers, actor);
});

When("{actor} views the space's presence", async (w, actor: Actor) => {
  if ((await w.s.read(spaceScreenOf, actor)) === 'elsewhere')
    await w.s.apply(openSpaceLink, actor, rememberedSpaceLink(w));
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

Then(
  "{actor} sees {actor} in the space's presence within {int} seconds",
  async (w, actor: Actor, person: Actor, seconds: number) => {
    const member = await w.s.read(profileIdOf, person);
    const name = await w.s.read(nameEveryoneSeesOf, person);
    if (member === null || name === null)
      throw new Error(`${person} has no profile to identify`);
    await w.s.apply(focusActor, actor);
    await w.s.until((s) => spaceMemberName(s, actor, member), {
      pred: (shown) => shown === name,
      maxMs: seconds * 1_000,
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
