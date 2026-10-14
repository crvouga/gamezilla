import { expect } from 'bun:test';
import { Given, Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import {
  askToJoinWithoutAnswer,
  joinUnconfirmedShown,
} from '@libs/spaces-harness/space-join-interruption';
import { rememberedSpaceLink } from './spaces.steps';

Given(
  '{actor} has asked to join from the space link without hearing whether they joined',
  async (w, actor: Actor) => {
    await w.s.apply(askToJoinWithoutAnswer, actor, rememberedSpaceLink(w));
  }
);

Then('{actor} is told the join is not confirmed', async (w, actor: Actor) => {
  const shown = await w.s.until((s) => joinUnconfirmedShown(s, actor), {
    pred: Boolean,
    maxMs: 15_000,
  });
  expect(shown).toBe(true);
});
