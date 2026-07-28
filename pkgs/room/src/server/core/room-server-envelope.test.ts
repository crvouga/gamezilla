import { describe, expect, it } from 'bun:test';

import { newCommandId } from '../../protocol/ids';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '../../protocol/wire';
import { TestCounterModule } from '../../testkit/counter-module';
import { ROOM_ERROR_TYPE } from '../../types';
import { InMemoryRoomStorage } from '../adapters/memory';
import { RoomServer } from './room-server';

describe('RoomServer message envelope', () => {
  it('rejects command payload that is not a wire-valid Message envelope', async () => {
    const storage = new InMemoryRoomStorage();
    const server = new RoomServer({
      topic: 't-env',
      module: TestCounterModule,
      storage,
    });
    await server.hydrateFromStorage();
    const out: unknown[] = [];
    server.registerConnection(
      'c1',
      (msg) => {
        out.push(msg);
      },
      { id: 'user', clientId: 'c1-client' }
    );
    const commandId = newCommandId();
    await server.handleClientMessage('c1', 'user', {
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.command,
      id: commandId,
      ts: Date.now(),
      payload: { foo: 1 },
    });
    const rejected = out.filter(
      (f) =>
        typeof f === 'object' &&
        f !== null &&
        (f as { kind?: string }).kind === ROOM_WIRE_KIND.rejected
    );
    expect(rejected.length).toBe(1);
    const frame = rejected[0] as {
      kind: string;
      commandId: string;
      error?: { type: string; reason: string };
    };
    expect(frame.kind).toBe(ROOM_WIRE_KIND.rejected);
    expect(frame.commandId).toBe(commandId);
    expect(frame.error?.type).toBe(ROOM_ERROR_TYPE.invalidCommand);
    expect(frame.error?.reason).toBe('not a valid message envelope');
  });
});
