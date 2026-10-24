import { expect } from 'bun:test';
import {
  multiplayerCommandReply,
  sendMultiplayerCommand,
} from '@libs/game-matchmaking-harness-ts/multiplayer-commands';
import { pairGameOpponents } from '@libs/game-matchmaking-harness-ts/multiplayer-fixtures';
import {
  opponentSearchView,
  seekGameOpponent,
} from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { multiplayerOwner } from '@libs/game-matchmaking-shared-ts/multiplayer-roster';
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { accountIdOf } from '@libs/harness-ts/identity';
import type { OpenHarness } from '@libs/harness-ts/open-harness';
import { gameSides } from '@pkgs/turn-game-shared-ts/game-rules';

const PEOPLE = ['alice', 'bob', 'carol', 'dave'];

/** The real search and formation path fills exactly the declared roster. */
export async function matched(s: OpenHarness, game: HarnessGame) {
  const sides = gameSides(game.shared.turnGame.rules);
  const people = PEOPLE.slice(0, sides.length);
  for (const person of people) {
    await s.apply(seekGameOpponent, person, game.shared.id);
    await s.advanceTime(1);
  }
  await s.apply(pairGameOpponents, people[0]!, true);
  await s.until((world) => opponentSearchView(world, people[0]!), {
    pred: (view) => view.game !== null,
  });
  const match = await agreed(s, people);
  const identities = await Promise.all(
    people.map(
      async (person) => [person, await s.read(accountIdOf, person)] as const
    )
  );
  const turnOrder = sides.map((side) => {
    const actor = identities.find(
      ([, id]) => id === multiplayerOwner(match, side)
    )?.[0];
    if (actor === undefined)
      throw new Error(`No actor owns declared side ${side}`);
    return actor;
  });
  return { match, people: turnOrder };
}

export async function command(
  s: OpenHarness,
  actor: string,
  args: Record<string, unknown>,
  name = 'playMultiplayerMove'
) {
  await s.apply(sendMultiplayerCommand, actor, { name, args });
  return (await s.read(multiplayerCommandReply, actor))!.result.ok;
}

/** Every participant's ordinary synchronized query holds the same accepted game. */
export async function agreed(
  s: OpenHarness,
  people: readonly string[],
  predicate: (game: MultiplayerGame) => boolean = () => true
) {
  const first = (
    await s.until((world) => opponentSearchView(world, people[0]!), {
      pred: (view) => view.game !== null && predicate(view.game),
    })
  ).game!;
  for (const person of people.slice(1)) {
    const view = await s.until((world) => opponentSearchView(world, person), {
      pred: (value) => JSON.stringify(value.game) === JSON.stringify(first),
    });
    expect(view.game).toEqual(first);
  }
  return first;
}

/** A unanimous rematch rotates each person one declared seat and retains the result. */
export async function rematched(
  s: OpenHarness,
  people: readonly string[],
  game: HarnessGame,
  finished: MultiplayerGame
) {
  for (const [index, actor] of people.entries())
    expect(
      await command(
        s,
        actor,
        {
          gameId: finished.id,
          requestId: `rematch-${actor}`,
        },
        index === 0 ? 'offerMultiplayerRematch' : 'acceptMultiplayerRematch'
      )
    ).toBe(true);
  const rematch = await agreed(s, people, (match) => match.id !== finished.id);
  const sides = gameSides(game.shared.turnGame.rules);
  expect(rematch.id).not.toBe(finished.id);
  for (const [index, side] of sides.entries())
    expect(multiplayerOwner(rematch, sides[(index + 1) % sides.length]!)).toBe(
      multiplayerOwner(finished, side)
    );
  return rematch;
}
