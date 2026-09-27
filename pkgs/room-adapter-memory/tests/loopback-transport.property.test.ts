import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/property';
import {
  type LoopbackRoomHost,
  LoopbackRoomTransport,
} from '@pkgs/room-adapter-memory';

/** One outbound frame: how long the host takes (microtask yields) and whether it throws. */
type Frame = {
  readonly id: number;
  readonly yields: number;
  readonly fails: boolean;
};

async function yieldTimes(n: number): Promise<void> {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

function createHost(frames: readonly Frame[]) {
  const log: string[] = [];
  const registered = new Map<string, (payload: unknown) => void>();
  let active = 0;
  let maxActive = 0;
  const host: LoopbackRoomHost = {
    registerConnection: (id, send) => {
      registered.set(id, send);
    },
    unregisterConnection: (id) => {
      registered.delete(id);
    },
    handleClientMessage: async (_conn, _identity, raw) => {
      const frame = frames[raw as number]!;
      active += 1;
      maxActive = Math.max(maxActive, active);
      log.push(`start:${frame.id}`);
      await yieldTimes(frame.yields);
      log.push(`end:${frame.id}`);
      active -= 1;
      if (frame.fails) throw new Error(`host:${frame.id}`);
      registered.get('conn')?.({ echo: frame.id });
    },
  };
  return { host, log, registered, maxActive: () => maxActive };
}

const arbFrames = fc
  .array(fc.record({ yields: fc.nat({ max: 4 }), fails: fc.boolean() }), {
    maxLength: 8,
  })
  .map((fs) => fs.map((f, id): Frame => ({ ...f, id })));

describe('LoopbackRoomTransport properties', () => {
  test('sends are serialized in order; failures surface via onError without stalling the chain', async () => {
    await assertProperty(
      'send serialization',
      fc.asyncProperty(arbFrames, async (frames) => {
        const h = createHost(frames);
        const t = new LoopbackRoomTransport({
          server: h.host,
          connectionId: 'conn',
          identity: 'user-1',
          clientId: 'client-1',
        });
        const received: unknown[] = [];
        const errors: string[] = [];
        let opens = 0;
        t.subscribe((raw) => received.push(raw));
        t.onHandlers({
          onOpen: () => {
            opens += 1;
          },
          onError: (e) => errors.push((e as Error).message),
        });
        await t.connect();
        await t.connect();
        expect(opens).toBe(2);
        expect(t.isConnected).toBe(true);
        expect([...h.registered.keys()]).toEqual(['conn']);

        frames.forEach((f) => {
          t.sendJson(f.id);
        });
        // Drain microtasks until every frame has been answered or reported (bounded).
        for (
          let i = 0;
          i < 1000 && received.length + errors.length < frames.length;
          i++
        ) {
          await Promise.resolve();
        }

        expect(h.log).toEqual(
          frames.flatMap((f) => [`start:${f.id}`, `end:${f.id}`])
        );
        expect(h.maxActive()).toBeLessThanOrEqual(1);
        expect(errors).toEqual(
          frames.filter((f) => f.fails).map((f) => `host:${f.id}`)
        );
        expect(received).toEqual(
          frames.filter((f) => !f.fails).map((f) => ({ echo: f.id }))
        );

        t.destroy();
        expect(t.isConnected).toBe(false);
        expect(h.registered.size).toBe(0);
      })
    );
  });
});
