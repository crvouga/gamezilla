// @io-wall-ok — tools composition root.

/**
 * The stack's single ingress: a round-robin balancer over N API instances.
 *
 * Clients never address an instance. That is the production shape, and it is
 * the shape the simulation already models — so the same class of bug
 * (per-instance state that should have been shared) fails here too.
 *
 * Room sockets are the one exception to round-robin. A room is a
 * single-threaded authority keyed by topic, so every socket for a topic must
 * land on the same instance — the balancer hashes the topic, which is what
 * `idFromName(topic)` does in production.
 */

import type { EdgeLatency, Lagged } from './edge-latency';
import { lagged, NO_EDGE_LATENCY } from './edge-latency';

export type Backend = {
  readonly id: string;
  readonly origin: string;
};

export type LoadBalancerHandle = {
  readonly origin: string;
  readonly port: number;
  stop(): Promise<void>;
};

function hashTopic(topic: string): number {
  let hash = 2166136261;
  for (let i = 0; i < topic.length; i += 1) {
    hash ^= topic.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

type Frame = string | ArrayBuffer;

type SocketPair = {
  readonly target: string;
  upstream: WebSocket | null;
  queue: Frame[];
  readonly toBackend: Lagged;
  readonly toPerson: Lagged;
};

function forwardUrl(backend: Backend, request: Request): string {
  const url = new URL(request.url);
  return `${backend.origin}${url.pathname}${url.search}`;
}

function pipeUpstream(args: {
  readonly ws: { send(data: Frame): void; close(): void };
  readonly pair: SocketPair;
  readonly target: string;
  readonly protocol: string | null;
}): void {
  const upstream = new WebSocket(
    args.target.replace(/^http/, 'ws'),
    args.protocol === null ? undefined : args.protocol
  );
  upstream.binaryType = 'arraybuffer';
  upstream.addEventListener('open', () => {
    args.pair.upstream = upstream;
    for (const queued of args.pair.queue) upstream.send(queued);
    args.pair.queue.length = 0;
  });
  upstream.addEventListener('message', (event: MessageEvent) => {
    args.pair.toPerson.inOrder(() =>
      args.ws.send(
        typeof event.data === 'string'
          ? event.data
          : (event.data as ArrayBuffer)
      )
    );
  });
  upstream.addEventListener('close', () => {
    args.pair.toPerson.inOrder(() => args.ws.close());
  });
  upstream.addEventListener('error', () => {
    args.pair.toPerson.inOrder(() => args.ws.close());
  });
}

/** Where each request goes: round-robin, except a room, which hashes its topic. */
function backendPicker(backends: readonly Backend[]): {
  next(): Backend;
  forTopic(topic: string): Backend;
} {
  let cursor = 0;
  return {
    next() {
      const backend = backends[cursor % backends.length];
      cursor += 1;
      if (backend === undefined) throw new Error('load balancer: no backends');
      return backend;
    },
    forTopic(topic) {
      const backend =
        backends[hashTopic(topic) % backends.length] ?? backends[0];
      if (backend === undefined) throw new Error('load balancer: no backends');
      return backend;
    },
  };
}

/** What the balancer does with the frames and the end of one room socket. */
function socketHandlers(): Bun.WebSocketHandler<SocketPair> {
  return {
    open(ws) {
      pipeUpstream({
        ws,
        pair: ws.data,
        target: ws.data.target,
        protocol: null,
      });
    },
    message(ws, message) {
      const payload: Frame =
        typeof message === 'string'
          ? message
          : (message.buffer.slice(
              message.byteOffset,
              message.byteOffset + message.byteLength
            ) as ArrayBuffer);
      ws.data.toBackend.inOrder(() => {
        if (ws.data.upstream === null) {
          ws.data.queue.push(payload);
          return;
        }
        ws.data.upstream.send(payload);
      });
    },
    close(ws) {
      ws.data.toBackend.inOrder(() => ws.data.upstream?.close());
    },
  };
}

export function startLoadBalancer(args: {
  readonly port: number;
  readonly backends: readonly Backend[];
  /** The network in front of the API; none unless given. */
  readonly latency?: EdgeLatency;
}): LoadBalancerHandle {
  const latency = args.latency ?? NO_EDGE_LATENCY;
  const picker = backendPicker(args.backends);
  const lag = lagged(latency);

  const server = Bun.serve<SocketPair, string>({
    port: args.port,
    hostname: '127.0.0.1',
    idleTimeout: 60,
    async fetch(request) {
      const url = new URL(request.url);
      const isUpgrade =
        (request.headers.get('upgrade') ?? '').toLowerCase() === 'websocket';
      if (isUpgrade) {
        const backend = picker.forTopic(url.searchParams.get('topic') ?? '');
        await lag.after();
        const pair: SocketPair = {
          target: forwardUrl(backend, request),
          upstream: null,
          queue: [],
          toBackend: lagged(latency),
          toPerson: lagged(latency),
        };
        if (
          server.upgrade(request, {
            data: pair,
            headers: { 'x-lb-backend': backend.id },
          })
        ) {
          return undefined as never;
        }
        return new Response('upgrade failed', { status: 400 });
      }
      const backend =
        url.pathname === '/__room-service'
          ? picker.forTopic(url.searchParams.get('topic') ?? '')
          : picker.next();
      const forwarded = new Request(forwardUrl(backend, request), request);
      forwarded.headers.set('x-lb-backend', backend.id);
      await lag.after();
      try {
        const response = await fetch(forwarded, { redirect: 'manual' });
        await lag.after();
        return response;
      } catch {
        // A node that is stopping resets what it was serving. That is the
        // caller's retry to handle: an uncaught rejection here is reported by
        // Bun as an error, and fails the whole run after every test passed.
        return new Response(null, {
          status: 502,
          headers: { 'x-lb-backend': backend.id },
        });
      }
    },
    websocket: socketHandlers(),
  });

  return {
    origin: server.url.origin,
    port: Number(server.url.port),
    stop: () => server.stop(true),
  };
}
