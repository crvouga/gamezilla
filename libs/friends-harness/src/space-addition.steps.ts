import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import {
  nameEveryoneSeesOf,
  profileIdOf,
} from '@libs/profile-harness/profile-ui-reads';
import { joinViaLink, openSpaceLink } from '@libs/spaces-harness/space-actions';
import {
  addPersonToSpace,
  openSpacePersonPicker,
} from '@libs/spaces-harness/space-addition-actions';
import {
  additionShown,
  addPersonOffered,
  knownPersonOffered,
} from '@libs/spaces-harness/space-addition-reads';
import {
  closeSpaceShare,
  openSpaceShare,
} from '@libs/spaces-harness/space-removal-actions';
import { rememberedSpaceLink } from './spaces.steps';

async function add(
  w: Parameters<typeof rememberedSpaceLink>[0],
  host: Actor,
  person: Actor
): Promise<void> {
  const id = await w.s.read(profileIdOf, person);
  const name = await w.s.read(nameEveryoneSeesOf, person);
  if (id === null || name === null)
    throw new Error(`${person} has no known profile`);
  await w.s.apply(openSpaceLink, host, rememberedSpaceLink(w));
  await w.s.apply(addPersonToSpace, host, id, name);
}

When('{actor} adds {actor} to the space', add);
Given(
  '{actor} has added {actor} to the space',
  async (w, host: Actor, person: Actor) => {
    await add(w, host, person);
    await w.s.apply(closeSpaceShare, host);
  }
);
Given('{actor} has joined the space from the link', async (w, actor: Actor) => {
  await w.s.apply(joinViaLink, actor, rememberedSpaceLink(w));
});
Then(
  '{actor} cannot add a person because only the host can add people',
  async (w, actor: Actor) => {
    await w.s.apply(openSpaceShare, actor);
    expect(await w.s.read(addPersonOffered, actor)).toBe(false);
  }
);
Then(
  '{actor} sees that {actor} has been added to the space',
  async (w, host: Actor, person: Actor) => {
    const name = await w.s.read(nameEveryoneSeesOf, person);
    if (name === null) throw new Error(`${person} has no known name`);
    await w.s.until((s) => additionShown(s, host, name), { maxMs: 20_000 });
  }
);
Then(
  '{actor} can add {actor} to the space without a connection',
  async (w, host: Actor, person: Actor) => {
    const id = await w.s.read(profileIdOf, person);
    const name = await w.s.read(nameEveryoneSeesOf, person);
    if (id === null || name === null)
      throw new Error(`${person} has no known profile`);
    await w.s.apply(openSpaceShare, host);
    expect(await w.s.read(addPersonOffered, host)).toBe(true);
    await w.s.apply(openSpacePersonPicker, host, name);
    expect(await w.s.read(knownPersonOffered, host, id)).toBe(true);
  }
);
