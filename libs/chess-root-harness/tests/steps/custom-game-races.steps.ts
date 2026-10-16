import { expect } from 'bun:test';
import { attemptCustomGameChoice } from '@libs/chess-custom-game-harness/custom-game-actions';
import { raceCustomGameChoices } from '@libs/chess-custom-game-harness/custom-game-race';
import { readCustomGameProbe } from '@libs/game-session-harness/custom-game-ui';
import type { CustomGame } from '@libs/game-session-shared/custom-game-state';
import { Given, Then, When } from '@libs/harness/define';
import {
  customFact,
  customGame,
  customHost,
  customPeople,
  customPerson,
} from './custom-game-world';

Given("The Custom Game choices changed before {actor}'s start", async (w) => {
  w.memo.set('custom-earlier', await customGame(w));
  await customFact(w, customHost(w), {
    operation: 'clock',
    minutes: 5,
    increment: 2,
  });
});
Given(
  "{actor}'s invitation to Black has been revoked",
  async (w, actor: string) => {
    await customFact(w, customHost(w), {
      operation: 'invite',
      side: 'black',
      person: customPerson(w, actor),
    });
    await customFact(w, customHost(w), { operation: 'revoke', side: 'black' });
  }
);
Given(
  '{actor} has released Black in the Custom Game',
  async (w, actor: string) => {
    await customFact(w, actor, { operation: 'claim', side: 'black' });
    await customFact(w, actor, { operation: 'release', side: 'black' });
  }
);

When(
  '{actor} starts the Custom Game with the earlier choices',
  async (w, actor: string) => {
    const earlier = w.memo.get('custom-earlier') as CustomGame;
    await w.s.apply(attemptCustomGameChoice, actor, {
      operation: 'start',
      gameId: earlier.id,
      revision: earlier.revision,
    });
  }
);
When(
  '{actor} opens Black using earlier Custom Game choices',
  async (w, actor: string) => {
    const earlier = w.memo.get('custom-earlier') as CustomGame;
    await w.s.apply(attemptCustomGameChoice, actor, {
      operation: 'open',
      side: 'black',
      gameId: earlier.id,
      revision: earlier.revision,
    });
  }
);
When(
  '{actor} and {actor} claim Black at the same time',
  async (w, first: string, second: string) => {
    const game = await customGame(w);
    const choice = {
      operation: 'claim',
      side: 'black',
      gameId: game.id,
      revision: game.revision,
    } as const;
    await w.s.apply(raceCustomGameChoices, {
      spaceId: String(w.memo.get('custom-link')).split('/space/')[1] ?? '',
      choices: [
        { actor: first, choice },
        { actor: second, choice },
      ],
    });
  }
);
When(
  '{actor} accepts Black while {actor} revokes its invitation',
  async (w, invited: string, creator: string) => {
    const game = await customGame(w);
    const reference = {
      side: 'black',
      gameId: game.id,
      revision: game.revision,
    } as const;
    await w.s.apply(raceCustomGameChoices, {
      spaceId: String(w.memo.get('custom-link')).split('/space/')[1] ?? '',
      choices: [
        { actor: invited, choice: { ...reference, operation: 'accept' } },
        { actor: creator, choice: { ...reference, operation: 'revoke' } },
      ],
    });
  }
);
When(
  '{actor} starts the Custom Game twice at the same time',
  async (w, actor: string) => {
    const game = await customGame(w);
    const choice = {
      operation: 'start',
      gameId: game.id,
      revision: game.revision,
    } as const;
    await w.s.apply(raceCustomGameChoices, {
      spaceId: String(w.memo.get('custom-link')).split('/space/')[1] ?? '',
      choices: [
        { actor, choice },
        { actor, choice },
      ],
    });
  }
);
Then(
  'Black is either {actor} or {actor} in the Custom Game',
  async (w, first: string, second: string) => {
    const game = await customGame(w);
    expect(game.black.kind).toBe('person');
    expect([customPerson(w, first), customPerson(w, second)]).toContain(
      game.black.person
    );
  }
);
Then(
  'Black is either {actor} or an open place in the Custom Game',
  async (w, actor: string) => {
    const game = await customGame(w);
    expect(
      (game.black.kind === 'open' && game.black.person === '') ||
        (game.black.kind === 'person' &&
          game.black.person === customPerson(w, actor))
    ).toBe(true);
  }
);
Then('Black has at most one participant', async (w) => {
  const controllers = new Set<string>();
  for (const [actor, identity] of customPeople(w))
    if ((await w.s.read(readCustomGameProbe, actor))?.mySide === 'black')
      controllers.add(identity);
  expect(controllers.size).toBeLessThanOrEqual(1);
});
Then('The Custom Game remains active with no new game', async (w) => {
  const game = await customGame(w);
  expect(game.status).toBe('active');
  expect(game.id).toBe(String(w.memo.get('custom-created-id')));
  expect(game.moves).toEqual([]);
  const started = w.memo.get('custom-started') as CustomGame | undefined;
  if (started !== undefined) expect(game.startedAt).toBe(started.startedAt);
});
