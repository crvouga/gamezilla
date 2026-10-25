import { expect } from 'bun:test';
import { ordinaryAttemptTitles } from '@libs/game-puzzle-harness-ts/attempt-observations';
import { arrangePublishedContent } from '@libs/game-puzzle-harness-ts/content-publication-actions';
import {
  changeGameRules,
  resumeAttemptThroughScreen,
  toldRulesChanged,
} from '@libs/game-puzzle-harness-ts/edition-rules-actions';
import { rememberedPositionRestored } from '@libs/game-puzzle-harness-ts/pack-progress-observations';
import { Given, Then, When } from './world';

Given(
  "Alice has published the puzzle {string} after the game's rules changed",
  async (w, title: string) => {
    await w.run.apply(changeGameRules);
    await w.run.apply(arrangePublishedContent, title);
  }
);

Given(
  "Alice has published the puzzle {string} before the game's rules changed",
  async (w, title: string) => {
    await w.run.apply(arrangePublishedContent, title);
    await w.run.apply(changeGameRules);
  }
);

Given(
  "the game's rules have changed since {string} was published",
  async (w, _title: string) => {
    await w.run.apply(changeGameRules);
  }
);

When("the game's rules change", async (w) => {
  await w.run.apply(changeGameRules);
});

When('Bob resumes his saved attempt at {string}', async (w, _title: string) => {
  await w.run.apply(resumeAttemptThroughScreen, 'bob:phone');
});

Then(
  'Bob is told that puzzle needs a version of the app with its rules',
  async (w) => {
    expect(await w.run.read(toldRulesChanged, 'bob:phone')).toBe(true);
  }
);

Then("Bob's saved attempt at {string} is kept", async (w, title: string) => {
  expect(await w.run.read(ordinaryAttemptTitles, 'bob:phone')).toContain(title);
  expect(await w.run.read(rememberedPositionRestored, 'bob:phone')).toBe(true);
});
