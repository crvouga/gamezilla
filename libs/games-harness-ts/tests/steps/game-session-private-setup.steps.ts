/**
 * Private setups in a game session: readiness confirms one, a ready person
 * or a game under way keeps it, a rematch starts with none, a bot's is drawn
 * at the start, and a move against a bot made with no connection waits.
 */

import { expect } from 'bun:test';
import {
  arrangeGameSessionPrivateSetup,
  gameSessionPrivateSetupShown,
} from '@libs/game-session-harness-ts/game-session-private-setup';
import { readGameSessionScreen } from '@libs/game-session-harness-ts/game-session-screen';
import { restoreNetwork } from '@libs/harness-ts/actions';
import { Given, Then } from '@libs/harness-ts/define';
import { chosen, settingUp, toldOf } from './game-session-set-up-world';
import { setupGameSession, sideOf, view } from './game-world';
import { INCOMPLETE } from './private-setup-world';

const SECOND_MS = 1000;

Given(
  '{actor} is ready for a game session against a bot',
  async (w, host: string) =>
    setupGameSession(w, { ...settingUp(host, 'bot'), ready: true })
);
// The rematch's people arrange their setups afresh: nobody has one yet.
Given(
  '{actor} has asked for a rematch of her finished game session with {actor}',
  async (w, host: string, other: string) => {
    await setupGameSession(w, { host, first: host, second: other });
    await chosen(w, host, { operation: 'resign' });
    await chosen(w, host, { operation: 'rematch' });
    await w.s.apply(arrangeGameSessionPrivateSetup, host, null);
    await w.s.apply(arrangeGameSessionPrivateSetup, other, null);
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
    const shown = await w.s.read(gameSessionPrivateSetupShown, actor);
    expect(shown.arranged).toBe(String(w.memo.get('private-setup:change')));
  }
);
Then(
  'neither person has a private setup in the new game session',
  async (w) => {
    for (const person of ['alice', 'bob']) {
      const shown = await w.s.read(gameSessionPrivateSetupShown, person);
      expect(shown).toEqual({ arranged: '', own: null, status: INCOMPLETE });
    }
  }
);
Then(
  '{actor} does not see {actor} is ready until the connection comes back',
  async (w, viewer: string, person: string) => {
    const side = await sideOf(w, person);
    await w.s.advanceTime(5 * SECOND_MS);
    expect(
      (await w.s.read(readGameSessionScreen, viewer))?.current?.ready
    ).not.toContain(side);
    await w.s.apply(restoreNetwork);
    await w.s.until((s) => readGameSessionScreen(s, viewer), {
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
