import { expect, test } from 'bun:test';
import {
  type MatchRoomGame,
  MultiplayerGameChanged,
  matchRoomGame,
  matchRoomModule,
} from '@libs/game-matchmaking-shared/match-room';
import { ROOM_SERVICE_IDENTITY } from '@pkgs/room-root-shared/service-identity';
import type { RoomState } from '@pkgs/room-root-shared/types';

const accepted: MatchRoomGame = {
  id: 'accepted-match',
  white_id: 'alice',
  black_id: 'bob',
  fen: 'accepted-position',
  pgn: '',
  revision: 1,
  turn: 'bob',
  outcome: 'ongoing',
  reason: null,
  paused_at_ms: null,
};
async function deliver(
  state: RoomState,
  game: MatchRoomGame,
  identity = ROOM_SERVICE_IDENTITY
) {
  const result = await matchRoomModule.handle(
    state,
    { id: 'delivery', ts: 0, payload: MultiplayerGameChanged(game) },
    identity
  );
  if (!result.ok) return { result, state };
  return {
    result,
    state: result.events.reduce(
      (current, event) => matchRoomModule.reduce(current, event),
      state
    ),
  };
}

test('room peers cannot forge an accepted game snapshot, including matched players', async () => {
  const state = (await deliver({}, accepted)).state;
  for (const identity of ['alice', 'bob', 'guest']) {
    const attempted = await deliver(
      state,
      { ...accepted, revision: 999, outcome: 'white' },
      identity
    );
    expect(attempted.result.ok).toBe(false);
    expect(matchRoomGame(attempted.state)).toEqual(accepted);
  }
});

test('delayed snapshots cannot undo accepted moves or a same-position resignation', async () => {
  const state = (await deliver({}, accepted)).state;
  const finished = {
    ...accepted,
    outcome: 'white' as const,
    turn: '',
    reason: 'resignation',
  };
  const finalState = (await deliver(state, finished)).state;
  expect(matchRoomGame((await deliver(finalState, accepted)).state)).toEqual(
    finished
  );
  expect(
    matchRoomGame(
      (await deliver(finalState, { ...accepted, revision: 0 })).state
    )
  ).toEqual(finished);
  expect(
    matchRoomGame(
      (
        await deliver(finalState, {
          ...accepted,
          id: 'different-match',
          revision: 2,
        })
      ).state
    )
  ).toEqual(finished);
});

// regression: chess-match-room-erased-identity
test('identity erasure refreshes a finished room without reopening the game', async () => {
  const finished = {
    ...accepted,
    outcome: 'black' as const,
    reason: 'account deletion',
    turn: '',
  };
  const state = (await deliver({}, finished)).state;
  const erased = { ...finished, white_id: 'deleted:accepted-match:white' };
  const erasedState = (await deliver(state, erased)).state;
  expect(matchRoomGame(erasedState)).toEqual(erased);
  expect(matchRoomGame((await deliver(erasedState, finished)).state)).toEqual(
    erased
  );
});
