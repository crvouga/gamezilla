import { expect, test } from 'bun:test';
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
