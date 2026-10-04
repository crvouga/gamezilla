/**
 * A room connection that lives on the harness network the way a WebSocket lives
 * on a real one. The in-process room host is a loopback: once connected it
 * would keep delivering across a partition, so a person who lost their
 * connection would never leave the room — presence in a harness could not tell
 * "gone" from "here". This wrapper listens to network changes and keeps a
 * heartbeat on the actor's clock:
 * when the actor can no longer reach the server, the connection drops (the
 * server forgets it; the client sees it close), frames sent meanwhile are
 * lost, and when the network heals it reconnects on a fresh connection and
 * the room resyncs — as a reconnecting socket would.
 */

import type { Timers } from '@pkgs/clock-shared/types';
import type { ClientTransport, ClientTransportHandlers } from '@pkgs/room-shared/transport';

/** How often a live connection notices the network is gone (a keepalive). */
export const ROOM_HEARTBEAT_MS = 1_000;

async function connectOrDiscard(
  transport: ClientTransport,
  discard: (transport: ClientTransport) => void
): Promise<void> {
  try {
    await Promise.resolve(transport.connect());
  } catch (cause) {
    discard(transport);
    throw cause;
  }
}

function transportRelay(
  handlers: readonly ClientTransportHandlers[]
): ClientTransportHandlers {
  return {
    onOpen: () => {
      for (const h of [...handlers]) h.onOpen?.();
    },
    onClose: () => {
      for (const h of [...handlers]) h.onClose?.();
    },
    onError: (err) => {
      for (const h of [...handlers]) h.onError?.(err);
    },
  };
}

function startRoomHeartbeat(
  args: {
    readonly timers: Timers;
    readonly subscribeReachability?: (listener: () => void) => () => void;
  },
  tick: () => void
): () => void {
  const handle = args.timers.setInterval(tick, ROOM_HEARTBEAT_MS);
  const unsubscribe = args.subscribeReachability?.(tick);
  return () => {
    args.timers.clearInterval(handle);
    unsubscribe?.();
  };
}

export function partitionAwareRoomTransport(args: {
  /** A fresh connection to the room host. */
  readonly open: () => ClientTransport;
  /** The actor can reach the server right now. */
  readonly reachable: () => boolean;
  readonly timers: Timers;
  /** A simulated socket hears network changes without spending game time. */
  readonly subscribeReachability?: (listener: () => void) => () => void;
}): ClientTransport {
  const frameHandlers = new Set<(raw: unknown) => void>();
  const handlerSets: ClientTransportHandlers[] = [];
  let inner: ClientTransport | null = null;
  let wanted = false;
  let destroyed = false;
  let stopHeartbeat: (() => void) | null = null;

  const relay = transportRelay(handlerSets);

  const attach = (): ClientTransport => {
    const next = args.open();
    next.subscribe((raw) => {
      for (const h of [...frameHandlers]) h(raw);
    });
    next.onHandlers(relay);
    inner = next;
    return next;
  };

  const drop = (): void => {
    if (inner === null) return;
    const dead = inner;
    inner = null;
    dead.destroy();
    relay.onClose?.();
  };

  const discardFailed = (next: ClientTransport): void => {
    if (inner !== next) return;
    inner = null;
    next.destroy();
  };

  const tick = (): void => {
    if (destroyed || !wanted) return;
    if (!args.reachable()) {
      drop();
      return;
    }
    if (inner !== null) return;
    const next = attach();
    // A reconnect that fails leaves no connection behind, so the next
    // heartbeat tries again — the actor is not stranded offline.
    Promise.resolve(next.connect()).catch(() => {
      discardFailed(next);
    });
  };

  return {
    get isConnected() {
      return inner?.isConnected ?? false;
    },
    async connect() {
      wanted = true;
      stopHeartbeat ??= startRoomHeartbeat(args, tick);
      if (!args.reachable()) {
        throw new Error('harness room: server unreachable');
      }
      const next = inner ?? attach();
      await connectOrDiscard(next, discardFailed);
    },
    sendJson(payload) {
      // A failed send must invalidate the connection, including a short
      // partition healed before its heartbeat. Otherwise the room client
      // keeps believing its durable commands were sent and never resyncs.
      if (!args.reachable()) {
        drop();
        return;
      }
      if (inner === null) return;
      inner.sendJson(payload);
    },
    subscribe(handler) {
      frameHandlers.add(handler);
      return () => {
        frameHandlers.delete(handler);
      };
    },
    onHandlers(h) {
      handlerSets.push(h);
      return () => {
        const i = handlerSets.indexOf(h);
        if (i >= 0) handlerSets.splice(i, 1);
      };
    },
    destroy() {
      destroyed = true;
      wanted = false;
      stopHeartbeat?.();
      stopHeartbeat = null;
      inner?.destroy();
      inner = null;
      frameHandlers.clear();
      handlerSets.length = 0;
    },
  };
}
