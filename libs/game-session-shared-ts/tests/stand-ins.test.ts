import { expect, test } from 'bun:test';
import {
  PlayCustomGameBot,
  StandInCustomGame,
} from '@libs/game-session-shared-ts/custom-game-commands';
import { CUSTOM_GAME_STAND_IN_MS } from '@libs/game-session-shared-ts/custom-game-stand-in';
import { ROOM_SCHEDULER_IDENTITY } from '@pkgs/room-root-shared-ts/builtin';
import { fourSeatRoom } from './four-seat-room';

const AWAY_AT = 2_000;
const DUE = AWAY_AT + CUSTOM_GAME_STAND_IN_MS;

/** A four-seat game with Bob (black) to move, everyone here. */
function bobToMove() {
  const room = fourSeatRoom();
  room.fill();
  expect(room.send('alice', { operation: 'start' }, AWAY_AT).ok).toBe(true);
  expect(
    room.send('alice', { operation: 'move', uci: 'advance', ply: 0 }, AWAY_AT)
      .ok
  ).toBe(true);
  expect(room.current().turn).toBe('black');
  return room;
}

const standIn = (room: ReturnType<typeof fourSeatRoom>, at: number) =>
  room.deliver(
    ROOM_SCHEDULER_IDENTITY,
    StandInCustomGame({ gameId: room.current().id }),
    at
  );

// regression: stand-in-move-chosen-by-creator
test("the creator cannot choose the move a stand-in makes for an away person's side", () => {
  const room = bobToMove();
  room.away({ bob: AWAY_AT });
  expect(standIn(room, DUE).ok).toBe(true);
  expect(room.current().standIns).toEqual(['black']);
  const before = room.current();
  const dictated = room.deliver(
    'alice',
    PlayCustomGameBot({
      gameId: before.id,
      ply: before.moves.length,
      side: 'black',
      at: DUE + 100,
      move: 'advance',
    }),
    DUE + 100
  );
  expect(dictated.ok).toBe(false);
  expect(room.current()).toEqual(before);
  // The room itself decides for the stand-in.
  const decided = room.deliver(
    ROOM_SCHEDULER_IDENTITY,
    PlayCustomGameBot({
      gameId: before.id,
      ply: before.moves.length,
      side: 'black',
    }),
    DUE + 200
  );
  expect(decided.ok).toBe(true);
  expect(room.current().moves).toHaveLength(before.moves.length + 1);
});

test("the creator's device still predicts its own bots' moves", () => {
  const room = fourSeatRoom();
  room.send('alice', { operation: 'create' });
  for (const side of ['black', 'red', 'blue'] as const)
    expect(room.send('alice', { operation: 'bot', side }).ok).toBe(true);
  room.send('alice', { operation: 'ready' });
  expect(room.send('alice', { operation: 'start' }, AWAY_AT).ok).toBe(true);
  room.send('alice', { operation: 'move', uci: 'advance', ply: 0 }, AWAY_AT);
  const played = room.deliver(
    'alice',
    PlayCustomGameBot({
      gameId: room.current().id,
      ply: 1,
      side: 'black',
      at: AWAY_AT + 100,
      move: 'advance',
    }),
    AWAY_AT + 100
  );
  expect(played.ok).toBe(true);
  expect(room.current().moves).toHaveLength(2);
});

// regression: stand-in-while-host-away
test('nobody gets a stand-in while the host is away, and the pause never counts as time away', () => {
  const room = bobToMove();
  room.away({ bob: AWAY_AT });
  room.available(false, AWAY_AT + 10_000);
  expect(standIn(room, DUE).ok).toBe(true);
  expect(room.current().standIns).toEqual([]);
  // Back after a 30-second pause: Bob's grace period ends 30 seconds later.
  const effects = room.available(true, AWAY_AT + 40_000);
  expect(effects).toContainEqual(
    expect.objectContaining({
      payload: expect.objectContaining({ at: DUE + 30_000 }),
    })
  );
  standIn(room, DUE + 29_000);
  expect(room.current().standIns).toEqual([]);
  standIn(room, DUE + 30_000);
  expect(room.current().standIns).toEqual(['black']);
});

// regression: stand-in-without-another-person
test('a person alone with bots, or with everyone else away, gets no stand-in', () => {
  const solo = fourSeatRoom();
  solo.send('alice', { operation: 'create' });
  for (const side of ['black', 'red', 'blue'] as const)
    solo.send('alice', { operation: 'bot', side });
  solo.send('alice', { operation: 'ready' });
  expect(solo.send('alice', { operation: 'start' }, AWAY_AT).ok).toBe(true);
  solo.away({ alice: AWAY_AT });
  expect(standIn(solo, DUE).ok).toBe(true);
  expect(solo.current().standIns).toEqual([]);

  const room = bobToMove();
  room.away({ alice: AWAY_AT, bob: AWAY_AT, carol: AWAY_AT });
  standIn(room, DUE);
  expect(room.current().standIns).toEqual(['white', 'black', 'red']);
  const deserted = bobToMove();
  deserted.away({
    alice: AWAY_AT,
    bob: AWAY_AT,
    carol: AWAY_AT,
    dave: AWAY_AT,
  });
  standIn(deserted, DUE);
  expect(deserted.current().standIns).toEqual([]);
});
