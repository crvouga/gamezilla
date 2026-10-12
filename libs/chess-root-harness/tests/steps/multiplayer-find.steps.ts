import { expect } from 'bun:test';
import {
  findChessOpponent,
  openMultiplayerChess,
} from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { multiplayerRefusalCode } from '@libs/chess-matchmaking-harness/multiplayer-commands';
import {
  awaitChessMatch,
  pairChessOpponents,
} from '@libs/chess-matchmaking-harness/multiplayer-fixtures';
import {
  multiplayerText,
  multiplayerView,
} from '@libs/chess-matchmaking-harness/multiplayer-reads';
import { multiplayerSpaceId } from '@libs/chess-matchmaking-harness/multiplayer-spaces';
import { signInWithGoogleAsAccount } from '@libs/harness/auth-actions';
import { Given, Step, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { multiplayerPeople } from './multiplayer-people';
import { command, gameCommand, refusal, searchFor } from './multiplayer-world';

export async function looking(
  w: HarnessWorld,
  actor: string,
  timeControl?: string
) {
  const matches = (
    search: { standing: string; time_control: string | null } | null
  ) =>
    search?.standing === 'waiting' &&
    (timeControl === undefined || search.time_control === timeControl);
  await w.s.until(async (s) =>
    matches((await multiplayerView(s, actor)).search)
  );
  expect(matches((await w.s.read(multiplayerView, actor)).search)).toBe(true);
}

/** Before anything happened in the scenario this builds the search; afterwards it checks it. */
export async function searchStep(
  w: HarnessWorld,
  actor: string,
  timeControl?: string
) {
  if (!w.memo.get('multiplayer:acted')) {
    await multiplayerPeople(w, [actor]);
    await searchFor(w, actor, timeControl ?? '5+0');
  } else await looking(w, actor, timeControl);
}

export function acted(w: HarnessWorld) {
  w.memo.set('multiplayer:acted', true);
}

Given(
  '{actor} has a free account and a connection',
  async (w, actor: Actor) => {
    await multiplayerPeople(w, [actor]);
  }
);
Step('{actor} is looking for a chess opponent', (w, actor: Actor) =>
  searchStep(w, actor)
);
Step(
  '{actor} is looking for a {word} chess opponent',
  (w, actor: Actor, timeControl: string) => searchStep(w, actor, timeControl)
);
Then(
  '{actor} is still looking for a {word} chess opponent',
  (w, actor: Actor, timeControl: string) => looking(w, actor, timeControl)
);
Given(
  '{actor} and {actor} are looking for {word} chess opponents',
  async (w, first: Actor, second: Actor, timeControl: string) => {
    await multiplayerPeople(w, [first, second]);
    await searchFor(w, first, timeControl);
    await w.s.advanceTime(1);
    await searchFor(w, second, timeControl);
  }
);
Given(
  '{actor} is the only person looking for a {word} chess opponent',
  async (w, actor: Actor, timeControl: string) => {
    await multiplayerPeople(w, [actor]);
    await searchFor(w, actor, timeControl);
  }
);
When('{actor} finds a chess opponent', async (w, actor: Actor) => {
  acted(w);
  if ((await w.s.read(multiplayerSpaceId, actor)) === null)
    await command(w, actor, 'findChessOpponent', {
      spaceId: 'no-space',
      timeControl: '5+0',
    });
  else await w.s.apply(findChessOpponent, actor, '5+0');
});
When(
  '{actor} finds a chess opponent for {word}',
  async (w, actor: Actor, timeControl: string) => {
    acted(w);
    await w.s.apply(findChessOpponent, actor, timeControl);
  }
);
Given(
  '{actor} has found a chess opponent for {word}',
  (w, actor: Actor, timeControl: string) =>
    w.s.apply(findChessOpponent, actor, timeControl)
);
When(
  '{actor} finds a chess opponent for {word} on another device',
  async (w, actor: Actor, timeControl: string) => {
    acted(w);
    const device = `${actor}_computer`;
    await w.s.apply(signInWithGoogleAsAccount, device, actor);
    w.memo.set(`multiplayer:other:${actor}`, device);
    await w.s.apply(findChessOpponent, device, timeControl);
  }
);
When('{actor} finds a new opponent', async (w, actor: Actor) => {
  acted(w);
  await gameCommand(w, actor, 'findNewChessOpponent');
});
/**
 * Matchmaking forms a match of the two named people. A match of two people
 * means both asked; one the scenario left without a search joins the
 * other's time control as part of that formation.
 */
When(
  'a matchmaking match is formed for {actor} and {actor}',
  async (w, first: Actor, second: Actor) => {
    acted(w);
    const control = w.memo.get(`multiplayer:searching:${first}`);
    if (!w.memo.has(`multiplayer:searching:${second}`)) {
      await multiplayerPeople(w, [second]);
      await searchFor(w, second, String(control ?? '5+0'));
    }
    await w.s.apply(awaitChessMatch, first, second);
  }
);
When('matchmaking pairs people up', async (w) => {
  acted(w);
  await w.s.apply(pairChessOpponents);
});
When('{actor} opens multiplayer chess', async (w, actor: Actor) => {
  acted(w);
  await w.s.apply(openMultiplayerChess, actor);
});
When('{actor} stops finding a chess opponent', async (w, actor: Actor) => {
  acted(w);
  const view = await w.s.read(multiplayerView, actor);
  await command(w, actor, 'stopFindingChessOpponent', {
    searchId: view.search?.search_id ?? 'no-search',
  });
});
When(
  '{actor} opens multiplayer chess on another device',
  async (w, actor: Actor) => {
    const device = `${actor}_computer`;
    await w.s.apply(signInWithGoogleAsAccount, device, actor);
    await w.s.apply(openMultiplayerChess, device);
    w.memo.set(`multiplayer:other:${actor}`, device);
    acted(w);
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
Then(
  '{actor} is told {word} is not an offered time control',
  (w, actor: Actor) => refusal(w, actor, 'CHESS_TIME_CONTROL_NOT_OFFERED')
);
Then(
  '{actor} is told she is already looking for a chess opponent',
  (w, actor: Actor) => refusal(w, actor, 'CHESS_ALREADY_LOOKING')
);
Then(
  '{actor} is told to finish her multiplayer game first',
  async (w, actor: Actor) => {
    const device = String(w.memo.get(`multiplayer:other:${actor}`) ?? actor);
    expect(await w.s.read(multiplayerRefusalCode, device)).toBe(
      'limit_reached'
    );
  }
);
Then(
  '{actor} is told to finish her Custom Game first',
  async (w, actor: Actor) => {
    expect(
      await w.s.read(multiplayerText, actor, 'multiplayer-command-denial')
    ).toContain('Finish your Custom Game first');
  }
);
