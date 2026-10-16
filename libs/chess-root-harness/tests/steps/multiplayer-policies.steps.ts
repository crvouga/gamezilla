import { expect } from 'bun:test';
import {
  observeMembership,
  openBilling,
  providerEvent,
  subscribeToPlus,
} from '@libs/billing-harness/billing-actions';
import { billingTier } from '@libs/billing-harness/billing-reads';
import {
  leavePuzzleToChessMenu,
  reopenPuzzleFromChessMenu,
} from '@libs/chess-puzzle-harness/chess-actions';
import {
  readActivePuzzleId,
  readPuzzleDisplayFen,
} from '@libs/chess-puzzle-harness/chess-puzzle-ui';
import {
  focusChessScreen,
  readChessToldText,
} from '@libs/chess-root-harness/chess-screen-reads';
import {
  blockPerson,
  openPersonFromSearch,
} from '@libs/friends-harness/person-actions';
import { prepareNamedFriend } from '@libs/friends-harness/setup-friend-request';
import { givenOpponentSearch } from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import { multiplayerView } from '@libs/game-matchmaking-harness/multiplayer-reads';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { focusActor } from '@libs/harness/shell-actions';
import { joinViaLink } from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import { multiplayerPeople } from './multiplayer-people';
import { givenGame } from './multiplayer-world';
import { enterPuzzles, waitSolverToMove } from './puzzle-world';

Given(
  '{actor} blocked {actor} after their multiplayer game was formed',
  async (w, actor: Actor, blocked: Actor) => {
    await givenGame(w, actor, blocked);
    await prepareNamedFriend(w.s, actor);
    await prepareNamedFriend(w.s, blocked);
    await w.s.apply(openPersonFromSearch, actor, blocked);
    await w.s.apply(blockPerson, actor, blocked);
  }
);
Then(
  '{actor} and {actor} are still looking for other chess opponents',
  async (w, a: Actor, b: Actor) => {
    for (const actor of [a, b]) {
      expect((await w.s.read(multiplayerView, actor)).search?.standing).toBe(
        'waiting'
      );
      expect((await w.s.read(multiplayerView, actor)).game).toBeNull();
    }
  }
);
Then(
  '{actor} is not told {actor} blocked him',
  async (w, actor: Actor, blocker: Actor) => {
    await w.s.apply(focusChessScreen, actor);
    const text = await w.s.read(readChessToldText, actor);
    expect(text).not.toBeNull();
    expect(text).not.toContain('block');
    expect(text).not.toContain(blocker);
  }
);
Given('{actor} is a Plus member with a connection', async (w, actor: Actor) => {
  await multiplayerPeople(w, [actor]);
  await w.s.apply(openBilling, actor);
  await w.s.apply(subscribeToPlus, actor);
  await w.s.until(async (s) => (await billingTier(s, actor)) === 'paid');
});
Given(
  '{actor} no longer has paid access while she was looking for a chess opponent',
  async (w, actor: Actor) => {
    await multiplayerPeople(w, [actor]);
    await w.s.apply(openBilling, actor);
    await w.s.apply(subscribeToPlus, actor);
    await w.s.apply(givenOpponentSearch, actor, '5+0');
    await w.s.apply(observeMembership, actor, 'period_end');
    await w.s.apply(providerEvent, actor, 'refund');
    await w.s.apply(openBilling, actor);
    await w.s.until(async (s) => (await billingTier(s, actor)) === 'free');
  }
);
Then(
  '{actor} is still looking for a chess opponent',
  async (w, actor: Actor) => {
    expect((await w.s.read(multiplayerView, actor)).search?.standing).toBe(
      'waiting'
    );
  }
);
Given(
  '{actor} and {actor} are playing a puzzle in a space',
  async (w, host: Actor, watcher: Actor) => {
    await prepareNamedFriend(w.s, host);
    await multiplayerPeople(w, [watcher]);
    await enterPuzzles(w, host);
    await waitSolverToMove(w, host);
    const puzzleId = await w.s.read(readActivePuzzleId, host);
    const puzzleFen = await w.s.read(readPuzzleDisplayFen, host);
    const link = await w.s.read(readSpaceLink, host);
    if (link === null) throw new Error('Puzzle host has no space link');
    await w.s.apply(joinViaLink, watcher, link);
    await w.s.until(
      async (s) =>
        (await readActivePuzzleId(s, watcher)) === puzzleId &&
        (await readPuzzleDisplayFen(s, watcher)) === puzzleFen
    );
    w.memo.set('multiplayer:unrelated-puzzle', [
      await w.s.read(readActivePuzzleId, watcher),
      await w.s.read(readPuzzleDisplayFen, watcher),
    ]);
  }
);
When('{actor} returns to the puzzle in the space', async (w, actor: Actor) => {
  await w.s.apply(leavePuzzleToChessMenu, actor);
  await w.s.apply(reopenPuzzleFromChessMenu, actor);
});
Then('{actor} keeps the same puzzle in the space', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  expect([
    await w.s.read(readActivePuzzleId, actor),
    await w.s.read(readPuzzleDisplayFen, actor),
  ]).toEqual(w.memo.get('multiplayer:unrelated-puzzle') as [string, string]);
});
