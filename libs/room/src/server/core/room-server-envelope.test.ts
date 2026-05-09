import { describe, expect, it } from 'bun:test';

import { newCommandId } from '../../protocol/ids';
import { WIRE_VERSION } from '../../protocol/wire';
import { TestCounterModule } from '../../testkit/counter-module';
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
    server.registerConnection('c1', (msg) => {
      out.push(msg);
    });
    const commandId = newCommandId();
    await server.handleClientMessage('c1', 'user', {
      v: WIRE_VERSION,
      kind: 'command',
      id: commandId,
      ts: Date.now(),
      payload: { foo: 1 },
    });
    expect(out.length).toBe(1);
    const frame = out[0] as {
      kind: string;
      commandId: string;
      error?: { type: string; reason: string };
    };
    expect(frame.kind).toBe('rejected');
    expect(frame.commandId).toBe(commandId);
    expect(frame.error?.type).toBe('invalid_command');
    expect(frame.error?.reason).toBe('not a valid message envelope');
  });
});
