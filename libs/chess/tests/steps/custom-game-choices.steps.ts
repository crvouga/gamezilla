import { expect } from 'bun:test';
import {
  changeCustomGame,
  openCustomGame,
} from '@libs/chess/harness/custom-game-actions';
import { attemptCustomGameBoundary } from '@libs/chess/harness/custom-game-boundary';
import { readCustomGameIdentity } from '@libs/chess/harness/custom-game-identity';
import { readCustomGameProbe } from '@libs/chess/harness/custom-game-ui';
import {
  type CustomGameSide,
  customGameStartable,
} from '@libs/chess/public/custom-game';
import { Given, Then, When } from '@libs/harness/spec/define';
import { reopenSpaceLink } from '@libs/spaces/harness/space-actions';
import {
  customFact,
  customGame,
  customHost,
  customPeople,
  customPerson,
  customSpace,
  customStart,
} from './custom-game-world';

export function customSide(name: string): CustomGameSide {
  if (name === 'White') return 'white';
  if (name === 'Black') return 'black';
  throw new Error(`unknown side ${name}`);
}

Given("{actor} is in {actor}'s space", async (w, actor: string, host: string) =>
  customSpace(w, host, [actor])
);
Given(
  "{actor} and {actor} are in {actor}'s space",
  async (w, first: string, second: string, host: string) =>
    customSpace(w, host, [first, second])
);
Given('{word} in the Custom Game is an open place', async (w, name: string) =>
  customFact(w, customHost(w), { operation: 'open', side: customSide(name) })
);
Given('{word} in the Custom Game is a bot', async (w, name: string) =>
  customFact(w, customHost(w), { operation: 'bot', side: customSide(name) })
);
Given('{word} in the Custom Game is closed', async (w, name: string) =>
  customFact(w, customHost(w), { operation: 'close', side: customSide(name) })
);
Given('White and Black in the Custom Game are bots', async (w) => {
  await customFact(w, customHost(w), { operation: 'bot', side: 'white' });
  await customFact(w, customHost(w), { operation: 'bot', side: 'black' });
});
Given(
  '{word} in the Custom Game is reserved for {actor}',
  async (w, name: string, actor: string) => {
    await customSpace(w, customHost(w), [actor]);
    await customFact(w, customHost(w), {
      operation: 'invite',
      side: customSide(name),
      person: customPerson(w, actor),
    });
  }
);
Given('{actor} is ready for the Custom Game', async (w, actor: string) =>
  customFact(w, actor, { operation: 'ready' })
);
Given(
  '{actor} is no longer ready for the Custom Game',
  async (w, actor: string) => customFact(w, actor, { operation: 'unready' })
);
Given('The Custom Game has started', customStart);
Given('{actor} has started the Custom Game', async (w) => customStart(w));
Given('The Custom Game has a timed choice', async (w) =>
  customFact(w, customHost(w), { operation: 'clock', minutes: 5, increment: 2 })
);
Given('Black has since been replaced by a bot', async (w) => {
  w.memo.set('custom-earlier', await customGame(w));
  await customFact(w, customHost(w), { operation: 'bot', side: 'black' });
});

