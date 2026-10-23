import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { openSettings } from '@libs/harness-ts/shell-actions';
import { appearanceShown } from '@libs/runtime-harness-ts/app-settings';
import {
  chooseLightInPlace,
  localThemeChoiceUsable,
} from '@libs/runtime-harness-ts/local-preference-continuity';

Given('{actor} has opened Settings', async (w, actor: Actor) => {
  await w.s.apply(openSettings, actor);
});

When('{actor} chooses the light theme', async (w, actor: Actor) => {
  await w.s.apply(chooseLightInPlace, actor);
});

Then("{actor}'s app is light", async (w, actor: Actor) => {
  await w.s.until((s) => appearanceShown(s, actor), {
    pred: (theme) => theme === 'light',
  });
});

Then(
  '{actor} is not asked to wait for a connection',
  async (w, actor: Actor) => {
    expect(await w.s.read(localThemeChoiceUsable, actor)).toBe(true);
  }
);
