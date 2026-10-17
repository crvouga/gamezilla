import { expect } from 'bun:test';
import {
  changeCustomGame,
  openCustomGame,
} from '@libs/chess-custom-game-harness/custom-game-actions';
import { attemptCustomGameBoundary } from '@libs/chess-custom-game-harness/custom-game-boundary';
import { readCustomGameIdentity } from '@libs/game-session-harness/custom-game-identity';
import { readCustomGameProbe } from '@libs/game-session-harness/custom-game-ui';
import type { CustomGameSide } from '@libs/game-session-shared/custom-game-state';
import { Given, Then, When } from '@libs/harness/define';
import { reopenSpaceLink } from '@libs/spaces-harness/space-actions';
import {
  customFact,
  customGame,
  customHost,
  customMembers,
  customPeople,
  customPerson,
  customScreen,
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
Given('{word} in the Custom Game is a bot', async (w, name: string) =>
  customFact(w, customHost(w), { operation: 'bot', side: customSide(name) })
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
  '{actor} claims {word} in the Custom Game',
  async (w, actor: string, name: string) => {
    if (customMembers(w).has(actor)) await customScreen(w, actor);
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
  '{actor} invites {actor} to {word} in the Custom Game',
  async (w, actor: string, invited: string, name: string) => {
    if (!customPeople(w).has(invited))
      customPeople(w).set(
        invited,
        await w.s.read(readCustomGameIdentity, invited)
      );
    await customScreen(w, actor);
    await w.s.apply(changeCustomGame, actor, {
      operation: 'invite',
      side: customSide(name),
      person: customPerson(w, invited),
    });
  }
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
Then('Neither person is ready for the Custom Game', async (w) =>
  expect((await customGame(w)).ready).toEqual([])
);
Then(
  'The/the Custom Game has {int} minutes with {int} seconds increment',
  async (w, minutes: number, increment: number) => {
    const game = await customGame(w);
    expect(game.minutes).toBe(minutes);
    expect(game.increment).toBe(increment);
  }
);
