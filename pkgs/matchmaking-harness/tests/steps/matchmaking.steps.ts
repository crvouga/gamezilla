/**
 * Steps for waiting for a match, being matched, and asking at any entrance.
 * Each `{actor}` waits under their own name; `entrance n` is the n-th of the
 * scenario's entrances.
 */

import { expect } from 'bun:test';
import type {
  LeaveResult,
  StatusResult,
  UpdateFormulasResult,
} from '@pkgs/matchmaking/interface';
import {
  join,
  lastLeave,
  lastUpdate,
  leave,
  NameAttr,
  participantIds,
  RatingAttr,
  ratingWithin,
  ready,
  replicaIds,
  statusAcrossReplicas,
  statusById,
  statusOf,
  tick,
  updateFormulas,
} from '@pkgs/matchmaking-harness';
import { entrance, Given, type MatchmakingWorld, Then, When } from './world';

/** A wait nobody ever started. */
const NOBODY = '00000000-0000-0000-0000-000000000000';
/** The rating a person waits with when the scenario does not say. */
const DEFAULT_RATING = 1500;
/** The reach a person waits with when the scenario does not say. */
const DEFAULT_REACH = 50;

async function waitForMatch(
  w: MatchmakingWorld,
  person: string,
  opts: { rating?: number; reach?: number; at?: number } = {}
): Promise<void> {
  await w.harness.apply(join, {
    ref: person,
    input: {
      data: {
        ...RatingAttr(opts.rating ?? DEFAULT_RATING),
        ...NameAttr(person),
      },
      formulas: [ratingWithin(opts.reach ?? DEFAULT_REACH)],
    },
    ...(opts.at === undefined ? {} : { replicaId: entrance(opts.at) }),
  });
}

async function idOf(w: MatchmakingWorld, person: string): Promise<string> {
  const id = (await w.harness.read(participantIds))[person];
  if (id === undefined) throw new Error(`${person} never waited for a match`);
  return id;
}

async function standing(
  w: MatchmakingWorld,
  person: string
): Promise<StatusResult | null> {
  return (await w.harness.read(statusOf, person)) as StatusResult | null;
}

/** `person`'s standing as each entrance sees it, keyed by entrance. */
async function standingEverywhere(
  w: MatchmakingWorld,
  person: string
): Promise<Record<string, StatusResult | null>> {
  return (await w.harness.read(
    statusAcrossReplicas,
    await idOf(w, person)
  )) as Record<string, StatusResult | null>;
}

async function expectMatchedWith(
  w: MatchmakingWorld,
  seen: StatusResult | null,
  other: string
): Promise<void> {
  expect(seen?.status).toBe('matched');
  if (seen?.status !== 'matched') return;
  expect(seen.peers.map((p) => p.participantId)).toEqual([
    await idOf(w, other),
  ]);
}

// --- Given ------------------------------------------------------------------

Given('{actor} is waiting for a match', async (w, person: string) => {
  await waitForMatch(w, person);
});

Given(
  '{actor} is waiting for a match at entrance {int}',
  async (w, person: string, at: number) => {
    await waitForMatch(w, person, { at });
  }
);

Given(
  '{actor} is waiting with a rating of {int}, accepting anyone within {int} points',
  async (w, person: string, rating: number, reach: number) => {
    await waitForMatch(w, person, { rating, reach });
  }
);

Given(
  '{actor} is waiting at entrance {int} with a rating of {int}, accepting anyone within {int} points',
  async (
    w,
    person: string,
    ...[at, rating, reach]: readonly [number, number, number]
  ) => {
    await waitForMatch(w, person, { rating, reach, at });
  }
);

Given(
  '{actor} has been matched with {actor}',
  async (w, person: string, other: string) => {
    await waitForMatch(w, person, { rating: 1000, reach: 200 });
    await waitForMatch(w, other, { rating: 1050, reach: 200 });
    await w.harness.apply(tick, {});
    if ((await standing(w, person))?.status !== 'matched') {
      throw new Error(`setup: ${person} and ${other} were not matched`);
    }
  }
);

