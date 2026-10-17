import { expect } from 'bun:test';
import {
  findChessOpponent,
  openMultiplayerChess,
} from '@libs/chess-matchmaking-harness/multiplayer-actions';
import {
  command,
  gameCommand,
  searchFor,
} from '@libs/game-matchmaking-harness/matched-game-world';
import { awaitGameMatch } from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import {
  multiplayerText,
  multiplayerView,
} from '@libs/game-matchmaking-harness/multiplayer-reads';
import { multiplayerSpaceId } from '@libs/game-matchmaking-harness/multiplayer-spaces';
import { Given, Step, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { multiplayerPeople } from './multiplayer-people';

async function looking(w: HarnessWorld, actor: string, timeControl?: string) {
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
async function searchStep(
  w: HarnessWorld,
  actor: string,
  timeControl?: string
) {
  if (!w.memo.get('multiplayer:acted')) {
    await multiplayerPeople(w, [actor]);
    await searchFor(w, actor, timeControl ?? '5+0');
  } else await looking(w, actor, timeControl);
}

function acted(w: HarnessWorld) {
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
When('{actor} finds a chess opponent', async (w, actor: Actor) => {
  acted(w);
  if ((await w.s.read(multiplayerSpaceId, actor)) === null)
    await command(w, actor, 'findChessOpponent', {
      spaceId: 'no-space',
      timeControl: '5+0',
    });
  else await w.s.apply(findChessOpponent, actor, '5+0');
});
Given(
  '{actor} has found a chess opponent for {word}',
  (w, actor: Actor, timeControl: string) =>
    w.s.apply(findChessOpponent, actor, timeControl)
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
    await w.s.apply(awaitGameMatch, first, second);
  }
);
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
