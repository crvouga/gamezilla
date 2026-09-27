/**
 * Steps for the match-clock room (`matchClockSystem`): White and Black, each
 * on their own device under their own identity, on a virtual clock pinned to
 * a small epoch so banks read as plain milliseconds.
 */

import { expect } from 'bun:test';
import {
  dispatch,
  FlagFall,
  Move,
  matchClockBlackMs,
  matchClockStatus,
  matchClockSystem,
  matchClockTurn,
  matchClockWhiteMs,
  matchClockWinner,
  type RoomSim,
  readClient,
  readServer,
  roomEpoch,
  StartMatch,
} from '@pkgs/room-sim';
import type { Run } from '@pkgs/sim';
import { everyone, join, settleEveryone } from './room.steps';
import { Given, room, Then, When } from './world';

const MATCH_EPOCH_MS = 10_000;

type Seat = 'white' | 'black';

async function move(s: Run<RoomSim>, seat: string): Promise<void> {
  await s.apply(dispatch, { clientId: seat, payload: Move({}) });
}

async function claimFlag(
  s: Run<RoomSim>,
  seat: string,
  flagged: string
): Promise<void> {
  await s.apply(dispatch, {
    clientId: seat,
    payload: FlagFall({ seat: flagged as Seat }),
  });
}

Given(
  'White and Black have started a match with {int} ms for White and {int} ms for Black',
  async (w, whiteMs: number, blackMs: number) => {
    w.sim = await matchClockSystem.run({
      seed: w.ctx.testId,
      runtime: roomEpoch(MATCH_EPOCH_MS),
    });
    await join(w, ['white', 'black']);
    await w.sim.apply(dispatch, {
      clientId: 'white',
      payload: StartMatch({ whiteMs, blackMs }),
    });
    expect(matchClockStatus(await readServer(w.sim))).toBe('playing');
  }
);

When('{actor} moves', async (w, seat: string) => {
  await move(room(w), seat);
});

Given(
  '{actor} has moved after {int} ms',
  async (w, seat: string, ms: number) => {
    await room(w).advanceTime(ms);
    await move(room(w), seat);
  }
);

When(
  "{actor} claims {actor}'s flag has fallen",
  async (w, seat: string, flagged: string) => {
    await claimFlag(room(w), seat, flagged);
  }
);

Given(
  "{actor} has claimed {actor}'s flag has fallen",
  async (w, seat: string, flagged: string) => {
    await claimFlag(room(w), seat, flagged);
  }
);

Then(
  'the match is still playing with {actor} to move',
  async (w, seat: string) => {
    const state = await readServer(room(w));
    expect(matchClockStatus(state)).toBe('playing');
    expect(matchClockTurn(state)).toBe(seat);
  }
);

Then(
  'White has {int} ms left and Black has {int} ms left',
  async (w, whiteMs: number, blackMs: number) => {
    const state = await readServer(room(w));
    expect(matchClockWhiteMs(state)).toBe(whiteMs);
    expect(matchClockBlackMs(state)).toBe(blackMs);
  }
);

Then('{actor} still has {int} ms left', async (w, seat: string, ms: number) => {
  const state = await readServer(room(w));
  const left =
    seat === 'white' ? matchClockWhiteMs(state) : matchClockBlackMs(state);
  expect(left).toBe(ms);
});

Then(
  'White and Black both see {actor} win on time',
  async (w, winner: string) => {
    const s = room(w);
    await settleEveryone(s);
    const state = await readServer(s);
    expect(matchClockStatus(state)).toBe('flagged');
    expect(matchClockWinner(state)).toBe(winner);
    for (const id of await everyone(s)) {
      expect(matchClockStatus(await readClient(s, id))).toBe('flagged');
    }
  }
);
