import { asKeyword } from '@gamezilla/lib/keyword';
import { describe, expect, it } from 'bun:test';

import { openLoopbackRoom } from './testkit/simulator';
import { Increment, TestCounterModule } from './testkit/counter-module';
import { ROOM_ERROR_TYPE } from './types';

describe('server-authoritative room (loopback)', () => {
  it('converges after welcome + increment', async () => {
    const { room } = await openLoopbackRoom({
      topic: 't-inc',
      module: TestCounterModule,
    });
    await room.untilSynced();
    const k = asKeyword('counter/count');
    expect(room.getSnapshot()[k]).toBe(0);
    room.dispatch(Increment({}));
    await new Promise<void>((r) => setTimeout(r, 30));
    expect(room.getSnapshot()[k]).toBe(1);
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
    room.dispatch({
      type: asKeyword('space-counter-cmd/bogus'),
      payload: {},
    } as never);
    await new Promise<void>((r) => setTimeout(r, 5));
    expect(errs.length).toBe(1);
    expect((errs[0] as { type: string }).type).toBe(
      ROOM_ERROR_TYPE.invalidCommand
    );
    room.destroy();
  });
});
