/**
 * Steps for waiting for a match, changing one's range and being matched:
 * each `{actor}` is a person of the example app's lobby, waiting under
 * their own name.
 */

import { expect } from 'bun:test';
import type { LeaveResult, StatusResult, UpdateFormulasResult } from '@pkgs/matchmaking-shared/types';
import { changeRange, lastWait, stopWaiting, waitForMatch } from '@pkgs/matchmaking-harness/lobby';
import { lastLeave, lastUpdate, participantIds, statusOf } from '@pkgs/matchmaking-harness/observations';
import { NameAttr, RatingAttr } from '@pkgs/matchmaking-harness/attrs';
import { tick } from '@pkgs/matchmaking-harness/actions';
import { Given, Then, When } from './world';
import type { MatchmakingWorld } from './world';

/** The rating a person waits with when the scenario does not say. */
const DEFAULT_RATING = 1500;
/** The range a person waits with when the scenario does not say. */
const DEFAULT_RANGE = 50;

export async function waitsForMatch(
  w: MatchmakingWorld,
  person: string,
  opts: {
    readonly rating?: number;
    readonly range?: number;
    readonly place?: string;
    readonly groupSize?: number;
    readonly pool?: string;
  } = {}
): Promise<void> {
  await w.harness.apply(waitForMatch, {
    ...opts,
    person,
    rating: opts.rating ?? DEFAULT_RATING,
    range: opts.range ?? DEFAULT_RANGE,
  });
  const id = (await w.harness.read(participantIds))[person];
  if (id !== undefined && !w.firstWaits.has(person))
    w.firstWaits.set(person, id);
}

export async function standing(
  w: MatchmakingWorld,
  person: string
): Promise<StatusResult | null> {
  return (await w.harness.read(statusOf, person)) as StatusResult | null;
}

export async function expectMatchedWith(
  w: MatchmakingWorld,
  person: string,
  other: string
): Promise<void> {
  const seen = await standing(w, person);
  expect(seen?.status).toBe('matched');
  if (seen?.status !== 'matched') return;
  const otherWait = (await w.harness.read(participantIds))[other];
  expect(seen.peers.map((p) => p.participantId as string | undefined)).toEqual([
    otherWait,
  ]);
}

async function leaveResult(w: MatchmakingWorld): Promise<LeaveResult> {
  return (await w.harness.read(lastLeave)) as LeaveResult;
}

async function updateResult(
  w: MatchmakingWorld
): Promise<UpdateFormulasResult> {
  return (await w.harness.read(lastUpdate)) as UpdateFormulasResult;
}

// --- Given ------------------------------------------------------------------

Given('{actor} is waiting for a match', async (w, person: string) => {
  await waitsForMatch(w, person);
});

Given(
  '{actor} is waiting with a rating of {int}, accepting anyone within {int} points',
  async (w, person: string, rating: number, range: number) => {
    await waitsForMatch(w, person, { rating, range });
  }
);

Given(
  '{actor} has been matched with {actor}',
  async (w, person: string, other: string) => {
    await waitsForMatch(w, person, { rating: 1000, range: 200 });
    await waitsForMatch(w, other, { rating: 1050, range: 200 });
    await w.harness.apply(tick, {});
    const matched = await standing(w, person);
    if (matched?.status === 'matched') {
      w.firstMatches.set(person, matched.matchId);
      w.firstMatches.set(other, matched.matchId);
    }
    if (matched?.status !== 'matched') {
      throw new Error(`setup: ${person} and ${other} were not matched`);
    }
  }
);

Given('{actor} has stopped waiting', async (w, person: string) => {
  await waitsForMatch(w, person);
  await w.harness.apply(stopWaiting, { person });
  if (!(await leaveResult(w)).removed) {
    throw new Error(`setup: ${person} did not stop waiting`);
  }
});

Given(
  '{actor} has widened her/his range to {int} points',
  async (w, person: string, range: number) => {
    await w.harness.apply(changeRange, { person, range });
    if (!(await updateResult(w)).updated) {
      throw new Error(`setup: ${person}'s range did not change`);
    }
  }
);

// --- When -------------------------------------------------------------------

When(
  '{actor} waits for a match with a rating of {int}',
  async (w, person: string, rating: number) => {
    await waitsForMatch(w, person, { rating });
  }
);

When('{actor} stops waiting', async (w, person: string) => {
  await w.harness.apply(stopWaiting, { person });
});

When(
  '{actor} widens her/his range to {int} points',
  async (w, person: string, range: number) => {
    await w.harness.apply(changeRange, { person, range });
  }
);

When('matchmaking pairs people up', async (w) => {
  await w.harness.apply(tick, {});
});

// --- Then -------------------------------------------------------------------

Then('{actor} is (still )waiting', async (w, person: string) => {
  expect((await standing(w, person))?.status).toBe('waiting');
});

Then(
  "{actor}'s wait shows her/his name and a rating of {int}",
  async (w, person: string, rating: number) => {
    expect((await standing(w, person))?.data).toEqual({
      ...RatingAttr(rating),
      ...NameAttr(person),
    });
  }
);

Then('{actor} is told she/he is already waiting', async (w) => {
  expect(await w.harness.read(lastWait)).toBe('alreadyWaiting');
});

Then('{actor} sees she/he stopped waiting', async (w) => {
  expect((await leaveResult(w)).removed).toBe(true);
});

Then('{actor} is not waiting( for a match)', async (w, person: string) => {
  expect(await standing(w, person)).toBeNull();
});

Then('{actor} is told there was nothing to stop', async (w) => {
  expect((await leaveResult(w)).removed).toBe(false);
});

Then(
  '{actor} is matched with {actor}',
  async (w, person: string, other: string) => {
    await expectMatchedWith(w, person, other);
  }
);

Then('{actor} sees her/his change counted', async (w) => {
  expect((await updateResult(w)).updated).toBe(true);
});

Then('{actor} is told her/his change did not count', async (w) => {
  expect((await updateResult(w)).updated).toBe(false);
});
