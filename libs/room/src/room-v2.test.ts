import { describe, expect, it } from 'bun:test';

import { openLoopbackRoom } from './testkit/simulator';
import { Increment, TestCounterModule } from './testkit/counter-module';

describe('server-authoritative room (loopback)', () => {
  it('converges after welcome + increment', async () => {
    const { room } = await openLoopbackRoom({
      topic: 't-inc',
      module: TestCounterModule,
    });
    await room.untilSynced();
    expect(room.getSnapshot()['counter/count']).toBe(0);
    room.dispatch(Increment({}));
    await new Promise<void>((r) => setTimeout(r, 30));
    expect(room.getSnapshot()['counter/count']).toBe(1);
    room.destroy();
  });

  it('local validation rejects unknown command before queue', async () => {
    const errs: unknown[] = [];
    const { room } = await openLoopbackRoom({
      topic: 't-local-err',
      module: TestCounterModule,
      onError: (e) => {
        errs.push(e);
      },
    });
    await room.untilSynced();
    room.dispatch({ type: 'space-counter-cmd/bogus', payload: {} } as never);
    await new Promise<void>((r) => setTimeout(r, 5));
    expect(errs.length).toBe(1);
    expect((errs[0] as { type: string }).type).toBe('invalid_command');
    room.destroy();
  });
});
