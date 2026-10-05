import { multiplayerSpaceId } from '@libs/chess-matchmaking-harness/multiplayer-spaces';
import { expect } from 'bun:test';
import {
  confirmMultiplayerCommand,
  findChessOpponent,
  openMultiplayerChess,
} from '@libs/chess-matchmaking-harness/multiplayer-actions';
import {
  givenOpponentSearch,
  pairChessOpponents,
} from '@libs/chess-matchmaking-harness/multiplayer-fixtures';
import {
  multiplayerText,
  multiplayerView,
} from '@libs/chess-matchmaking-harness/multiplayer-reads';
import { signInWithGoogleAsAccount } from '@libs/harness/auth-actions';
import { Given, Step, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';

import { multiplayerPeople } from './multiplayer-people';
import { command } from './multiplayer-world';

Given(
  '{actor} has a free account and a connection',
  async (w, actor: Actor) => {
    await multiplayerPeople(w, [actor]);
  }
);
Step('{actor} is looking for a chess opponent', async (w, actor: Actor) => {
  if (!w.memo.get('multiplayer:acted')) {
    await multiplayerPeople(w, [actor]);
    await w.s.apply(givenOpponentSearch, actor);
  } else {
    await w.s.until(
      async (s) =>
        (await multiplayerView(s, actor)).search?.standing === 'waiting'
    );
    expect((await w.s.read(multiplayerView, actor)).search?.standing).toBe(
      'waiting'
    );
  }
});
Given(
  '{actor} and {actor} are looking for chess opponents',
  async (w, first: Actor, second: Actor) => {
    await multiplayerPeople(w, [first, second]);
    for (const actor of [first, second])
      await w.s.apply(givenOpponentSearch, actor);
  }
);
When('{actor} finds a chess opponent', async (w, actor: Actor) => {
  w.memo.set('multiplayer:acted', true);
  if (await w.s.read(multiplayerSpaceId, actor) === null) await command(w, actor, 'findChessOpponent', { spaceId: 'no-space' });
  else await w.s.apply(findChessOpponent, actor);
});
When(
  'a matchmaking match is formed for {actor} and {actor}',
  async (w, _first: Actor, _second: Actor) => {
    w.memo.set('multiplayer:acted', true);
    await w.s.apply(pairChessOpponents);
  }
);
When('matchmaking pairs people up', async (w) => {
  w.memo.set('multiplayer:acted', true);
  await w.s.apply(pairChessOpponents);
});
When('{actor} opens multiplayer chess', async (w, actor: Actor) => {
  w.memo.set('multiplayer:acted', true);
  await w.s.apply(openMultiplayerChess, actor);
});
When('{actor} stops finding a chess opponent', async (w, actor: Actor) => {
  w.memo.set('multiplayer:acted', true);
  const search = (await w.s.read(multiplayerView, actor)).search;
  if (search?.standing === 'waiting')
    await w.s.apply(confirmMultiplayerCommand, actor, 'stop');
  else
    await command(w, actor, 'stopFindingChessOpponent', {
      searchId: search?.search_id ?? 'no-search',
    });
});
When(
  '{actor} opens multiplayer chess on another device',
  async (w, actor: Actor) => {
    const device = `${actor}_computer`;
    await w.s.apply(signInWithGoogleAsAccount, device, actor);
    await w.s.apply(openMultiplayerChess, device);
    w.memo.set(`multiplayer:other:${actor}`, device);
    w.memo.set('multiplayer:acted', true);
  }
);
Then(
  '{actor} and {actor} have the same multiplayer game',
  async (w, first: Actor, second: Actor) => {
    await w.s.until(
      async (s) =>
        (await multiplayerView(s, first)).game !== null &&
        (await multiplayerView(s, second)).game !== null
    );
    const a = (await w.s.read(multiplayerView, first)).game;
    const b = (await w.s.read(multiplayerView, second)).game;
    expect(a).not.toBeNull();
    expect(b).toEqual(a);
  }
);
Then('one is White and the other is Black', async (w) => {
  const game = (await w.s.read(multiplayerView, 'alice')).game!;
  expect(game.white_id).not.toBe(game.black_id);
});
Then('White has the first multiplayer turn', async (w) => {
  const game = (await w.s.read(multiplayerView, 'alice')).game!;
  expect(game.turn).toBe(game.white_id);
  expect(game.revision).toBe(0);
});
Then('{actor} is not looking for a chess opponent', async (w, actor: Actor) => {
  expect((await w.s.read(multiplayerView, actor)).search?.standing).not.toBe(
    'waiting'
  );
});
Then('{actor} is invited to sign in', async (w, actor: Actor) => {
  await w.s.apply(openMultiplayerChess, actor);
  expect(
    await w.s.read(multiplayerText, actor, 'multiplayer-access-denial')
  ).toContain('Sign in');
});
Then(
  '{actor} sees her same opponent search on that device',
  async (w, actor: Actor) => {
    const device = String(w.memo.get(`multiplayer:other:${actor}`));
    const search = (await w.s.read(multiplayerView, actor)).search;
    await w.s.until(
      async (s) =>
        (await multiplayerView(s, device)).search?.search_id ===
        search?.search_id
    );
    expect((await w.s.read(multiplayerView, device)).search).toEqual(search);
  }
);
