import { expect, test } from 'bun:test';
import net from 'node:net';
import { startLoadBalancer } from './load-balancer';

test('room sockets forward their first command and receive the reply', async () => {
  // regression: local-room-upgrade-target-race
  const backend = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch(request, server) {
      if (server.upgrade(request)) return;
      return new Response(null, { status: 400 });
    },
    websocket: {
      message(socket, message) {
        socket.send(message);
      },
    },
  });
  const balancer = startLoadBalancer({
    port: 0,
    backends: [{ id: 'room', origin: backend.url.origin }],
  });
  const socket = new WebSocket(
    `${balancer.origin.replace('http:', 'ws:')}/api/room?topic=space:test`
  );
  try {
    const reply = new Promise<string>((resolve, reject) => {
      socket.addEventListener('open', () => socket.send('first-command'));
      socket.addEventListener('message', (event) =>
        resolve(String(event.data))
      );
      socket.addEventListener('close', () =>
        reject(new Error('Room closed before replying'))
      );
      socket.addEventListener('error', () =>
        reject(new Error('Room connection failed'))
      );
    });
    expect(await reply).toBe('first-command');
  } finally {
    socket.close();
    await balancer.stop();
    await backend.stop(true);
  }
});

test('a backend that resets the connection is a bad gateway, not a failed run', async () => {
  // regression: local-balancer-upstream-reset-fails-run
  const backend = net.createServer((socket) => socket.resetAndDestroy());
  await new Promise<void>((resolve) =>
    backend.listen(0, '127.0.0.1', () => resolve())
  );
  const { port } = backend.address() as net.AddressInfo;
  const balancer = startLoadBalancer({
    port: 0,
    backends: [{ id: 'stopping', origin: `http://127.0.0.1:${port}` }],
  });
  try {
    const response = await fetch(`${balancer.origin}/api/mutations`, {
      method: 'POST',
      body: '{}',
    });
    expect(response.status).toBe(502);
    expect(response.headers.get('x-lb-backend')).toBe('stopping');
  } finally {
    await balancer.stop();
    backend.close();
  }
});

/** A network that costs nothing to wait on and remembers every wait it was asked for. */
function recordedNetwork(ms: number): {
  readonly latency: { readonly ms: number; sleep(ms: number): Promise<void> };
  readonly waits: number[];
} {
  const waits: number[] = [];
  return {
    waits,
    latency: {
      ms,
      sleep: (wait) => {
        waits.push(wait);
        return Promise.resolve();
      },
    },
  };
}

test('an edge latency delays a request and its answer, as a network does', async () => {
  // regression: deploy-health-escaped-pull-request
  const backend = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch: () => new Response('answered'),
  });
  const network = recordedNetwork(60);
  const balancer = startLoadBalancer({
    port: 0,
    backends: [{ id: 'api', origin: backend.url.origin }],
    latency: network.latency,
  });
  try {
    const response = await fetch(`${balancer.origin}/api/health`);
    expect(await response.text()).toBe('answered');
    expect(network.waits).toEqual([60, 60]);
  } finally {
    await balancer.stop();
    await backend.stop(true);
  }
});

test('an edge latency delays every socket frame each way and keeps frames in order', async () => {
  // regression: deploy-health-escaped-pull-request
  const backend = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch(request, server) {
      if (server.upgrade(request)) return;
      return new Response(null, { status: 400 });
    },
    websocket: {
      message(socket, message) {
        socket.send(message);
      },
    },
  });
  const network = recordedNetwork(50);
  const balancer = startLoadBalancer({
    port: 0,
    backends: [{ id: 'room', origin: backend.url.origin }],
    latency: network.latency,
  });
  const socket = new WebSocket(
    `${balancer.origin.replace('http:', 'ws:')}/api/room?topic=space:test`
  );
  try {
    const replies: string[] = [];
    const both = new Promise<void>((resolve, reject) => {
      socket.addEventListener('message', (event) => {
        replies.push(String(event.data));
        if (replies.length === 2) resolve();
      });
      socket.addEventListener('error', () => reject(new Error('socket error')));
    });
    await new Promise<void>((resolve) =>
      socket.addEventListener('open', () => resolve())
    );
    socket.send('first');
    socket.send('second');
    await both;
    expect(replies).toEqual(['first', 'second']);
    // The upgrade, then each frame there and back.
    expect(network.waits.length).toBeGreaterThanOrEqual(5);
    expect(new Set(network.waits)).toEqual(new Set([50]));
  } finally {
    socket.close();
    await balancer.stop();
    await backend.stop(true);
  }
});
