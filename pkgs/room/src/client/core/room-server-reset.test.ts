import { describe, expect, it } from 'bun:test';
import { wallIo } from '@pkgs/io';
import { asKeyword } from '@pkgs/keyword';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '../../protocol/wire';
import {
  CounterIncremented,
  Increment,
  TestCounterModule,
} from '../../tests/fixtures/counter-module';
import { openLoopbackRoom } from '../../tests/harness/simulator';
import { InMemoryClientStorage } from '../adapters/storage/memory';
import { Room } from './room';
import type { ClientTransport, ClientTransportHandlers } from './transport';

const io = wallIo();
const timers = io.timers;

/**
 * Records outbound frames; delivers only what the test injects (no auto welcome).
 */
class ManualClientTransport implements ClientTransport {
  readonly sent: unknown[] = [];
  private readonly handlers = new Set<(raw: unknown) => void>();
  private readonly handlerSets: ClientTransportHandlers[] = [];
  opened = false;

  get isConnected(): boolean {
    return this.opened;
  }

  async connect(): Promise<void> {
    this.opened = true;
    for (const h of this.handlerSets) h.onOpen?.();
  }

  sendJson(payload: unknown): void {
    this.sent.push(payload);
  }

  deliver(payload: unknown): void {
    for (const h of [...this.handlers]) h(payload);
  }

  subscribe(handler: (raw: unknown) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  onHandlers(h: ClientTransportHandlers): () => void {
    this.handlerSets.push(h);
    return () => {
      const i = this.handlerSets.indexOf(h);
      if (i >= 0) this.handlerSets.splice(i, 1);
    };
  }

  destroy(): void {
    this.handlers.clear();
    this.handlerSets.length = 0;
    this.opened = false;
  }
}

/**
 * Server-wins recovery: when the authoritative server log has diverged from
 * the client's local committed cache (welcome `lastSeq` behind our tail),
 * the client must wipe local committed state and re-sync from the server.
 * Duplicate committed broadcasts at or below our tail are ignored — wiping
 * on those caused an infinite reset loop when the outbound queue re-flushed
 * already-applied commands.
 */
describe('Room server-reset recovery', () => {
  it('ignores a duplicate committed broadcast at or below the local tip', async () => {
    const { room, transport } = await openLoopbackRoom({
      io,
      topic: 't-reset-broadcast',
      module: TestCounterModule,
    });
    await room.untilSynced();
    room.dispatch(Increment({}));
    room.dispatch(Increment({}));
    await new Promise<void>((r) => timers.setTimeout(r, 30));

    const k = asKeyword('counter/count');
    expect(room.getSnapshot()[k]).toBe(2);

    // Stale / duplicate broadcast whose seq sits at or below our tip must
    // not wipe local state (re-flush loops used to thrash the UI).
    transport.deliverToClient({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.committed,
      entries: [{ seq: 1, event: CounterIncremented({}) }],
    });

    await new Promise<void>((r) => timers.setTimeout(r, 30));
    expect(room.getSnapshot()[k]).toBe(2);
    room.destroy();
  });

  it('recovers from a welcome whose lastSeq is behind our local tail', async () => {
    const { room, transport } = await openLoopbackRoom({
      io,
      topic: 't-reset-welcome',
      module: TestCounterModule,
    });
    await room.untilSynced();
    room.dispatch(Increment({}));
    await new Promise<void>((r) => timers.setTimeout(r, 30));

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

    await new Promise<void>((r) => timers.setTimeout(r, 30));
    expect(room.getSnapshot()[k]).toBe(1);
    room.destroy();
  });

  it('recovers from a stale empty tip-welcome while local lastSeq is 0', async () => {
    const transport = new ManualClientTransport();
    const room = await Room.open({
      topic: 't-reset-stale-tip-welcome',
      module: TestCounterModule,
      storage: new InMemoryClientStorage(),
      transport,
      identity: 'test-user',
      clock: io.clock,
      timers: io.timers,
      createId: io.createId,
    });

    // onOpen already sent sync(fromSeq=0). Deliver a tip-sync welcome that
    // claims seq 11 with no entries — the iOS reconnect race after a local
    // wipe. Must re-request sync(0) instead of asserting 0 === 11.
    transport.deliver({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.welcome,
      fromSeq: 11,
      lastSeq: 11,
      entries: [],
    });
    await new Promise<void>((r) => timers.setTimeout(r, 10));

    const syncs = transport.sent.filter(
      (m): m is { kind: string; fromSeq?: number } =>
        typeof m === 'object' &&
        m !== null &&
        (m as { kind?: string }).kind === ROOM_WIRE_KIND.sync
    );
    expect(syncs.length).toBeGreaterThanOrEqual(2);
    expect(syncs[syncs.length - 1]!.fromSeq).toBe(0);

    transport.deliver({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.welcome,
      fromSeq: 0,
      lastSeq: 1,
      entries: [{ seq: 1, event: CounterIncremented({}) }],
    });
    await room.untilSynced();
    expect(room.getSnapshot()[asKeyword('counter/count')]).toBe(1);
    room.destroy();
  });

  it('is idempotent against a duplicate welcome that re-delivers known entries', async () => {
    const { room, transport } = await openLoopbackRoom({
      io,
      topic: 't-reset-duplicate-welcome',
      module: TestCounterModule,
    });
    await room.untilSynced();
    room.dispatch(Increment({}));
    await new Promise<void>((r) => timers.setTimeout(r, 30));

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

    await new Promise<void>((r) => timers.setTimeout(r, 30));
    expect(room.getSnapshot()[k]).toBe(1);
    room.destroy();
  });
});
