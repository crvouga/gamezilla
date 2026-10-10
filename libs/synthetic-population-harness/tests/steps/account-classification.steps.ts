import { expect } from 'bun:test';
import { Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import {
  accountAutomationShown,
  openSyntheticPopulationGame,
} from '@libs/synthetic-population-harness/account-classification-actions';

When('{actor} opens multiplayer chess', async (w, actor: Actor) => {
  await w.s.apply(openSyntheticPopulationGame, actor);
});
Then(
  '{actor} sees {string} identified as a Synthetic User',
  async (w, actor: Actor, name: string) => {
    // regression: synthetic-population-classification-before-profile-hydration
    await w.s.until(
      (s) => accountAutomationShown(s, actor, name.toLowerCase()),
      {
        pred: Boolean,
        maxMs: 15_000,
      }
    );
  }
);
Then(
  '{actor} sees {actor} without Synthetic User identification',
  async (w, actor: Actor, subject: Actor) => {
    expect(await w.s.read(accountAutomationShown, actor, subject)).toBe(false);
  }
);
