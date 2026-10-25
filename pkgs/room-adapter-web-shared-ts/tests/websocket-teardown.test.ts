import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { WebSocketRoomTransport } from '@pkgs/room-adapter-web-shared-ts/websocket-transport';

class Socket {
  static readonly OPEN = 1;
  static readonly CONNECTING = 0;
  static instances: Socket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  closes: number[] = [];
  constructor() {
    Socket.instances.push(this);
  }
  close() {
    this.closes.push(this.readyState);
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
}

// regression: room-socket-disposed-during-handshake
test('disposing a connecting room closes after the handshake without notifying or reconnecting', async () => {
  const original = globalThis.WebSocket;
  globalThis.WebSocket = Socket as unknown as typeof WebSocket;
  Socket.instances = [];
  const clock = createHarnessClock();
  const transport = new WebSocketRoomTransport({
    url: 'ws://localhost:63877/api/room?topic=space%3Aa0dcf89d-16b8-4783-8d09-e9276c8c58ca',
    timers: clock.timers,
    clock: clock.clock,
    onRoundTrip: () => {},
    random: () => 0,
  });
  let opens = 0;
  transport.onHandlers({
    onOpen: () => {
      opens += 1;
    },
  });
  try {
    transport.connect();
    await Promise.resolve();
    const socket = Socket.instances[0];
    if (socket === undefined) throw new Error('Socket was not created');
    transport.destroy();
    expect(socket.closes).toEqual([]);
    socket.open();
    expect(socket.closes).toEqual([Socket.OPEN]);
    expect(opens).toBe(0);
    clock.clock.advance(60_000);
    expect(Socket.instances).toHaveLength(1);
  } finally {
    transport.destroy();
    globalThis.WebSocket = original;
  }
});
