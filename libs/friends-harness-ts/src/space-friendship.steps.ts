import { expect } from 'bun:test';
import { removeFriend } from '@libs/friends-harness-ts/friends-actions';
import { friendRowVisible } from '@libs/friends-harness-ts/friends-ui-reads';
import { returnToTabs } from '@libs/harness-ts/auth-actions';
import { Given } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { backToTabs } from '@libs/harness-ts/shell-actions';

Given(
  '{actor} and {actor} are no longer friends',
  async (w, actor: Actor, other: Actor) => {
    await w.s.apply(backToTabs, actor);
    await w.s.apply(removeFriend, actor, other);
    expect(await w.s.read(friendRowVisible, actor, other)).toBe(false);
    await w.s.apply(returnToTabs, actor);
  }
);
