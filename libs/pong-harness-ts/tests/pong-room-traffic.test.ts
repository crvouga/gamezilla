import { expect, test } from 'bun:test';
import {
  SimulationStateChanged,
  SubmitSimulationInput,
} from '@libs/game-session-shared-ts/simulation-messages';
import { PongRoomTraffic } from '@libs/pong-harness-ts/pong-room-traffic';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { ROOM_SERVER_ENDPOINT } from '@pkgs/room-root-harness-ts/network';
import { WIRE_VERSION } from '@pkgs/room-root-shared-ts/wire';
import fc from 'fast-check';

test('wire accounting counts complete UTF8 envelopes and each delivery, excluding harness-only routing', () => {
  assertProperty(
    'Pong wire accounting',
    fc.property(
      fc.array(fc.constantFrom('a', '🦦', 'é', '棋'), {
        minLength: 1,
        maxLength: 20,
      }),
      fc.integer({ min: 1, max: 20 }),
      (characters, copies) => {
        const wire = {
          v: WIRE_VERSION,
          kind: 'signal' as const,
          id: 'control-1',
          ts: 1000,
          payload: SubmitSimulationInput({
            version: 1,
            epoch: characters.join(''),
            playerId: 'white',
            sequence: 1,
            tick: 1,
            value: { kind: 'target', target: 0.5 },
          }),
        };
        const bytes = new TextEncoder().encode(JSON.stringify(wire)).byteLength;
        const traffic = new PongRoomTraffic();
        for (let i = 0; i < copies; i++)
          traffic.record('room:client:alice', {
            identity: 'not transmitted',
            connectionId: 'not transmitted',
            payload: wire,
          });
        expect(traffic.read().uplink).toEqual({
          frames: copies,
          bytes: bytes * copies,
          maxFrameBytes: bytes,
        });
        expect(traffic.read().inputs).toEqual(traffic.read().uplink);
        const down = { v: WIRE_VERSION, kind: 'roster' as const, clients: [] };
        const downBytes = new TextEncoder().encode(
          JSON.stringify(down)
        ).byteLength;
        for (let i = 0; i < copies; i++)
          traffic.record(ROOM_SERVER_ENDPOINT, down);
        expect(traffic.read().downlink).toEqual({
          frames: copies,
          bytes: downBytes * copies,
          maxFrameBytes: downBytes,
        });
        traffic.reset();
        for (const tally of Object.values(traffic.read()))
          expect(tally).toEqual({ frames: 0, bytes: 0, maxFrameBytes: 0 });
      }
    )
  );
});

test('snapshot publication bytes count once per shared wire object and delivery bytes count every recipient', () => {
  const wire = {
    v: WIRE_VERSION,
    kind: 'signal' as const,
    payload: SimulationStateChanged({
      version: 1,
      epoch: 'round-🦦',
      revision: 1,
      tick: 1,
      paused: false,
      state: '{}',
      acknowledged: {},
    }),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(wire)).byteLength;
  const traffic = new PongRoomTraffic();
  for (let i = 0; i < 4; i++) traffic.record(ROOM_SERVER_ENDPOINT, wire);
  expect(traffic.read().snapshots.bytes).toBe(bytes * 4);
  expect(traffic.read().snapshotPublications).toEqual({
    frames: 1,
    bytes,
    maxFrameBytes: bytes,
  });
  traffic.reset();
  traffic.record(ROOM_SERVER_ENDPOINT, wire);
  expect(traffic.read().snapshotPublications).toEqual({
    frames: 1,
    bytes,
    maxFrameBytes: bytes,
  });
});
