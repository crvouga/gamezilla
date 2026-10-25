import { expect, test } from 'bun:test';
import { SimulationCommandOutbox } from '@libs/game-session-shared-ts/simulation-command-outbox';
import {
  type SimulationInputPayload,
  SimulationStateChanged,
  SubmitSimulationInput,
} from '@libs/game-session-shared-ts/simulation-messages';
import { SimulationReplica } from '@libs/game-session-shared-ts/simulation-replica';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { Message } from '@pkgs/message-shared-ts/message';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { arenaCodec, arenaSimulation } from './reference-arena-game';

function commandReplica() {
  const time = createHarnessClock();
  const sent: SimulationInputPayload[] = [];
  const replica = new SimulationReplica({
    simulation: arenaSimulation,
    clock: time.clock,
    send: (message: Message) => {
      if (SubmitSimulationInput.is(message)) sent.push(message.payload);
      return 'sent';
    },
    measure: () => {},
  });
  let revision = 0;
  const receive = (
    tick: number,
    options: {
      round?: number;
      acknowledged?: Record<string, number>;
      epoch?: string;
    } = {}
  ) =>
    replica.receive(
      SimulationStateChanged({
        version: 1,
        epoch: options.epoch ?? 'arena:1',
        revision: ++revision,
        tick,
        paused: false,
        state: arenaCodec.encode({
          round: options.round ?? 1,
          ticks: tick,
          log: [],
          retired: [],
        }),
        acknowledged: options.acknowledged ?? {},
      }),
      options.epoch ?? 'arena:1'
    );
  return { time, sent, replica, receive };
}

test('each command is sent once, immediately, in order, with the latest authoritative tick as its basis', () => {
  const { sent, replica, receive } = commandReplica();
  receive(12);
  expect(replica.control('white', { round: 1, turn: 'left' })).toBe(true);
  expect(replica.control('white', { round: 1, turn: 'right' })).toBe(true);
  replica.pump();
  expect(
    sent.map(({ sequence, tick, value }) => ({ sequence, tick, value }))
  ).toEqual([
    { sequence: 1, tick: 12, value: { round: 1, turn: 'left' } },
    { sequence: 2, tick: 12, value: { round: 1, turn: 'right' } },
  ]);
});

test('outstanding commands are bounded until the authority answers them', () => {
  const { sent, replica, receive } = commandReplica();
  receive(1);
  for (let index = 0; index < 6; index++)
    replica.control('white', { round: 1, turn: 'left' });
  expect(sent).toHaveLength(4);
  receive(2, { acknowledged: { white: 3 } });
  expect(replica.control('white', { round: 1, turn: 'left' })).toBe(true);
  expect(sent.at(-1)!.sequence).toBe(5);
});

test('a new round abandons outstanding commands; a new epoch restarts sequences from its acknowledgments', () => {
  const { sent, replica, receive } = commandReplica();
  receive(1);
  for (let index = 0; index < 4; index++)
    replica.control('white', { round: 1, turn: 'left' });
  receive(31, { round: 2 });
  expect(replica.control('white', { round: 2, turn: 'left' })).toBe(true);
  expect(sent.at(-1)!.sequence).toBe(5);
  receive(0, { epoch: 'arena:2', acknowledged: { white: 9 } });
  expect(replica.control('white', { round: 1, turn: 'left' })).toBe(true);
  expect(sent.at(-1)).toMatchObject({ epoch: 'arena:2', sequence: 10 });
});

test('a stale or reset replica sends nothing', () => {
  const { time, sent, replica, receive } = commandReplica();
  expect(replica.control('white', { round: 1, turn: 'left' })).toBe(false);
  receive(1);
  time.clock.advance(1500);
  expect(replica.control('white', { round: 1, turn: 'left' })).toBe(false);
  replica.reset();
  expect(replica.control('white', { round: 1, turn: 'left' })).toBe(false);
  expect(sent).toEqual([]);
});

test('sequences stay strictly increasing and outstanding stays bounded under any answer order', () => {
  assertProperty(
    'command outbox',
    fc.property(
      fc.array(
        fc.oneof(
          fc.constant({ kind: 'send' as const }),
          fc.record({
            kind: fc.constant('ack' as const),
            upTo: fc.nat(40),
            round: fc.integer({ min: 1, max: 3 }),
          })
        ),
        { maxLength: 60 }
      ),
      (steps) => {
        const outbox = new SimulationCommandOutbox(4);
        let last = 0;
        let acknowledged = 0;
        for (const step of steps) {
          if (step.kind === 'send') {
            const sequence = outbox.next('white', acknowledged);
            if (sequence !== null) {
              expect(sequence).toBeGreaterThan(last);
              last = sequence;
            }
          } else {
            acknowledged = Math.max(acknowledged, Math.min(step.upTo, last));
            outbox.acknowledge({ white: acknowledged }, step.round);
          }
          expect(outbox.outstanding()).toBeLessThanOrEqual(4);
        }
      }
    )
  );
});
