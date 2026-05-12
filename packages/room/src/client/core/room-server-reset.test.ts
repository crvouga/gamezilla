import { asKeyword } from '@gamezilla/lib/keyword';
import { describe, expect, it } from 'bun:test';

import { ROOM_WIRE_KIND, WIRE_VERSION } from '../../protocol/wire';
import { openLoopbackRoom } from '../../testkit/simulator';
import {
  CounterIncremented,
  Increment,
  TestCounterModule,
} from '../../testkit/counter-module';

/**
 * Server-wins recovery: when the authoritative server log has diverged from
 * the client's local committed cache (e.g. server storage was reset, so
 * incoming entries carry a seq at or below our local tail), the client must
 * wipe local committed state and re-sync from the server instead of crashing
 * on the contiguity assertion.
 */
describe('Room server-reset recovery', () => {
  it('recovers from a backward committed broadcast without crashing', async () => {
    const { room, transport } = await openLoopbackRoom({
      topic: 't-reset-broadcast',
      module: TestCounterModule,
    });
    await room.untilSynced();
    room.dispatch(Increment({}));
    room.dispatch(Increment({}));
    await new Promise<void>((r) => setTimeout(r, 30));

    const k = asKeyword('counter/count');
    expect(room.getSnapshot()[k]).toBe(2);

    // Simulate a stale broadcast whose seq sits below our committed tail
    // (as if the server log were reset and re-emitted a lower seq while we
    // still hold the older, higher-seq entries locally).
    transport.deliverToClient({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.committed,
      entries: [{ seq: 1, event: CounterIncremented({}) }],
    });

    // Allow client to wipe and re-sync from the (still-authoritative)
    // loopback server, which has 2 real entries.
    await new Promise<void>((r) => setTimeout(r, 30));
    expect(room.getSnapshot()[k]).toBe(2);
    room.destroy();
  });

  it('recovers from a welcome whose lastSeq is behind our local tail', async () => {
    const { room, transport } = await openLoopbackRoom({
      topic: 't-reset-welcome',
      module: TestCounterModule,
    });
    await room.untilSynced();
    room.dispatch(Increment({}));
    await new Promise<void>((r) => setTimeout(r, 30));

    const k = asKeyword('counter/count');
    expect(room.getSnapshot()[k]).toBe(1);

    // Inject a "server is shorter than us" welcome: empty entries and a
    // lastSeq below ours. The client must wipe and re-sync rather than
    // tripping the welcome-lastSeq assertion.
    transport.deliverToClient({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.welcome,
      fromSeq: 1,
      lastSeq: 0,
      entries: [],
    });

    await new Promise<void>((r) => setTimeout(r, 30));
    expect(room.getSnapshot()[k]).toBe(1);
    room.destroy();
  });

  it('is idempotent against a duplicate welcome that re-delivers known entries', async () => {
    const { room, transport } = await openLoopbackRoom({
      topic: 't-reset-duplicate-welcome',
      module: TestCounterModule,
    });
    await room.untilSynced();
    room.dispatch(Increment({}));
    await new Promise<void>((r) => setTimeout(r, 30));

    const k = asKeyword('counter/count');
    expect(room.getSnapshot()[k]).toBe(1);

    // Re-deliver the same welcome the client would have seen on a fresh
    // sync(fromSeq=0). It replays entry seq=1, which we already hold; we
    // must skip the duplicate and keep count at 1 instead of double-folding
    // (or crashing on contiguity).
    transport.deliverToClient({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.welcome,
      fromSeq: 0,
      lastSeq: 1,
      entries: [{ seq: 1, event: CounterIncremented({}) }],
    });

    await new Promise<void>((r) => setTimeout(r, 30));
    expect(room.getSnapshot()[k]).toBe(1);
    room.destroy();
  });
});
