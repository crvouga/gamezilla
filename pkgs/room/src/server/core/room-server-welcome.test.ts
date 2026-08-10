import { describe, expect, it } from 'bun:test';
import { wallIo } from '@pkgs/io';

import { ROOM_WIRE_KIND, WIRE_VERSION } from '../../protocol/wire';
import {
  Increment,
  TestCounterModule,
} from '../../tests/fixtures/counter-module';
import type { LogEntry } from '../../types';
import { InMemoryRoomStorage } from '../adapters/memory/storage';
import { RoomServer } from './room-server';
import type { CommandDedupOutcome, RoomStorage } from './storage';

const io = wallIo();
const timers = io.timers;

/**
 * Simulates storage where `getLastSeq` disagrees with the event log read
 * (e.g. parallel KV reads returning inconsistent snapshots). The client
 * asserts `welcome.lastSeq` matches the tail seq of applied `entries`.
 */
class BrokenGetLastSeqStorage implements RoomStorage {
  constructor(private readonly inner: InMemoryRoomStorage) {}

  loadEventsAfter(topic: string, afterSeq: number): Promise<LogEntry[]> {
    return this.inner.loadEventsAfter(topic, afterSeq);
  }

  getLastSeq(_topic: string): Promise<number> {
    return Promise.resolve(0);
  }

  appendCommittedEntries(topic: string, entries: LogEntry[]): Promise<void> {
    return this.inner.appendCommittedEntries(topic, entries);
  }

  getDedupOutcome(
    topic: string,
    commandId: string
  ): Promise<CommandDedupOutcome | null> {
    return this.inner.getDedupOutcome(topic, commandId);
  }

  putDedupOutcome(
    topic: string,
    commandId: string,
    outcome: CommandDedupOutcome
  ): Promise<void> {
    return this.inner.putDedupOutcome(topic, commandId, outcome);
  }
}

describe('RoomServer welcome lastSeq', () => {
  it('matches tail seq of entries even when getLastSeq is wrong', async () => {
    const storage = new BrokenGetLastSeqStorage(new InMemoryRoomStorage());
    const server = new RoomServer({
      topic: 't-welcome-seq',
      module: TestCounterModule,
      storage,
      clock: io.clock,
    });
    await server.hydrateFromStorage();

    const out: unknown[] = [];
    server.registerConnection(
      'c1',
      (msg) => {
        out.push(msg);
      },
      { id: 'u1', clientId: 'c1-client' }
    );

    await server.handleClientMessage('c1', 'u1', {
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.sync,
      fromSeq: 0,
    });
    await new Promise<void>((r) => timers.setTimeout(r, 5));

    await server.handleClientMessage('c1', 'u1', {
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.command,
      id: 'cmd-1',
      ts: 1,
      payload: Increment({}),
    });
    await new Promise<void>((r) => timers.setTimeout(r, 5));

    await server.handleClientMessage('c1', 'u1', {
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.sync,
      fromSeq: 0,
    });
    await new Promise<void>((r) => timers.setTimeout(r, 5));

    const welcomes = out.filter(
      (m): m is { kind: string; lastSeq?: number; entries?: LogEntry[] } =>
        typeof m === 'object' &&
        m !== null &&
        (m as { kind?: string }).kind === ROOM_WIRE_KIND.welcome
    );
    const lastWelcome = welcomes[welcomes.length - 1];
    expect(lastWelcome).toBeDefined();
    expect(lastWelcome!.entries?.length).toBe(1);
    expect(lastWelcome!.lastSeq).toBe(1);
  });
});
