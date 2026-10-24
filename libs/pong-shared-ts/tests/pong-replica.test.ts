import { expect, test } from 'bun:test';
import {
  SimulationStateChanged,
  SubmitSimulationInput,
} from '@libs/game-session-shared-ts/simulation-messages';
import { SimulationReplica } from '@libs/game-session-shared-ts/simulation-replica';
import {
  pongGameShared,
  pongPositionCodec,
} from '@libs/pong-shared-ts/pong-game';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { Message } from '@pkgs/message-shared-ts/message';

function replica() {
  const time = createHarnessClock();
  const sent: Message[] = [];
  const measures: Parameters<
    ConstructorParameters<typeof SimulationReplica>[0]['measure']
  >[0][] = [];
  const simulation = pongGameShared.registration.simulation!;
  const state = simulation.initialize('replica');
  const initial = SimulationStateChanged({
    version: 1,
    epoch: 'game:1:0',
    revision: 1,
    tick: 10,
    paused: false,
    state: pongPositionCodec.encode(
      state as Parameters<typeof pongPositionCodec.encode>[0]
    ),
    acknowledged: {},
  });
  const client = new SimulationReplica({
    simulation,
    clock: time.clock,
    send: (message) => {
      sent.push(message);
      return String(sent.length);
    },
    measure: (sample) => measures.push(sample),
  });
  const sample = () =>
    client.sample() as Parameters<typeof pongPositionCodec.encode>[0];
  return { ...time, client, sent, initial, sample, measures };
}

test('selective prediction responds before a snapshot while the ball, score and opponent remain authoritative', () => {
  const rig = replica();
  expect(rig.client.receive(rig.initial, 'game:1:0')).toBe(true);
  const before = rig.sample();
  rig.client.control('white', { kind: 'direction', direction: 1 });
  rig.client.pump();
  expect(rig.sample().paddles.left.y).toBeGreaterThan(before.paddles.left.y);
  expect(rig.sample().paddles.right).toEqual(before.paddles.right);
  expect(rig.sample().ball).toEqual(before.ball);
  expect(rig.sample().score).toEqual(before.score);
  expect(SubmitSimulationInput.is(rig.sent[0]!)).toBe(true);
  const corrected = {
    ...before,
    paddles: { ...before.paddles, left: { ...before.paddles.left, y: 410 } },
  };
  expect(
    rig.client.receive(
      SimulationStateChanged({
        ...rig.initial.payload,
        revision: 2,
        tick: 13,
        acknowledged: { white: 1 },
        state: pongPositionCodec.encode(corrected),
      }),
      'game:1:0'
    )
  ).toBe(true);
  expect(rig.sample().paddles.left.y).toBe(410);
  expect(rig.sample().ball).toEqual(before.ball);
});

test('stale delivery and a reconnect fence cannot rewind presentation or resend held old controls', () => {
  const rig = replica();
  rig.client.receive(rig.initial, 'game:1:0');
  rig.client.control('white', { kind: 'direction', direction: 1 });
  rig.client.pump();
  rig.clock.advance(1100);
  rig.client.pump();
  expect(rig.sent).toHaveLength(1);
  expect(rig.client.isStale()).toBe(true);
  expect(rig.client.receive(rig.initial, 'game:1:0')).toBe(false);
  const resumed = SimulationStateChanged({
    ...rig.initial.payload,
    epoch: 'game:1:2',
    revision: 5,
  });
  expect(rig.client.receive(resumed, 'game:1:2')).toBe(true);
  expect(rig.client.receive(rig.initial, 'game:1:2')).toBe(false);
  rig.client.pump();
  expect(rig.sent).toHaveLength(1);
  expect(rig.sample()).toEqual(
    pongPositionCodec.decode(rig.initial.payload.state)!
  );
});

test('input acknowledgment timing uses the client clock and counts each input once', () => {
  // regression: simulation-input-ack-timing-unreported
  const rig = replica();
  rig.client.receive(rig.initial, 'game:1:0');
  rig.clock.advance(37);
  rig.client.control('white', { kind: 'direction', direction: 1 });
  rig.client.pump();
  rig.clock.advance(63);
  const acknowledged = SimulationStateChanged({
    ...rig.initial.payload,
    revision: 2,
    tick: 13,
    acknowledged: { white: 1 },
  });
  expect(rig.client.receive(acknowledged, 'game:1:0')).toBe(true);
  expect(rig.measures.at(-1)).toMatchObject({ acknowledgmentMs: [63] });
  rig.clock.advance(10);
  rig.client.receive(
    SimulationStateChanged({ ...acknowledged.payload, revision: 3 }),
    'game:1:0'
  );
  expect(rig.measures.at(-1)).toMatchObject({ acknowledgmentMs: [] });
});

test.each(['reset', 'epoch', 'pause'] as const)(
  '%s discards old input acknowledgment timing',
  (change) => {
    const rig = replica();
    rig.client.receive(rig.initial, 'game:1:0');
    rig.client.control('white', { kind: 'direction', direction: 1 });
    rig.client.pump();
    rig.clock.advance(63);
    if (change === 'reset') rig.client.reset();
    const epoch = change === 'epoch' ? 'game:1:2' : 'game:1:0';
    rig.client.receive(
      SimulationStateChanged({
        ...rig.initial.payload,
        epoch,
        revision: 2,
        tick: 13,
        paused: change === 'pause',
        acknowledged: { white: 1 },
      }),
      epoch
    );
    expect(rig.measures.at(-1)).toMatchObject({ acknowledgmentMs: [] });
  }
);
