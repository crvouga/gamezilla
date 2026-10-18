import { expect } from 'bun:test';
import { inMatchedGame } from '@libs/game-matchmaking-harness/matched-game-world';
import { joinMultiplayerSpace } from '@libs/game-matchmaking-harness/multiplayer-board';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness/opponent-seeking';
import { readCustomGameProbe } from '@libs/game-session-harness/custom-game-ui';
import type { CustomGameSide } from '@libs/game-session-shared/custom-game-state';
import { Given, Then } from '@libs/harness/define';
import { focusActor } from '@libs/harness/shell-actions';
import {
  chosen,
  current,
  identityOf,
  inSpace,
  readySidesOf,
  seatOf,
  settingUp,
  toldOf,
} from './custom-game-set-up-world';
import { gameOf, rememberCustomGame, setupCustomGame } from './game-world';

Given('{actor} is setting up a custom game', async (w, host: string) =>
  setupCustomGame(w, settingUp(host))
);
Given(
  '{actor} is setting up a custom game with {actor} on the second side',
  async (w, host: string, second: string) =>
    setupCustomGame(w, settingUp(host, second))
);
Given('{actor} has a cancelled custom game', async (w, host: string) => {
  await setupCustomGame(w, settingUp(host));
  await chosen(w, host, { operation: 'cancel' });
  await rememberCustomGame(w);
});
// In a matched game, the person watches it from its host's space.
Given(
  "{actor} is in {actor}'s space",
  async (w, person: string, host: string) => {
    if (!inMatchedGame(w)) return inSpace(w, person);
    await w.s.apply(openFindingAnOpponent, host, gameOf(w).shared.id);
    await w.s.apply(joinMultiplayerSpace, person, host);
  }
);
Given(
  "{actor} and {actor} are in {actor}'s space",
  async (w, first: string, second: string) => {
    await inSpace(w, first);
    await inSpace(w, second);
  }
);
Given("{actor} is outside {actor}'s space", async (w, person: string) => {
  await w.s.apply(focusActor, person);
  expect(await w.s.read(readCustomGameProbe, person)).toBeNull();
});

Given(
  '{actor} has assigned a bot to the {gameSide}',
  async (w, host: string, side: CustomGameSide) =>
    chosen(w, host, { operation: 'bot', side })
);
Given('{actor} has assigned bots to both sides', async (w, host: string) => {
  await chosen(w, host, { operation: 'bot', side: 'white' });
  await chosen(w, host, { operation: 'bot', side: 'black' });
});
Given(
  '{actor} has opened the {gameSide}',
  async (w, host: string, side: CustomGameSide) =>
    chosen(w, host, { operation: 'open', side })
);
Given(
  '{actor} has closed the {gameSide}',
  async (w, host: string, side: CustomGameSide) =>
    chosen(w, host, { operation: 'close', side })
);
Given('{actor} has swapped the sides', async (w, host: string) =>
  chosen(w, host, { operation: 'swap' })
);
Given(
  '{actor} has invited {actor} to the {gameSide}',
  async (w, host: string, person: string, side: CustomGameSide) => {
    await inSpace(w, person);
    await chosen(w, host, {
      operation: 'invite',
      side,
      person: await identityOf(w, person),
    });
  }
);
Given(
  "{actor} has revoked {actor}'s invitation to the {gameSide}",
  async (w, host: string, person: string, side: CustomGameSide) => {
    await inSpace(w, person);
    await chosen(w, host, {
      operation: 'invite',
      side,
      person: await identityOf(w, person),
    });
    await chosen(w, host, { operation: 'revoke', side });
  }
);
Given(
  '{actor} has released the {gameSide}',
  async (w, person: string, side: CustomGameSide) => {
    await inSpace(w, person);
    await chosen(w, person, { operation: 'claim', side });
    await chosen(w, person, { operation: 'release', side });
  }
);
Given('{actor} is ready for the custom game', async (w, actor: string) =>
  chosen(w, actor, { operation: 'ready' })
);
Given(
  '{actor} and {actor} are ready for the custom game',
  async (w, first: string, second: string) => {
    await chosen(w, first, { operation: 'ready' });
    await chosen(w, second, { operation: 'ready' });
  }
);
Given(
  '{actor} is no longer ready for the custom game',
  async (w, actor: string) => chosen(w, actor, { operation: 'unready' })
);

Then('the {gameSide} is a bot', async (w, side: CustomGameSide) => {
  expect((await current(w))[side].kind).toBe('bot');
});
Then('the {gameSide} is open', async (w, side: CustomGameSide) => {
  expect((await current(w))[side]).toEqual({ kind: 'open', person: '' });
});
Then('the {gameSide} is closed', async (w, side: CustomGameSide) => {
  expect((await current(w))[side].kind).toBe('closed');
});
Then(
  'the {gameSide} is {actor}',
  async (w, side: CustomGameSide, person: string) => {
    expect((await current(w))[side]).toEqual(await seatOf(w, person));
  }
);
Then(
  'the {gameSide} is reserved for {actor}',
  async (w, side: CustomGameSide, person: string) => {
    expect((await current(w))[side]).toEqual({
      kind: 'invitation',
      person: await identityOf(w, person),
    });
  }
);
Then(
  'the first side is {actor} and the second side is {actor}',
  async (w, first: string, second: string) => {
    const game = await current(w);
    expect(game.white).toEqual(await seatOf(w, first));
    expect(game.black).toEqual(await seatOf(w, second));
  }
);
Then(
  'the first side is {actor} and the second side is open',
  async (w, first: string) => {
    const game = await current(w);
    expect(game.white).toEqual(await seatOf(w, first));
    expect(game.black).toEqual({ kind: 'open', person: '' });
  }
);
Then('neither person is ready for the custom game', async (w) => {
  expect((await current(w)).ready).toEqual([]);
});
Then('{actor} is not ready for the custom game', async (w, actor: string) => {
  expect(await readySidesOf(w, actor)).toEqual([]);
});

Then(
  '{actor} is told the custom game has already started',
  async (w, actor: string) => toldOf(w, actor, 'already started')
);
Then(
  '{actor} is told the custom game was cancelled',
  async (w, actor: string) => toldOf(w, actor, 'cancelled')
);
Then(
  '{actor} is told a person cannot take both sides',
  async (w, actor: string) => toldOf(w, actor, 'one side per person')
);
Then('{actor} is told that side is not open', async (w, actor: string) =>
  toldOf(w, actor, 'not an open place')
);
Then(
  '{actor} is told only that participant may release the side',
  async (w, actor: string) => toldOf(w, actor, 'not your side')
);
