import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import {
  nameEveryoneSeesOf,
  profileIdOf,
} from '@libs/profile-harness-ts/profile-ui-reads';
import { openSpaceLink } from '@libs/spaces-harness-ts/space-actions';
import {
  closeSpaceShare,
  openSpaceShare,
  removePersonFromSpace,
} from '@libs/spaces-harness-ts/space-removal-actions';
import {
  removalShown,
  removePersonOffered,
} from '@libs/spaces-harness-ts/space-removal-reads';
import { spaceScreenOf } from '@libs/spaces-harness-ts/space-screen-read';
import { rememberedSpaceLink } from './spaces.steps';

When(
  '{actor} removes {actor} from the space',
  async (w, host: Actor, person: Actor) => {
    const id = await w.s.read(profileIdOf, person);
    if (id === null) throw new Error(`${person} has no profile`);
    if ((await w.s.read(spaceScreenOf, host)) === 'elsewhere')
      await w.s.apply(openSpaceLink, host, rememberedSpaceLink(w));
    await w.s.apply(removePersonFromSpace, host, id);
  }
);

Given(
  '{actor} has removed {actor} from the space',
  async (w, host: Actor, person: Actor) => {
    const id = await w.s.read(profileIdOf, person);
    if (id === null) throw new Error(`${person} has no profile`);
    if ((await w.s.read(spaceScreenOf, host)) === 'elsewhere')
      await w.s.apply(openSpaceLink, host, rememberedSpaceLink(w));
    await w.s.apply(removePersonFromSpace, host, id);
    await w.s.apply(closeSpaceShare, host);
  }
);

Then(
  '{actor} sees that {actor} has been removed from the space',
  async (w, host: Actor, person: Actor) => {
    const name = await w.s.read(nameEveryoneSeesOf, person);
    if (name === null) throw new Error(`${person} has no displayed name`);
    await w.s.until((s) => removalShown(s, host, name), { maxMs: 20_000 });
  }
);

Then(
  '{actor} cannot remove themselves from the space because leaving ends their space',
  async (w, host: Actor) => {
    const id = await w.s.read(profileIdOf, host);
    if (id === null) throw new Error(`${host} has no profile`);
    await w.s.apply(openSpaceShare, host);
    expect(await w.s.read(removePersonOffered, host, id)).toBe(false);
  }
);

Then(
  '{actor} cannot remove {actor} from the space because only the host can remove a person',
  async (w, actor: Actor, person: Actor) => {
    const id = await w.s.read(profileIdOf, person);
    if (id === null) throw new Error(`${person} has no profile`);
    await w.s.apply(openSpaceShare, actor);
    expect(await w.s.read(removePersonOffered, actor, id)).toBe(false);
  }
);
