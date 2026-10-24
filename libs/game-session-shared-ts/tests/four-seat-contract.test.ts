import { expect, test } from 'bun:test';
import { customGameCancelRefusal } from '@libs/game-session-shared-ts/custom-game-refusal';
import {
  CustomGamesAttr,
  customGameStartable,
  newCustomGame,
} from '@libs/game-session-shared-ts/custom-game-state';
import { fourSeatRoom, PEOPLE } from './four-seat-room';

// regression: four-seat-noncreator-cancel
test('a noncreator cannot cancel a four-seat round before its first move and may resign to a draw', () => {
  const room = fourSeatRoom();
  room.fill();
  room.send('alice', { operation: 'start' });
  const before = room.current();
  expect(before.moves).toEqual([]);
  expect(room.send('bob', { operation: 'cancel' }).ok).toBe(false);
  expect(room.current()).toEqual(before);
  // The rendered cancel affordance uses this same public permission predicate.
  expect(customGameCancelRefusal(before, 'bob')).toBe('only the creator');
  expect(room.send('bob', { operation: 'resign' }).ok).toBe(true);
  expect(room.current()).toMatchObject({
    status: 'completed',
    outcome: 'draw',
    outcomeReason: 'participant withdrew',
  });
});

test('the creator retains cancellation and a two-person participant retains early cancellation', () => {
  const room = fourSeatRoom();
  room.fill();
  room.send('alice', { operation: 'start' });
  expect(customGameCancelRefusal(room.current(), 'alice')).toBe('');
  expect(room.send('alice', { operation: 'cancel' }).ok).toBe(true);
  expect(room.current().status).toBe('cancelled');
  const pair = {
    ...newCustomGame('pair', 'alice', 'pair:0'),
    status: 'active' as const,
    black: { kind: 'person' as const, person: 'bob' },
  };
  expect(customGameCancelRefusal(pair, 'bob')).toBe('');
});

test('a declared roster needs every participant and readiness before activation', () => {
  const room = fourSeatRoom();
  room.send('alice', { operation: 'create' });
  expect(room.current().sides).toEqual(['white', 'black', 'red', 'blue']);
  room.send('alice', { operation: 'bot', side: 'black' });
  room.send('alice', { operation: 'ready' });
  expect(customGameStartable(room.current())).toBe(false);
  const before = room.current();
  expect(room.send('alice', { operation: 'start' }).ok).toBe(false);
  expect(room.current()).toEqual(before);
  room.send('alice', { operation: 'bot', side: 'red' });
  room.send('alice', { operation: 'bot', side: 'blue' });
  room.send('alice', { operation: 'ready' });
  expect(customGameStartable(room.current())).toBe(true);
  expect(room.send('alice', { operation: 'start' }).ok).toBe(true);
});

test('ownership, stale inputs and terminal fencing use every declared seat', () => {
  const room = fourSeatRoom();
  room.fill();
  room.send('alice', { operation: 'start' });
  for (const [ply, actor] of [...PEOPLE, 'alice'].entries()) {
    const before = room.current();
    expect(
      room.send(PEOPLE[(ply + 1) % 4]!, {
        operation: 'move',
        uci: 'advance',
        ply,
      }).ok
    ).toBe(false);
    expect(room.current()).toEqual(before);
    expect(
      room.send(actor, { operation: 'move', uci: 'advance', ply }).ok
    ).toBe(true);
    const accepted = room.current();
    expect(
      room.send(actor, { operation: 'move', uci: 'advance', ply }).ok
    ).toBe(false);
    expect(room.current()).toEqual(accepted);
  }
  expect(room.current().status).toBe('completed');
  expect(room.current().outcome).toBe('white wins by finish line');
  const snapshot = room.current();
  expect(
    room.send('bob', { operation: 'move', uci: 'advance', ply: 5 }).ok
  ).toBe(false);
  expect(room.current()).toEqual(snapshot);
});

test('draw consent accumulates across all people and rematches rotate the full roster', () => {
  const room = fourSeatRoom();
  room.fill();
  room.send('alice', { operation: 'start' });
  room.send('alice', { operation: 'offer' });
  room.send('bob', { operation: 'agree' });
  room.send('carol', { operation: 'agree' });
  expect(room.current().status).toBe('active');
  room.send('dave', { operation: 'agree' });
  expect(room.current().outcome).toBe('draw');
  expect(room.send('alice', { operation: 'rematch' }).ok).toBe(true);
  expect(
    room.current().sides.map((side) => room.current()[side].person)
  ).toEqual(['dave', 'alice', 'bob', 'carol']);
  expect(room.current().ready).toEqual([]);
});

test('all clocks are initialized and multiplayer expiry or withdrawal records a draw', () => {
  const room = fourSeatRoom();
  room.fill();
  room.send('alice', { operation: 'clock', minutes: 1, increment: 0 });
  for (const person of PEOPLE) room.send(person, { operation: 'ready' });
  room.send('alice', { operation: 'start' });
  expect(room.current().remaining).toEqual({
    white: 60_000,
    black: 60_000,
    red: 60_000,
    blue: 60_000,
  });
  expect(room.expire(60_000).ok).toBe(true);
  expect(room.current()).toMatchObject({
    status: 'completed',
    outcome: 'draw',
    outcomeReason: 'timeout',
  });
  room.send('alice', { operation: 'rematch' }, 60_000);
  for (const person of PEOPLE)
    room.send(person, { operation: 'ready' }, 60_000);
  room.send('alice', { operation: 'start' }, 60_000);
  expect(room.send('carol', { operation: 'resign' }, 60_001).ok).toBe(true);
  expect(room.current()).toMatchObject({
    status: 'completed',
    outcome: 'draw',
    outcomeReason: 'participant withdrew',
  });
  expect(
    CustomGamesAttr.from(
      CustomGamesAttr({ current: room.current(), history: [] })
    ).current
  ).toEqual(room.current());
});
