import { expect } from 'bun:test';
import { Given, Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import {
  askToJoinWithoutAnswer,
  joinClaimShown,
  joinUnconfirmedShown,
  lobbyShown,
} from '@libs/spaces-harness/space-join-interruption';
import { joinBeforeLosingAnswer } from '@libs/spaces-harness/space-join-lost-answer';
import { rememberedSpaceLink } from './spaces.steps';

Given(
  '{actor} has asked to join from the space link without hearing whether they joined',
  async (w, actor: Actor) => {
    await w.s.apply(askToJoinWithoutAnswer, actor, rememberedSpaceLink(w));
  }
);

Given(
  '{actor} joined before losing the connection without hearing they joined',
  async (w, actor: Actor) => {
    await w.s.apply(joinBeforeLosingAnswer, actor, rememberedSpaceLink(w));
  }
);

Then('{actor} is told the join is not confirmed', async (w, actor: Actor) => {
  const shown = await w.s.until((s) => joinUnconfirmedShown(s, actor), {
    pred: Boolean,
    maxMs: 15_000,
  });
  expect(shown).toBe(true);
});

Then('{actor} sees their lobby', async (w, actor: Actor) => {
  await w.s.until((s) => lobbyShown(s, actor), { pred: Boolean });
});

Then(
  "{actor} is not told they joined {actor}'s space",
  async (w, actor: Actor, _host: Actor) => {
    await w.s.until((s) => joinClaimShown(s, actor, rememberedSpaceLink(w)), {
      pred: (claimed) => !claimed,
    });
  }
);
