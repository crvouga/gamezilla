import { expect } from 'bun:test';
import { changeRange } from '@pkgs/matchmaking-harness/lobby';
import { pairAllowed, participantIds } from '@pkgs/matchmaking-harness/observations';
import { standing, waitsForMatch } from './matchmaking.steps';
import { Given, Then } from './world';
import type { MatchmakingWorld } from './world';

async function group(
  w: MatchmakingWorld,
  people: readonly string[],
  size = 2
): Promise<void> {
  const rating: Record<string, number> = {
    alice: 1000,
    bob: 950,
    carol: 1050,
    dave: 1100,
  };
  for (const person of people)
    await waitsForMatch(w, person, {
      rating: rating[person]!,
      range: 200,
      groupSize: size,
    });
}

Given(
  "{actor} and {actor} are waiting within each other's ranges",
  async (w, a: string, b: string) => group(w, [a, b])
);
Given(
  "{actor}, {actor} and {actor} are waiting in that order within each other's ranges",
  async (w, a: string, b: string, c: string) => group(w, [a, b, c])
);
Given(
  "{actor}, {actor}, {actor} and {actor} are waiting in that order within each other's ranges",
  async (w, ...people: [string, string, string, string]) => group(w, people)
);
Given(
  "{actor} and {actor} are waiting for a group of {int} within each other's ranges",
  async (w, a: string, b: string, size: number) => group(w, [a, b], size)
);
Given(
  "{actor}, {actor} and {actor} are waiting for a group of {int}( within each other's ranges)",
  async (w, ...values: [string, string, string, number]) => {
    const [a, b, c, size] = values;
    await group(w, [a, b, c], size);
  }
);
Given(
  "{actor}, {actor}, {actor} and {actor} are waiting for a group of {int} within each other's ranges",
  async (w, ...values: [string, string, string, string, number]) => {
    const [a, b, c, d, size] = values;
    await group(w, [a, b, c, d], size);
  }
);
Given(
  '{actor} is waiting for a group of {int}',
  async (w, person: string, groupSize: number) =>
    waitsForMatch(w, person, { groupSize })
);
Given(
  '{actor} accepts {actor} and {actor} but {actor} and {actor} do not accept each other',
  async (w, _a: string, b: string, c: string) => {
    await w.harness.apply(changeRange, { person: b, range: 50 });
    await w.harness.apply(changeRange, { person: c, range: 50 });
  }
);
Given(
  "{actor} and {actor} are waiting in the same matching pool within each other's ranges",
  async (w, a: string, b: string) => {
    await waitsForMatch(w, a, { pool: 'nearby', range: 200 });
    await waitsForMatch(w, b, { pool: 'nearby', range: 200 });
  }
);
Given(
  "{actor} and {actor} are waiting in different matching pools within each other's ranges",
  async (w, a: string, b: string) => {
    await waitsForMatch(w, a, { pool: 'nearby', range: 200 });
    await waitsForMatch(w, b, { pool: 'elsewhere', range: 200 });
  }
);

async function sameMatch(
  w: MatchmakingWorld,
  people: readonly string[]
): Promise<void> {
  const ids = await w.harness.read(participantIds);
  const matchIds: string[] = [];
  for (const person of people) {
    const view = await standing(w, person);
    expect(view?.status).toBe('matched');
    if (view?.status !== 'matched') throw new Error(`${person} has no match`);
    matchIds.push(view.matchId);
    expect(new Set(view.peers.map((p) => p.participantId))).toEqual(
      new Set(people.filter((p) => p !== person).map((p) => ids[p]!))
    );
  }
  expect(new Set(matchIds).size).toBe(1);
}

Then(
  '{actor}, {actor} and {actor} have the same match',
  async (w, a: string, b: string, c: string) => sameMatch(w, [a, b, c])
);
Then(
  '{actor}, {actor}, {actor} and {actor} have the same match',
  async (w, ...people: [string, string, string, string]) => sameMatch(w, people)
);
Then(
  '{actor} and {actor} are still waiting',
  async (w, a: string, b: string) => {
    expect((await standing(w, a))?.status).toBe('waiting');
    expect((await standing(w, b))?.status).toBe('waiting');
  }
);
Then(
  '{actor}, {actor} and {actor} are still waiting',
  async (w, a: string, b: string, c: string) => {
    for (const person of [a, b, c])
      expect((await standing(w, person))?.status).toBe('waiting');
  }
);
Then(
  'one matchmaking match is formed for {actor} and {actor}',
  async (w, a: string, b: string) => sameMatch(w, [a, b])
);
Then(
  '{actor} and {actor} keep the same match',
  async (w, a: string, b: string) => {
    for (const person of [a, b]) {
      const view = await standing(w, person);
      expect(view?.status === 'matched' ? view.matchId : null).toBe(
        w.firstMatches.get(person) ?? null
      );
    }
  }
);
Then(
  '{actor} keeps her/his earlier match with {actor}',
  async (w, a: string) => {
    const view = await standing(w, a);
    expect(view?.status === 'matched' ? view.matchId : null).toBe(
      w.firstMatches.get(a) ?? null
    );
  }
);
Then('{actor} and {actor} accept each other', async (w, a: string, b: string) =>
  expect(await w.harness.read(pairAllowed, a, b)).toBe(true)
);
