/**
 * Steps for the game room's timed match: White and Black, each on their own
 * phone under their own identity, and the match clock on virtual time.
 */

import { expect } from 'bun:test';
import type { Player } from '@pkgs/room-root-harness-ts/game-room';
import {
  ClaimOutOfTime,
  MATCH_STATUS,
  Move,
  REFUSAL,
  readMatchStatus,
  readPlayerToMove,
  readTimeLeftSeconds,
  readWinner,
  StartMatch,
} from '@pkgs/room-root-harness-ts/game-room';
import { clock } from '@pkgs/room-root-harness-ts/observations';
import { readClient, readServer } from '@pkgs/room-root-harness-ts/read-state';
import { dispatch } from '@pkgs/room-root-harness-ts/room-actions';
import {
  everyone,
  expectToldThat,
  openRoom,
  SECOND_MS,
  settleEveryone,
} from './room.steps';
import type { RoomWorld } from './world';
import { Given, room, Then, When } from './world';

async function startMatch(
  w: RoomWorld,
  id: string,
  whiteSeconds: number,
  blackSeconds: number
): Promise<void> {
  await room(w).apply(dispatch, {
    clientId: id,
    payload: StartMatch({
      whiteMs: whiteSeconds * SECOND_MS,
      blackMs: blackSeconds * SECOND_MS,
    }),
  });
}

async function move(w: RoomWorld, id: string): Promise<void> {
  await room(w).apply(dispatch, { clientId: id, payload: Move({}) });
}

async function claimOutOfTime(
  w: RoomWorld,
  id: string,
  player: string
): Promise<void> {
  await room(w).apply(dispatch, {
    clientId: id,
    payload: ClaimOutOfTime({ player: player as Player }),
  });
}

Given(
  'White and Black have started a match with {int} seconds for White and {int} seconds for Black',
  async (w, whiteSeconds: number, blackSeconds: number) => {
    await openRoom(w, ['white', 'black']);
    await startMatch(w, 'white', whiteSeconds, blackSeconds);
    expect(readMatchStatus(await readServer(room(w)))).toBe(
      MATCH_STATUS.playing
    );
  }
);

When(
  '{actor} starts a match with {int} seconds for White and {int} seconds for Black',
  startMatch
);

When('{actor} moves', move);

Given(
  '{actor} has moved after {int} seconds',
  async (w, id: string, seconds: number) => {
    await room(w).advanceTime(seconds * SECOND_MS);
    await move(w, id);
  }
);

When('{actor} claims {actor} has run out of time', claimOutOfTime);

Given('{actor} has claimed {actor} has run out of time', claimOutOfTime);

Then(
  'the match is still playing with {actor} to move',
  async (w, id: string) => {
    const state = await readServer(room(w));
    expect(readMatchStatus(state)).toBe(MATCH_STATUS.playing);
    expect(readPlayerToMove(state)).toBe(id as Player);
  }
);

Then('{actor} is to move', async (w, id: string) => {
  const s = room(w);
  await settleEveryone(s);
  for (const person of await everyone(s)) {
    const shown = await readClient(s, person);
    expect(readMatchStatus(shown)).toBe(MATCH_STATUS.playing);
    expect(readPlayerToMove(shown)).toBe(id as Player);
  }
});

Then('the match has still not started', async (w) => {
  expect(readMatchStatus(await readServer(room(w)))).toBe(
    MATCH_STATUS.notStarted
  );
});

Then(
  'White has {int} second(s) left and Black has {int} second(s) left',
  async (w, whiteSeconds: number, blackSeconds: number) => {
    const s = room(w);
    const state = await readServer(s);
    const now = await s.read(clock);
    expect(readTimeLeftSeconds(state, 'white', now)).toBe(whiteSeconds);
    expect(readTimeLeftSeconds(state, 'black', now)).toBe(blackSeconds);
  }
);

Then(
  'White and Black both/still see {actor} win on time',
  async (w, winner: string) => {
    const s = room(w);
    await settleEveryone(s);
    const state = await readServer(s);
    expect(readMatchStatus(state)).toBe(MATCH_STATUS.over);
    expect(readWinner(state)).toBe(winner as Player);
    for (const id of await everyone(s)) {
      const shown = await readClient(s, id);
      expect(readMatchStatus(shown)).toBe(MATCH_STATUS.over);
      expect(readWinner(shown)).toBe(winner as Player);
    }
  }
);

Then('{actor} is told the move came too late', async (w, id: string) => {
  await expectToldThat(room(w), id, REFUSAL.tooLate);
});
