import { expect, test } from 'bun:test';
import {
  SimulationStateChanged,
  SubmitSimulationInput,
} from '@libs/game-session-shared-ts/simulation-messages';
import { LightCyclesWireTap } from '@libs/light-cycles-harness-ts/light-cycles-wire-tap';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { ROOM_SERVER_ENDPOINT } from '@pkgs/room-root-harness-ts/network';
import { WIRE_VERSION } from '@pkgs/room-root-shared-ts/wire';
import fc from 'fast-check';

const bytesOf = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

const snapshot = (revision: number, state: string) => ({
  v: WIRE_VERSION,
  kind: 'signal' as const,
  payload: SimulationStateChanged({
    version: 1,
    epoch: 'game:1:0',
    revision,
    tick: revision * 2,
    paused: false,
    state,
    acknowledged: {},
  }),
});

test('per-connection accounting counts complete UTF-8 envelopes, excluding harness routing', () => {
  assertProperty(
    'Light Cycles wire accounting',
    fc.property(
      fc.array(fc.constantFrom('a', '🏍', 'é', '棋'), {
        minLength: 1,
        maxLength: 20,
      }),
      fc.integer({ min: 1, max: 20 }),
      (characters, copies) => {
        const wire = {
          v: WIRE_VERSION,
          kind: 'signal' as const,
          id: 'signal:1',
          ts: 1000,
          payload: SubmitSimulationInput({
            version: 1,
            epoch: characters.join(''),
            playerId: 'white',
            sequence: 1,
            tick: 1,
            value: { round: 1, heading: 'up' },
          }),
        };
        const tap = new LightCyclesWireTap(() => 0);
        for (let i = 0; i < copies; i++)
          tap.record('room:client:alice', ROOM_SERVER_ENDPOINT, {
            identity: 'not transmitted',
            connectionId: `connection-${i % 2}`,
            payload: wire,
          });
        expect(tap.read().connections['alice']!.up).toEqual({
          frames: copies,
          bytes: bytesOf(wire) * copies,
          maxFrameBytes: bytesOf(wire),
        });
        expect(tap.inputs).toHaveLength(copies);
        expect(tap.connectionIds.get('alice')!.size).toBe(Math.min(2, copies));
        tap.resetTraffic();
        expect(tap.read().connections).toEqual({});
        expect(tap.inputs).toHaveLength(copies);
      }
    )
  );
});

test('one publication fanned out to several devices is one emission, many deliveries', () => {
  const tap = new LightCyclesWireTap(() => 42);
  const wire = snapshot(7, 'arena-🏍');
  for (const id of ['alice', 'bob', 'erin'])
    tap.record(ROOM_SERVER_ENDPOINT, `room:client:${id}`, wire);
  tap.record(ROOM_SERVER_ENDPOINT, 'room:client:bob', snapshot(8, 'later'));
  expect(tap.emissions.map((e) => [e.revision, e.recipients, e.atMs])).toEqual([
    [7, 3, 42],
    [8, 1, 42],
  ]);
  expect(tap.read().publications.frames).toBe(2);
  expect(tap.read().snapshots).toEqual({
    frames: 4,
    bytes: bytesOf(wire) * 3 + bytesOf(snapshot(8, 'later')),
    maxFrameBytes: bytesOf(wire),
  });
  expect(tap.lastSentTo('alice')?.revision).toBe(7);
  expect(tap.lastSentTo('bob')?.revision).toBe(8);
  expect(tap.latest()?.revision).toBe(8);
});

test('refusals and welcomes are counted per device', () => {
  const tap = new LightCyclesWireTap(() => 0);
  tap.record(ROOM_SERVER_ENDPOINT, 'room:client:erin', {
    v: WIRE_VERSION,
    kind: 'rejected',
    commandId: 'signal:9',
    error: {
      type: 'room.error/unauthorized',
      reason: 'only the player controls this side',
    },
  });
  for (let i = 0; i < 2; i++)
    tap.record(ROOM_SERVER_ENDPOINT, 'room:client:dave', {
      v: WIRE_VERSION,
      kind: 'welcome',
      fromSeq: 0,
      lastSeq: 0,
      entries: [],
    });
  expect(tap.rejections).toEqual([
    {
      client: 'erin',
      commandId: 'signal:9',
      reason: 'only the player controls this side',
    },
  ]);
  expect(tap.welcomes.get('dave')).toBe(2);
});
