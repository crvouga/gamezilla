/**
 * A room connection that lives on the sim network the way a WebSocket lives
 * on a real one. The in-process room host is a loopback: once connected it
 * would keep delivering across a partition, so a person who lost their
 * connection would never leave the room — presence in a sim could not tell
 * "gone" from "here". This wrapper keeps a heartbeat on the actor's clock:
 * when the actor can no longer reach the server, the connection drops (the
 * server forgets it; the client sees it close), frames sent meanwhile are
 * lost, and when the network heals it reconnects on a fresh connection and
 * the room resyncs — as a reconnecting socket would.
 */

import type { Timers } from '@pkgs/clock';
import type { ClientTransport, ClientTransportHandlers } from '@pkgs/room';

/** How often a live connection notices the network is gone (a keepalive). */
export const ROOM_HEARTBEAT_MS = 1_000;

export function partitionAwareRoomTransport(args: {
  /** A fresh connection to the room host. */
  readonly open: () => ClientTransport;
  /** The actor can reach the server right now. */
  readonly reachable: () => boolean;
  readonly timers: Timers;
}): ClientTransport {
  const frameHandlers = new Set<(raw: unknown) => void>();
  const handlerSets: ClientTransportHandlers[] = [];
  let inner: ClientTransport | null = null;
  let wanted = false;
  let destroyed = false;
  let heartbeat: unknown = null;

  const relay: ClientTransportHandlers = {
    onOpen: () => {
      for (const h of [...handlerSets]) h.onOpen?.();
    },
    onClose: () => {
      for (const h of [...handlerSets]) h.onClose?.();
    },
    onError: (err) => {
      for (const h of [...handlerSets]) h.onError?.(err);
    },
  };

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

  const tick = (): void => {
    if (destroyed || !wanted) return;
    if (!args.reachable()) {
      drop();
      return;
    }
    if (inner === null) void Promise.resolve(attach().connect());
  };

  return {
    get isConnected() {
      return inner?.isConnected ?? false;
    },
    async connect() {
      wanted = true;
      heartbeat ??= args.timers.setInterval(tick, ROOM_HEARTBEAT_MS);
      if (!args.reachable()) {
        throw new Error('sim room: server unreachable');
      }
      await Promise.resolve((inner ?? attach()).connect());
    },
    sendJson(payload) {
      // A frame sent into a dead connection is lost, not queued.
      if (inner === null || !args.reachable()) return;
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
      if (heartbeat !== null) args.timers.clearInterval(heartbeat);
      heartbeat = null;
      inner?.destroy();
      inner = null;
      frameHandlers.clear();
      handlerSets.length = 0;
    },
  };
}
