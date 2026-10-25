import { expect, test } from 'bun:test';
import { matchingMultiplayerRoomGame } from '@libs/game-matchmaking-client-ts/multiplayer-room-game';
import type { MatchRoomGame } from '@libs/game-matchmaking-shared-ts/match-room';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

function liveRoom(id: string, revision: number): MatchRoomGame {
  return {
    id,
    revision,
    white_id: 'alice',
    black_id: 'bob',
    fen: 'counting-race:0',
    pgn: '',
    turn: '',
    outcome: 'ongoing',
    reason: null,
    paused_at_ms: null,
    execution: {
      epoch: `${id}:1`,
      generation: 1,
      inputGeneration: 1,
      tick: 7,
      acknowledged: {},
      phase: 'running',
      started: true,
      missing: [],
      expiresAt: null,
    },
  };
}

test('a rematch never inherits the previous room execution during handover', () => {
  // regression: matched-simulation-room-handover
  const previous = liveRoom('finished-match', 167);
  const rematch = { id: 'accepted-rematch', revision: 0 };
  expect(matchingMultiplayerRoomGame(rematch, previous)).toBeNull();
  expect(matchingMultiplayerRoomGame(null, previous)).toBeNull();
  expect(matchingMultiplayerRoomGame(rematch, null)).toBeNull();
});

test('a checkpoint older than the displayed game cannot supply its execution', () => {
  // regression: matched-simulation-room-handover
  expect(
    matchingMultiplayerRoomGame(
      { id: 'accepted-rematch', revision: 2 },
      liveRoom('accepted-rematch', 1)
    )
  ).toBeNull();
});

test('the minimal checkpoint handover keeps previous execution fenced', () => {
  // regression: matched-simulation-room-handover
  const id = '00000000-0000-1000-8000-000000000000';
  const current = { id, revision: 1 };
  expect(
    matchingMultiplayerRoomGame(current, liveRoom(`${id}:previous`, 1))
  ).toBeNull();
  expect(matchingMultiplayerRoomGame(current, liveRoom(id, 0))).toBeNull();
});

test('room handover fences old matches until the current checkpoint catches up', () => {
  assertProperty(
    'matched simulation room handover',
    fc.property(
      fc.uuid(),
      fc.integer({ min: 0, max: 10_000 }),
      fc.integer({ min: 1, max: 100 }),
      (id, revision, advance) => {
        const current = { id, revision: revision + advance };
        const previous = liveRoom(`${id}:previous`, revision + advance);
        expect(matchingMultiplayerRoomGame(current, previous)).toBeNull();
        expect(
          matchingMultiplayerRoomGame(current, liveRoom(id, revision))
        ).toBeNull();
        const caughtUp = liveRoom(id, current.revision);
        expect(matchingMultiplayerRoomGame(current, caughtUp)).toBe(caughtUp);
        const newer = liveRoom(id, current.revision + advance);
        expect(matchingMultiplayerRoomGame(current, newer)).toBe(newer);
      }
    )
  );
});
