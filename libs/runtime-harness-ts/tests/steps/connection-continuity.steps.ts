import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { openSettings } from '@libs/harness-ts/shell-actions';
import { readSoundsOn } from '@libs/harness-ts/sounds-preference';
import {
  localSoundChoiceUsable,
  turnSoundsOnInPlace,
} from '@libs/runtime-harness-ts/local-preference-continuity';

Given('{actor} has opened Settings', async (w, actor: Actor) => {
  await w.s.apply(openSettings, actor);
});

When('{actor} turns sounds back on', async (w, actor: Actor) => {
  await w.s.apply(turnSoundsOnInPlace, actor);
});

Then("{actor}'s sounds are on", async (w, actor: Actor) => {
  await w.s.until((s) => readSoundsOn(s, actor), {
    pred: (on) => on,
  });
});

Then(
  '{actor} is not asked to wait for a connection',
  async (w, actor: Actor) => {
    expect(await w.s.read(localSoundChoiceUsable, actor)).toBe(true);
  }
);
