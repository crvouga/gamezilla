import { restoreActorConnection } from '@libs/harness-ts/actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { cutConnection } from '@libs/harness-ts/platform';
import { recall, remember } from '@libs/harness-ts/spec-world';
import {
  endSpace,
  joinViaLink,
  leaveSpace,
} from '@libs/spaces-harness-ts/space-actions';
import {
  ownSpaceFixtureLink,
  ownSpaceShown,
  prepareOwnSpace,
} from '@libs/spaces-harness-ts/space-own-continuity';
import { rememberedSpaceLink } from './spaces.steps';

Given(
  '{actor} has ended the space while {actor} and {actor} were offline',
  async (w, host: Actor, a: Actor, b: Actor) => {
    await cutConnection(w, a);
    await cutConnection(w, b);
    await w.s.apply(endSpace, host);
  }
);

Given('{actor} has a space of their own', async (w, actor: Actor) => {
  await w.s.apply(prepareOwnSpace, actor, rememberedSpaceLink(w));
  const link = await w.s.read(ownSpaceFixtureLink, actor);
  remember(w, `continuityOwnSpace:${actor}`, link);
});

Then('{actor} is in their own space', async (w, actor: Actor) => {
  const link = recall(w, `continuityOwnSpace:${actor}`) as string;
  await w.s.until((s) => ownSpaceShown(s, actor, link), {
    pred: Boolean,
  });
});

Given('{actor} has left the space while offline', async (w, actor: Actor) => {
  await w.s.apply(joinViaLink, actor, rememberedSpaceLink(w));
  await cutConnection(w, actor);
  await w.s.apply(leaveSpace, actor);
});

Given(
  '{actor} has left the space while {actor} and {actor} were offline',
  async (w, person: Actor, a: Actor, b: Actor) => {
    await cutConnection(w, a);
    await cutConnection(w, b);
    await w.s.apply(leaveSpace, person);
  }
);

Given(
  '{actor} has come back online before {actor}',
  async (w, first: Actor, _other: Actor) => {
    await w.s.apply(restoreActorConnection, first);
  }
);

When('{actor} comes back online', async (w, actor: Actor) => {
  await w.s.apply(restoreActorConnection, actor);
});