When(
  '{actor} assigns a bot to {word} in the Custom Game',
  async (w, actor: string, name: string) =>
    w.s.apply(changeCustomGame, actor, {
      operation: 'bot',
      side: customSide(name),
    })
);
When(
  '{actor} takes {word} in the Custom Game',
  async (w, actor: string, name: string) =>
    w.s.apply(changeCustomGame, actor, {
      operation: 'take',
      side: customSide(name),
    })
);
When(
  '{actor} opens {word} in the Custom Game',
  async (w, actor: string, name: string) =>
    w.s.apply(changeCustomGame, actor, {
      operation: 'open',
      side: customSide(name),
    })
);
When(
  '{actor} closes {word} in the Custom Game',
  async (w, actor: string, name: string) =>
    w.s.apply(changeCustomGame, actor, {
      operation: 'close',
      side: customSide(name),
    })
);
When(
  '{actor} claims {word} in the Custom Game',
  async (w, actor: string, name: string) => {
    if ((await w.s.read(readCustomGameProbe, actor)) !== null) {
      await w.s.apply(changeCustomGame, actor, {
        operation: 'claim',
        side: customSide(name),
      });
      return;
    }
    const game = await customGame(w);
    await w.s.apply(attemptCustomGameBoundary, actor, {
      spaceId: String(w.memo.get('custom-link')).split('/space/')[1] ?? '',
      choice: {
        operation: 'claim',
        side: customSide(name),
        gameId: game.id,
        revision: game.revision,
      },
    });
  }
);
When(
  '{actor} releases {word} in the Custom Game',
  async (w, actor: string, name: string) =>
    w.s.apply(changeCustomGame, actor, {
      operation: 'release',
      side: customSide(name),
    })
);
When(
  '{actor} accepts {word} in the Custom Game',
  async (w, actor: string, name: string) =>
    w.s.apply(changeCustomGame, actor, {
      operation: 'accept',
      side: customSide(name),
    })
);
When(
  '{actor} declines {word} in the Custom Game',
  async (w, actor: string, name: string) =>
    w.s.apply(changeCustomGame, actor, {
      operation: 'decline',
      side: customSide(name),
    })
);
When(
  '{actor} revokes {word} in the Custom Game',
  async (w, actor: string, name: string) =>
    w.s.apply(changeCustomGame, actor, {
      operation: 'revoke',
      side: customSide(name),
    })
);
When(
  '{actor} invites {actor} to {word} in the Custom Game',
  async (w, actor: string, invited: string, name: string) => {
    if (!customPeople(w).has(invited))
      customPeople(w).set(
        invited,
        await w.s.read(readCustomGameIdentity, invited)
      );
    await w.s.apply(changeCustomGame, actor, {
      operation: 'invite',
      side: customSide(name),
      person: customPerson(w, invited),
    });
  }
);
When('{actor} becomes ready for the Custom Game', async (w, actor: string) =>
  w.s.apply(changeCustomGame, actor, { operation: 'ready' })
);
When(
  '{actor} withdraws readiness for the Custom Game',
  async (w, actor: string) =>
    w.s.apply(changeCustomGame, actor, { operation: 'unready' })
);
When(
  '{actor} swaps White and Black in the Custom Game',
  async (w, actor: string) =>
    w.s.apply(changeCustomGame, actor, { operation: 'swap' })
);
When(
  '{actor} chooses {int} minutes with {int} seconds increment for the Custom Game',
  async (w, actor: string, minutes: number, increment: number) =>
    w.s.apply(changeCustomGame, actor, {
      operation: 'clock',
      minutes,
      increment,
    })
);
When('{actor} chooses an untimed Custom Game', async (w, actor: string) =>
  w.s.apply(changeCustomGame, actor, { operation: 'untimed' })
);
When('{actor} cancels the Custom Game', async (w, actor: string) =>
  w.s.apply(changeCustomGame, actor, { operation: 'cancel' })
);
When('{actor} creates a rematch of the Custom Game', async (w, actor: string) =>
  w.s.apply(changeCustomGame, actor, { operation: 'rematch' })
);

Then('{word} is a bot in the Custom Game', async (w, name: string) => {
  const host = customHost(w);
  if ((await w.s.read(readCustomGameProbe, host)) === null) {
    await w.s.apply(reopenSpaceLink, host, String(w.memo.get('custom-link')));
    await w.s.apply(openCustomGame, host);
  }
  expect((await customGame(w, host))[customSide(name)].kind).toBe('bot');
});
Then('{word} is an open place in the Custom Game', async (w, name: string) =>
  expect((await customGame(w))[customSide(name)].kind).toBe('open')
);
Then('{word} is closed in the Custom Game', async (w, name: string) =>
  expect((await customGame(w))[customSide(name)].kind).toBe('closed')
);
Then(
  '{word} is {actor} in the Custom Game',
  async (w, name: string, actor: string) =>
    expect((await customGame(w))[customSide(name)]).toEqual({
      kind: 'person',
      person: customPerson(w, actor),
    })
);
Then(
  '{word} is reserved for {actor} in the Custom Game',
  async (w, name: string, actor: string) =>
    expect((await customGame(w))[customSide(name)]).toEqual({
      kind: 'invitation',
      person: customPerson(w, actor),
    })
);
Then(
  'White is {actor} and Black is {actor} in the Custom Game',
  async (w, white: string, black: string) => {
    const game = await customGame(w);
    expect(game.white).toEqual({
      kind: 'person',
      person: customPerson(w, white),
    });
    expect(game.black).toEqual({
      kind: 'person',
      person: customPerson(w, black),
    });
  }
);
Then('White and Black are bots in the active Custom Game', async (w) => {
  const game = await customGame(w);
  expect(game.status).toBe('active');
  expect(game.white.kind).toBe('bot');
  expect(game.black.kind).toBe('bot');
});
Then('{actor} is watching the Custom Game', async (w, actor: string) => {
  const probe = await w.s.read(readCustomGameProbe, actor);
  expect(probe?.mySide).toBeNull();
  expect(probe?.gates['watch']).toBe(true);
});
Then('The Custom Game is startable', async (w) =>
  expect(customGameStartable(await customGame(w))).toBe(true)
);
Then('The Custom Game cannot start', async (w) =>
  expect(customGameStartable(await customGame(w))).toBe(false)
);
Then('Neither person is ready for the Custom Game', async (w) =>
  expect((await customGame(w)).ready).toEqual([])
);
Then('{actor} is not ready for the Custom Game', async (w, actor: string) => {
  const game = await customGame(w);
  expect(
    game.ready.some((side) => game[side].person === customPerson(w, actor))
  ).toBe(false);
});
Then(
  'The Custom Game has {int} minutes with {int} seconds increment',
  async (w, minutes: number, increment: number) => {
    const game = await customGame(w);
    expect(game.minutes).toBe(minutes);
    expect(game.increment).toBe(increment);
  }
);
