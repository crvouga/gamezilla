import { expect, test } from 'bun:test';
import { orderedNetwork } from '@libs/light-cycles-harness-ts/light-cycles-ordered-network';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { ROOM_VIRTUAL_RUNTIME } from '@pkgs/room-root-harness-ts/boot';
import fc from 'fast-check';

type Link = {
  readonly session: Session;
  readonly network: ReturnType<typeof orderedNetwork>;
  readonly received: Map<string, number[]>;
  readonly tapped: number[];
};

const links = defineSystem({
  name: 'light-cycles-ordered-links',
  runtimes: [ROOM_VIRTUAL_RUNTIME],
  create: (session: Session): Link => {
    const tapped: number[] = [];
    const network = orderedNetwork(session, (_from, _to, payload) =>
      tapped.push(payload as number)
    );
    const received = new Map<string, number[]>();
    for (const id of ['a', 'b']) {
      received.set(id, []);
      network.register(id, (payload) => {
        received.get(id)!.push(payload as number);
      });
    }
    return { session, network, received, tapped };
  },
});

const sendBursts = defineAction({
  name: 'sendBursts',
  act: async (
    link: Link,
    plan: {
      readonly latency: number;
      readonly jitter: number;
      readonly gaps: readonly number[];
    }
  ) => {
    link.network.setFaults(
      { latencyMeanMs: plan.latency, latencyJitterMs: plan.jitter },
      'to-a'
    );
    const scheduler = link.session.scheduler.underlying;
    for (const [index, gap] of plan.gaps.entries()) {
      link.network.send('server', 'a', index, { key: 'to-a' });
      link.network.send('server', 'b', index, { key: 'to-b' });
      await scheduler.runFor(gap);
    }
    await scheduler.runFor(plan.latency + plan.jitter + 1);
  },
});

test('every frame on a connection arrives once and in order, whatever its latency and jitter', async () => {
  await assertProperty(
    'ordered links',
    fc.asyncProperty(
      fc.integer({ min: 1, max: 1_000_000 }),
      fc.record({
        latency: fc.integer({ min: 0, max: 150 }),
        jitter: fc.integer({ min: 0, max: 80 }),
        gaps: fc.array(fc.integer({ min: 0, max: 30 }), {
          minLength: 1,
          maxLength: 40,
        }),
      }),
      async (seed, plan) => {
        await using run = await links.run({ seed });
        await run.apply(sendBursts, plan);
        const seen = await run.read((link: Link) => ({
          a: link.received.get('a')!,
          b: link.received.get('b')!,
          tapped: link.tapped.length,
          queued: link.network.queued(),
        }));
        const sent = plan.gaps.map((_, index) => index);
        expect(seen).toEqual({
          a: sent,
          b: sent,
          tapped: 2 * sent.length,
          queued: 0,
        });
      }
    )
  );
});

test('a held flow waits, an interrupted connection loses what was in flight, and unordered faults are refused', async () => {
  await using run = await links.run({ seed: 5 });
  const seen = await run.read(async (link: Link) => {
    const scheduler = link.session.scheduler.underlying;
    link.network.hold('to-a');
    link.network.send('server', 'a', 1, { key: 'to-a' });
    await scheduler.runFor(50);
    const whileHeld = [...link.received.get('a')!];
    link.network.release('to-a');
    await scheduler.runFor(0);
    link.network.setFaults({ latencyMeanMs: 20 }, 'to-b');
    link.network.send('server', 'b', 2, { key: 'to-b' });
    link.network.partition('server', 'b');
    await scheduler.runFor(50);
    return {
      whileHeld,
      a: link.received.get('a')!,
      b: link.received.get('b')!,
      inFlight: link.network.inFlight(),
    };
  });
  expect(seen).toEqual({ whileHeld: [], a: [1], b: [], inFlight: 0 });
  await run.read((link: Link) => {
    for (const fault of [
      { dropProbability: 0.1 },
      { duplicateProbability: 0.1 },
      { reorderWindowMs: 20 },
    ])
      expect(() => link.network.setFaults(fault)).toThrow(
        'an ordered connection'
      );
  });
});
