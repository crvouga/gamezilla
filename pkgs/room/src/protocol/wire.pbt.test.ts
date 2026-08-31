import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';
import { ROOM_ERROR_TYPE } from '../types';
import {
  parseClientToServerWire,
  parseServerToClientWire,
  ROOM_WIRE_KIND,
  WIRE_VERSION,
} from './wire';

const arbMessageEnvelope = () =>
  fc.record({
    type: fc.constantFrom(
      'space-counter-cmd/increment',
      'space-counter-evt/counter-incremented'
    ),
    payload: fc.constant({}),
  });

const arbRoomActor = () =>
  fc.record({
    id: fc.stringMatching(/^[a-z][a-z0-9]{0,7}$/),
    clientId: fc.stringMatching(/^[a-z][a-z0-9]{0,7}$/),
  });

const arbLogEntry = () =>
  fc.record({
    seq: fc.integer({ min: 0, max: 10_000 }),
    event: arbMessageEnvelope(),
    actor: fc.option(arbRoomActor(), { nil: undefined }),
    ts: fc.option(fc.integer({ min: 0, max: 1e12 }), { nil: undefined }),
  });

const arbClientWire = () =>
  fc.oneof(
    fc.constant({ v: WIRE_VERSION, kind: ROOM_WIRE_KIND.ping }),
    fc.record({
      v: fc.constant(WIRE_VERSION),
      kind: fc.constant(ROOM_WIRE_KIND.sync),
      fromSeq: fc.integer({ min: 0, max: 10_000 }),
    }),
    fc.record({
      v: fc.constant(WIRE_VERSION),
      kind: fc.constant(ROOM_WIRE_KIND.command),
      id: fc.stringMatching(/^[a-z0-9-]{1,24}$/),
      ts: fc.integer({ min: 0, max: 1e12 }),
      payload: arbMessageEnvelope(),
    })
  );

const arbServerWire = () =>
  fc.oneof(
    fc.constant({ v: WIRE_VERSION, kind: ROOM_WIRE_KIND.pong }),
    fc.record({
      v: fc.constant(WIRE_VERSION),
      kind: fc.constant(ROOM_WIRE_KIND.welcome),
      fromSeq: fc.integer({ min: 0, max: 1000 }),
      lastSeq: fc.integer({ min: 0, max: 1000 }),
      entries: fc.array(arbLogEntry(), { maxLength: 4 }),
    }),
    fc.record({
      v: fc.constant(WIRE_VERSION),
      kind: fc.constant(ROOM_WIRE_KIND.committed),
      commandId: fc.option(fc.stringMatching(/^[a-z0-9-]{1,16}$/), {
        nil: undefined,
      }),
      entries: fc.array(arbLogEntry(), { minLength: 1, maxLength: 3 }),
    }),
    fc.record({
      v: fc.constant(WIRE_VERSION),
      kind: fc.constant(ROOM_WIRE_KIND.rejected),
      commandId: fc.stringMatching(/^[a-z0-9-]{1,16}$/),
      error: fc.constant({
        type: ROOM_ERROR_TYPE.invalidCommand,
        reason: 'x',
      }),
    }),
    fc.record({
      v: fc.constant(WIRE_VERSION),
      kind: fc.constant(ROOM_WIRE_KIND.roster),
      clients: fc.array(arbRoomActor(), { maxLength: 4 }),
    })
  );

describe('room wire parse properties', () => {
  test('valid client frames round-trip through JSON', () => {
    assertProperty(
      'parseClientToServerWire recovers JSON clone',
      fc.property(arbClientWire(), (frame) => {
        const cloned = JSON.parse(JSON.stringify(frame)) as unknown;
        const parsed = parseClientToServerWire(cloned);
        expect(parsed).not.toBeNull();
        expect(parsed as unknown).toEqual(cloned);
      })
    );
  });

  test('valid server frames round-trip through JSON', () => {
    assertProperty(
      'parseServerToClientWire recovers JSON clone',
      fc.property(arbServerWire(), (frame) => {
        const cloned = JSON.parse(JSON.stringify(frame)) as unknown;
        const parsed = parseServerToClientWire(cloned);
        expect(parsed).not.toBeNull();
        expect(parsed as unknown).toEqual(cloned);
      })
    );
  });

  test('unknown kind / version / garbage → null', () => {
    assertProperty(
      'parse rejects garbage',
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant('nope'),
          fc.constant(42),
          fc.constant({ v: 99, kind: ROOM_WIRE_KIND.ping }),
          fc.constant({ v: WIRE_VERSION, kind: 'nope' }),
          fc.constant({ v: WIRE_VERSION, kind: ROOM_WIRE_KIND.sync }),
          fc.constant({
            v: WIRE_VERSION,
            kind: ROOM_WIRE_KIND.command,
            id: '',
            ts: 1,
            payload: {},
          })
        ),
        (raw) => {
          expect(parseClientToServerWire(raw)).toBeNull();
          if (
            raw === null ||
            typeof raw !== 'object' ||
            Array.isArray(raw) ||
            raw === undefined
          ) {
            expect(parseServerToClientWire(raw)).toBeNull();
          }
        }
      )
    );
  });

  test('rate-limited error parses without reason', () => {
    const frame = {
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.rejected,
      commandId: 'c1',
      error: { type: ROOM_ERROR_TYPE.rateLimited },
    };
    expect(parseServerToClientWire(frame)).toEqual(frame);
  });
});
