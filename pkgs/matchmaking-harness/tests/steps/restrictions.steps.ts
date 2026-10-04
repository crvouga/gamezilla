import { expect } from 'bun:test';
import {
  pairAllowed,
  restriction,
  stopWaiting,
  tick,
} from '@pkgs/matchmaking-harness';
import {
  expectMatchedWith,
  standing,
  waitsForMatch,
} from './matchmaking.steps';
import { Given, type MatchmakingWorld, Step, Then, When } from './world';

async function restricted(
  w: MatchmakingWorld,
  person: string,
  other: string
): Promise<void> {
  await w.harness.apply(restriction, { person, other, restricted: true });
}
Step(
  '{actor} and {actor} cannot be matched together',
  async (w, person: string, other: string) => {
    if (w.phase === 'Given') await restricted(w, person, other);
    else expect(await w.harness.read(pairAllowed, person, other)).toBe(false);
  }
);
When('{actor} and {actor} become unable to be matched together', restricted);
When(
  '{actor} and {actor} can be matched together again',
  async (w, person: string, other: string) =>
    w.harness.apply(restriction, { person, other, restricted: false })
);
Given(
  '{actor} and {actor} are waiting but cannot be matched together',
  async (w, person: string, other: string) => {
    await waitsForMatch(w, person, { range: 200 });
    await waitsForMatch(w, other, { range: 200 });
    await restricted(w, person, other);
  }
);
Given(
  '{actor} stopped waiting while she/he and {actor} could not be matched together',
  async (w, person: string, other: string) => {
    await waitsForMatch(w, person);
    await waitsForMatch(w, other);
    await restricted(w, person, other);
    await w.harness.apply(stopWaiting, { person });
  }
);
Step(
  '{actor} and {actor} are matched with each other',
  async (w, person: string, other: string) => {
    if (w.phase !== 'Given') {
      await expectMatchedWith(w, person, other);
      await expectMatchedWith(w, other, person);
      return;
    }
    await waitsForMatch(w, person, { range: 200 });
    await waitsForMatch(w, other, { range: 200 });
    await w.harness.apply(tick, {});
    const view = await standing(w, person);
    if (view?.status !== 'matched')
      throw new Error('setup did not form a match');
    w.firstMatches.set(person, view.matchId);
    w.firstMatches.set(other, view.matchId);
  }
);
Then(
  '{actor} and {actor} can be matched together',
  async (w, person: string, other: string) =>
    expect(await w.harness.read(pairAllowed, person, other)).toBe(true)
);