// --- When -------------------------------------------------------------------

When(
  '{actor} waits for a match with a rating of {int}',
  async (w, person: string, rating: number) => {
    await waitForMatch(w, person, { rating });
  }
);

When(
  '{actor} waits for a match at entrance {int}',
  async (w, person: string, at: number) => {
    await waitForMatch(w, person, { at });
  }
);

When('someone asks after a wait nobody started', async (w) => {
  w.memo.set('found', await w.harness.read(statusById, NOBODY));
});

When('{actor} stops waiting', async (w, person: string) => {
  await w.harness.apply(leave, { ref: person });
});

When(
  '{actor} stops waiting at entrance {int}',
  async (w, person: string, at: number) => {
    await w.harness.apply(leave, { ref: person, replicaId: entrance(at) });
  }
);

When('someone stops a wait nobody started', async (w) => {
  await w.harness.apply(leave, { participantId: NOBODY });
});

When('a matching round runs', async (w) => {
  await w.harness.apply(tick, {});
});

When('a matching round runs at entrance {int}', async (w, at: number) => {
  await w.harness.apply(tick, { replicaId: entrance(at) });
});

When(
  '{actor} widens her/his reach to {int} points at entrance {int}',
  async (w, person: string, reach: number, at: number) => {
    await w.harness.apply(updateFormulas, {
      ref: person,
      formulas: [ratingWithin(reach)],
      replicaId: entrance(at),
    });
  }
);

When('every entrance opens again', async (w) => {
  for (const replicaId of await w.harness.read(replicaIds)) {
    await w.harness.apply(ready, { replicaId });
  }
});

// --- Then -------------------------------------------------------------------

Then('{actor} is waiting', async (w, person: string) => {
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

Then('nothing is found', (w) => {
  expect(w.memo.get('found')).toBeNull();
});

Then('{actor} is told she/he stopped waiting', async (w) => {
  expect(((await w.harness.read(lastLeave)) as LeaveResult).removed).toBe(true);
});

Then('{actor} is not waiting for a match', async (w, person: string) => {
  expect(await standing(w, person)).toBeNull();
});

Then('{actor} is told there was nothing to stop', async (w) => {
  expect(((await w.harness.read(lastLeave)) as LeaveResult).removed).toBe(
    false
  );
});

Then('they are told there was nothing to stop', async (w) => {
  expect(((await w.harness.read(lastLeave)) as LeaveResult).removed).toBe(
    false
  );
});

Then(
  '{actor} is matched with {actor}',
  async (w, person: string, other: string) => {
    await expectMatchedWith(w, await standing(w, person), other);
  }
);

Then(
  '{actor} and {actor} are matched with each other',
  async (w, person: string, other: string) => {
    await expectMatchedWith(w, await standing(w, person), other);
    await expectMatchedWith(w, await standing(w, other), person);
  }
);

Then('every entrance sees {actor} waiting', async (w, person: string) => {
  const seen = await standingEverywhere(w, person);
  for (const [at, one] of Object.entries(seen)) {
    expect({ at, status: one?.status }).toEqual({ at, status: 'waiting' });
  }
});

Then('no entrance sees {actor} waiting', async (w, person: string) => {
  const seen = await standingEverywhere(w, person);
  for (const [at, one] of Object.entries(seen)) {
    expect({ at, standing: one }).toEqual({ at, standing: null });
  }
});

Then('{actor} is told her/his change counted', async (w) => {
  expect(
    ((await w.harness.read(lastUpdate)) as UpdateFormulasResult).updated
  ).toBe(true);
});

Then(
  'every entrance sees {actor} and {actor} matched with each other',
  async (w, person: string, other: string) => {
    for (const [a, b] of [
      [person, other],
      [other, person],
    ] as const) {
      for (const one of Object.values(await standingEverywhere(w, a))) {
        await expectMatchedWith(w, one, b);
      }
    }
  }
);
