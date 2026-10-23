/**
 * Private setups in a custom game: readiness confirms one, a ready person
 * or a game under way keeps it, a rematch starts with none, a bot's is drawn
 * at the start, and a move against a bot made with no connection waits.
 */

import { expect } from 'bun:test';
import {
  arrangeCustomGamePrivateSetup,
  customGamePrivateSetupShown,
} from '@libs/game-session-harness-ts/custom-game-private-setup';
import { readCustomGameScreen } from '@libs/game-session-harness-ts/custom-game-screen';
import { restoreNetwork } from '@libs/harness-ts/actions';
import { Given, Then } from '@libs/harness-ts/define';
import { chosen, settingUp, toldOf } from './custom-game-set-up-world';
import { setupCustomGame, sideOf, view } from './game-world';
import { INCOMPLETE } from './private-setup-world';

const SECOND_MS = 1000;

Given(
  '{actor} is ready for a custom game against a bot',
  async (w, host: string) =>
    setupCustomGame(w, { ...settingUp(host, 'bot'), ready: true })
);
// The rematch's people arrange their setups afresh: nobody has one yet.
Given(
  '{actor} has asked for a rematch of her finished custom game with {actor}',
  async (w, host: string, other: string) => {
    await setupCustomGame(w, { host, first: host, second: other });
    await chosen(w, host, { operation: 'resign' });
    await chosen(w, host, { operation: 'rematch' });
    await w.s.apply(arrangeCustomGamePrivateSetup, host, null);
    await w.s.apply(arrangeCustomGamePrivateSetup, other, null);
  }
);

Then(
  '{actor} is told his/her private setup cannot change while he/she is ready',
  async (w, actor: string) =>
    toldOf(w, actor, 'withdraw readiness to change the setup')
);
Then(
  '{actor} sees his/her change to his/her private setup',
  async (w, actor: string) => {
    const shown = await w.s.read(customGamePrivateSetupShown, actor);
    expect(shown.arranged).toBe(String(w.memo.get('private-setup:change')));
  }
);
Then('neither person has a private setup in the new custom game', async (w) => {
  for (const person of ['alice', 'bob']) {
    const shown = await w.s.read(customGamePrivateSetupShown, person);
    expect(shown).toEqual({ arranged: '', own: null, status: INCOMPLETE });
  }
});
Then(
  '{actor} does not see {actor} is ready until the connection comes back',
  async (w, viewer: string, person: string) => {
    const side = await sideOf(w, person);
    await w.s.advanceTime(5 * SECOND_MS);
    expect(
      (await w.s.read(readCustomGameScreen, viewer))?.current?.ready
    ).not.toContain(side);
    await w.s.apply(restoreNetwork);
    await w.s.until((s) => readCustomGameScreen(s, viewer), {
      pred: (screen) => screen?.current?.ready.includes(side) === true,
      maxMs: 5 * SECOND_MS,
    });
  }
);
// While she has no connection her move is not played yet: nothing shows it.
Then(
  "{actor}'s move shows no result until the connection comes back",
  async (w, actor: string) => {
    await w.s.advanceTime(5 * SECOND_MS);
    const seen = await view(w, actor);
    expect(seen.current?.moves).toEqual([]);
    expect(seen.error).toBe('');
  }
);
Then('the bot has not replied', async (w) => {
  expect((await view(w)).current?.moves).toEqual([]);
});
