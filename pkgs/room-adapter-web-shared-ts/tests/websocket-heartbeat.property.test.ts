import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { Socket, websocketRig } from './reference-websocket';

test.each(['reply', 'timeout'] as const)(
  'probe partitions preserve the original %s time',
  async (outcome) => {
    await assertProperty(
      `room heartbeat ${outcome} probe partition invariance`,
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10_000 }),
        fc.array(fc.integer({ min: 0, max: 1000 }), { maxLength: 7 }),
        async (offset, gaps) => {
          const rig = await websocketRig();
          try {
            rig.clock.advance(offset);
            rig.transport.probeLiveness();
            let elapsed = 0;
            for (const gap of gaps) {
              rig.clock.advance(gap);
              elapsed += gap;
              rig.transport.probeLiveness();
            }
            expect(rig.socket.sent).toHaveLength(1);
            if (outcome === 'reply') rig.socket.pong();
            rig.clock.advance(8000 - elapsed);
            await Promise.resolve();
            expect(rig.milliseconds).toEqual(
              outcome === 'reply' ? [elapsed] : []
            );
            expect(rig.socket.closes).toEqual(
              outcome === 'reply' ? [] : [Socket.OPEN]
            );
            expect(Socket.instances).toHaveLength(outcome === 'reply' ? 1 : 2);
            expect(rig.clock.pendingOneShotCount()).toBe(0);
          } finally {
            rig.dispose();
          }
        }
      )
    );
  }
);
