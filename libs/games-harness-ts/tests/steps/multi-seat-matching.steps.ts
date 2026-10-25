import { expect } from 'bun:test';
import {
  gameCommand,
  groupBoards,
  groupMatchedGame,
  matchedGameOf,
  searchFor,
} from '@libs/game-matchmaking-harness-ts/matched-game-world';
import { multiplayerView } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import { findGameOpponent } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import {
  multiplayerOwner,
  multiplayerPeople,
  multiplayerVotes,
} from '@libs/game-matchmaking-shared-ts/multiplayer-roster';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { gameSides } from '@pkgs/turn-game-shared-ts/game-rules';
import { turnGameOf } from './game-world';
import { readyPeople, timeControlFor } from './matched-game';

const PEOPLE = ['alice', 'bob', 'carol', 'dave'] as const;

Given(
  'Alice, Bob, Carol and Dave have a new four-player matched game at 5+0',
  async (w) => {
    await groupMatchedGame(w, {
      people: readyPeople,
      participants: PEOPLE,
      timeControl: timeControlFor(w, '5+0'),
    });
    expect((await matchedGameOf(w)).revision).toBe(0);
  }
);

Then(
  'Bob, Carol and Dave see the matched game is drawn because a participant withdrew',
  async (w) => {
    const game = await groupBoards(
      w,
      PEOPLE.slice(1),
      (current) => current.outcome === 'draw'
    );
    expect(game.reason).toBe('participant withdrew');
    expect(game.revision).toBe(0);
    expect(multiplayerPeople(game)).toHaveLength(4);
  }
);

Then(
  'all four people see the matched game is drawn because the first side missed the first move',
  async (w) => {
    const game = await groupBoards(
      w,
      PEOPLE,
      (current) => current.outcome === 'draw'
    );
    expect(game.reason).toBe('first move missed');
    expect(game.revision).toBe(0);
    expect(multiplayerPeople(game)).toHaveLength(4);
  }
);

Given(
  'Alice, Bob and Carol are seeking the same four-player game at 5+0',
  async (w) => {
    await readyPeople(w, PEOPLE);
    for (const person of PEOPLE.slice(0, 3)) {
      await searchFor(w, person, timeControlFor(w));
      await w.s.advanceTime(1);
    }
  }
);

When('Dave seeks that four-player game at {word}', async (w, clock: string) => {
  await w.s.apply(
    findGameOpponent,
    'dave',
    turnGameOf(w).shared.id,
    timeControlFor(w, clock)
  );
});

Then(
  'all four people have one matched game with four distinct sides',
  async (w) => {
    const game = await groupBoards(w, PEOPLE);
    expect(multiplayerPeople(game)).toHaveLength(4);
    expect(new Set(multiplayerPeople(game)).size).toBe(4);
    expect(game.outcome).toBe('ongoing');
  }
);

Then('no four-player matched game starts', async (w) => {
  for (const person of PEOPLE) {
    const view = await w.s.read(multiplayerView, person);
    expect(view.game).toBeNull();
    expect(view.search?.standing).toBe('waiting');
  }
});

Given(
  'Alice, Bob, Carol and Dave have a finished four-player matched game',
  async (w) => {
    await groupMatchedGame(w, {
      people: readyPeople,
      participants: PEOPLE,
      timeControl: timeControlFor(w),
    });
    await gameCommand(w, 'alice', 'offerMultiplayerDraw');
    for (const person of PEOPLE.slice(1))
      await gameCommand(w, person, 'acceptMultiplayerDraw');
    const game = await groupBoards(
      w,
      PEOPLE,
      (current) => current.outcome === 'draw'
    );
    w.memo.set('four-seat:finished-match', game);
  }
);

async function offerRematch(
  w: HarnessWorld,
  accepted: readonly string[]
): Promise<void> {
  await gameCommand(w, 'alice', 'offerMultiplayerRematch');
  for (const person of accepted)
    await gameCommand(w, person, 'acceptMultiplayerRematch');
}

Given('Alice has offered a rematch accepted by Bob and Carol', (w) =>
  offerRematch(w, ['bob', 'carol'])
);
Given('Alice has offered a rematch accepted by Bob', (w) =>
  offerRematch(w, ['bob'])
);

function finishedMatch(w: HarnessWorld): MultiplayerGame {
  return w.memo.get('four-seat:finished-match') as MultiplayerGame;
}

Then(
  'all four people have a new matched game at the same clock choice',
  async (w) => {
    const before = finishedMatch(w);
    const game = await groupBoards(
      w,
      PEOPLE,
      (current) => current.id !== before.id
    );
    expect(game.rematch_of).toBe(before.id);
    expect(game.time_control).toBe(before.time_control);
    expect(game.outcome).toBe('ongoing');
  }
);

Then('each person has the next side in the declared turn order', async (w) => {
  const before = finishedMatch(w);
  const game = await matchedGameOf(w);
  const sides = gameSides(turnGameOf(w).shared.turnGame.rules);
  for (const [index, side] of sides.entries()) {
    const nextSide = sides[(index + 1) % sides.length]!;
    expect(multiplayerOwner(game, nextSide)).toBe(
      multiplayerOwner(before, side)
    );
  }
});

Then(
  "the finished matched game is still awaiting Dave's rematch agreement",
  async (w) => {
    const game = await groupBoards(w, PEOPLE);
    expect(game.id).toBe(finishedMatch(w).id);
    expect(game.outcome).toBe('draw');
    const accepted = multiplayerVotes(game, game.rematch_votes);
    expect(accepted).toHaveLength(3);
    expect(accepted).not.toContain(game.blue_id);
  }
);
