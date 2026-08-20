import { describe, expect, it } from 'bun:test';
import { wallClock, wallTimers } from '@pkgs/clock';
import { asKeyword } from '@pkgs/keyword';

import { ROOM_WIRE_KIND } from './protocol/wire';
import { Increment, TestCounterModule } from './tests/fixtures/counter-module';
import { openLoopbackRoom } from './tests/harness/simulator';

const now = wallClock.now;
const timers = wallTimers;

describe('room roster + actor metadata', () => {
  it('grows and shrinks the roster on connect/disconnect', async () => {
    const a = await openLoopbackRoom({
      clock: wallClock,
      timers: wallTimers,
      createId: () => crypto.randomUUID(),
      topic: 't-roster',
      module: TestCounterModule,
      identity: 'alice',
      clientId: 'alice-tab-1',
      connectionId: 'conn-a',
    });
    await a.room.untilSynced();

    expect(a.room.getRoster()).toEqual([
      { id: 'alice', clientId: 'alice-tab-1' },
    ]);
    expect(a.server.getRoster()).toEqual([
      { id: 'alice', clientId: 'alice-tab-1' },
    ]);

    const b = await openLoopbackRoom({
      clock: wallClock,
      timers: wallTimers,
      createId: () => crypto.randomUUID(),
      topic: 't-roster',
      module: TestCounterModule,
      identity: 'bob',
      clientId: 'bob-tab-1',
      connectionId: 'conn-b',
      server: a.server,
    });
    await b.room.untilSynced();

    // Both clients converge on the two-actor roster.
    await new Promise<void>((r) => timers.setTimeout(r, 10));
    expect(a.room.getRoster()).toHaveLength(2);
    expect(b.room.getRoster()).toHaveLength(2);

    a.server.unregisterConnection('conn-a');
    await new Promise<void>((r) => timers.setTimeout(r, 10));
    expect(b.room.getRoster()).toEqual([{ id: 'bob', clientId: 'bob-tab-1' }]);

    a.room.destroy();
    b.room.destroy();
  });

  it('lists two clients for the same actor id', async () => {
    const a = await openLoopbackRoom({
      clock: wallClock,
      timers: wallTimers,
      createId: () => crypto.randomUUID(),
      topic: 't-multi-tab',
      module: TestCounterModule,
      identity: 'alice',
      clientId: 'alice-tab-1',
      connectionId: 'conn-a1',
    });
    await a.room.untilSynced();

    const a2 = await openLoopbackRoom({
      clock: wallClock,
      timers: wallTimers,
      createId: () => crypto.randomUUID(),
      topic: 't-multi-tab',
      module: TestCounterModule,
      identity: 'alice',
      clientId: 'alice-tab-2',
      connectionId: 'conn-a2',
      server: a.server,
    });
    await a2.room.untilSynced();
    await new Promise<void>((r) => timers.setTimeout(r, 10));

    const roster = a.room.getRoster();
    expect(roster).toHaveLength(2);
    expect(roster.every((c) => c.id === 'alice')).toBe(true);
    expect(new Set(roster.map((c) => c.clientId))).toEqual(
      new Set(['alice-tab-1', 'alice-tab-2'])
    );

    a.room.destroy();
    a2.room.destroy();
  });

  it('stamps actor + ts on committed log entries', async () => {
    const { room, server } = await openLoopbackRoom({
      clock: wallClock,
      timers: wallTimers,
      createId: () => crypto.randomUUID(),
      topic: 't-actor-meta',
      module: TestCounterModule,
      identity: 'alice',
      clientId: 'alice-tab-1',
      connectionId: 'conn-meta',
    });
    await room.untilSynced();
    const before = now();
    room.dispatch(Increment({}));
    await new Promise<void>((r) => timers.setTimeout(r, 30));

    const log = room.getLog();
    expect(log.length).toBeGreaterThanOrEqual(1);
    const last = log[log.length - 1]!;
    expect(last.actor).toEqual({ id: 'alice', clientId: 'alice-tab-1' });
    expect(typeof last.ts).toBe('number');
    expect(last.ts!).toBeGreaterThanOrEqual(before);
    expect(last.event.type).toBe(
      asKeyword('space-counter-evt/counter-incremented')
    );

    // Server roster frame kind is wired.
    expect(ROOM_WIRE_KIND.roster).toBe('roster');
    expect(server.getRoster()[0]?.clientId).toBe('alice-tab-1');

    room.destroy();
  });
});
