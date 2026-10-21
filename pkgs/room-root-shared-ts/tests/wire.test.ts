import { describe, expect, test } from 'bun:test';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';
import {
  parseClientToServerWire,
  parseServerToClientWire,
  ROOM_WIRE_KIND,
  WIRE_VERSION,
} from '@pkgs/room-root-shared-ts/wire';

const entry = {
  seq: 1,
  event: { type: 'cursor-evt/moved', payload: { id: 'a', x: 1, y: 2 } },
  actor: { id: 'a', clientId: 'c1' },
  ts: 5,
};

describe('wire parsing', () => {
  test('client → server frames round-trip and reject garbage', () => {
    expect(parseClientToServerWire({ v: WIRE_VERSION, kind: 'ping' })).toEqual({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.ping,
    });
    expect(
      parseClientToServerWire({ v: WIRE_VERSION, kind: 'sync', fromSeq: 3.7 })
    ).toEqual({ v: WIRE_VERSION, kind: ROOM_WIRE_KIND.sync, fromSeq: 3 });
    expect(
      parseClientToServerWire({ v: WIRE_VERSION, kind: 'sync', fromSeq: -1 })
    ).toBeNull();
    const cmd = {
      v: WIRE_VERSION,
      kind: 'command',
      id: 'c',
      ts: 1,
      payload: 'anything',
    };
    expect(parseClientToServerWire(cmd)).toEqual(cmd as never);
    expect(parseClientToServerWire({ v: 2, kind: 'ping' })).toBeNull();
    expect(parseClientToServerWire('nope')).toBeNull();
    expect(
      parseClientToServerWire({ v: WIRE_VERSION, kind: 'other' })
    ).toBeNull();
  });

  test('server → client frames validate entries, errors, roster', () => {
    const committed = {
      v: WIRE_VERSION,
      kind: 'committed',
      commandId: 'x',
      entries: [entry],
    };
    expect(parseServerToClientWire(committed)).toEqual(committed as never);
    expect(parseServerToClientWire({ ...committed, commandId: '' })).toEqual({
      v: WIRE_VERSION,
      kind: 'committed',
      entries: [entry],
    } as never);
    expect(
      parseServerToClientWire({
        ...committed,
        entries: [{ ...entry, event: { type: 'no-slash', payload: 1 } }],
      })
    ).toBeNull();
    expect(
      parseServerToClientWire({
        v: WIRE_VERSION,
        kind: 'rejected',
        commandId: 'x',
        error: { type: ROOM_ERROR_TYPE.rateLimited },
      })
    ).not.toBeNull();
    expect(
      parseServerToClientWire({
        v: WIRE_VERSION,
        kind: 'rejected',
        commandId: 'x',
        error: { type: ROOM_ERROR_TYPE.conflict },
      })
    ).toBeNull();
    expect(
      parseServerToClientWire({
        v: WIRE_VERSION,
        kind: 'rejected',
        commandId: 'x',
        error: { type: ROOM_ERROR_TYPE.internal },
      })
    ).not.toBeNull();
    expect(
      parseServerToClientWire({
        v: WIRE_VERSION,
        kind: 'roster',
        clients: [{ id: 'a', clientId: '' }],
      })
    ).toBeNull();
    expect(
      parseServerToClientWire({
        v: WIRE_VERSION,
        kind: 'welcome',
        fromSeq: 0,
        lastSeq: 1,
        entries: [entry],
      })
    ).not.toBeNull();
  });
});
