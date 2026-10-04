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

type SocketPair = { upstream: WebSocket | null; queue: Frame[] };

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
    args.ws.send(
      typeof event.data === 'string' ? event.data : (event.data as ArrayBuffer)
    );
  });
  upstream.addEventListener('close', () => {
    args.ws.close();
  });
  upstream.addEventListener('error', () => {
    args.ws.close();
  });
}

export function startLoadBalancer(args: {
  readonly port: number;
  readonly backends: readonly Backend[];
}): LoadBalancerHandle {
  let cursor = 0;
  const nextBackend = (): Backend => {
    const backend = args.backends[cursor % args.backends.length];
    cursor += 1;
    if (backend === undefined) throw new Error('load balancer: no backends');
    return backend;
  };

  const backendForTopic = (topic: string): Backend => {
    const backend =
      args.backends[hashTopic(topic) % args.backends.length] ??
      args.backends[0];
    if (backend === undefined) throw new Error('load balancer: no backends');
    return backend;
  };

  const pendingTargets = new Map<SocketPair, string>();

  const server = Bun.serve<SocketPair, string>({
    port: args.port,
    hostname: '127.0.0.1',
    idleTimeout: 60,
    async fetch(request) {
      const url = new URL(request.url);
      const isUpgrade =
        (request.headers.get('upgrade') ?? '').toLowerCase() === 'websocket';
      if (isUpgrade) {
        const topic = url.searchParams.get('topic') ?? '';
        const backend = backendForTopic(topic);
        const pair: SocketPair = { upstream: null, queue: [] };
        if (
          server.upgrade(request, {
            data: pair,
            headers: { 'x-lb-backend': backend.id },
          })
        ) {
          pendingTargets.set(pair, forwardUrl(backend, request));
          return undefined as never;
        }
        return new Response('upgrade failed', { status: 400 });
      }
      const backend =
        url.pathname === '/__room-service'
          ? backendForTopic(url.searchParams.get('topic') ?? '')
          : nextBackend();
      const forwarded = new Request(forwardUrl(backend, request), request);
      forwarded.headers.set('x-lb-backend', backend.id);
      return await fetch(forwarded, { redirect: 'manual' });
    },
    websocket: {
      open(ws) {
        const target = pendingTargets.get(ws.data);
        pendingTargets.delete(ws.data);
        if (target === undefined) {
          ws.close();
          return;
        }
        pipeUpstream({ ws, pair: ws.data, target, protocol: null });
      },
      message(ws, message) {
        const payload: Frame =
          typeof message === 'string'
            ? message
            : (message.buffer.slice(
                message.byteOffset,
                message.byteOffset + message.byteLength
              ) as ArrayBuffer);
        if (ws.data.upstream === null) {
          ws.data.queue.push(payload);
          return;
        }
        ws.data.upstream.send(payload);
      },
      close(ws) {
        ws.data.upstream?.close();
      },
    },
  });

  return {
    origin: server.url.origin,
    port: Number(server.url.port),
    stop: () => server.stop(true),
  };
}
