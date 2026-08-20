import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { wallClock, wallTimers } from '@pkgs/clock';

import { ROOM_WIRE_KIND, WIRE_VERSION } from '../../../../protocol/wire';
import { WebSocketRoomTransport } from './transport';

const now = wallClock.now;
const timers = wallTimers;

type FakeWs = {
  readyState: number;
  url: string;
  onopen: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  sent: string[];
  send(data: string): void;
  close(code?: number, reason?: string): void;
};

let sockets: FakeWs[] = [];
let OriginalWebSocket: typeof WebSocket | undefined;

function installFakeWebSocket(): void {
  sockets = [];
  OriginalWebSocket = globalThis.WebSocket;
  // @ts-expect-error test stub
  globalThis.WebSocket = class FakeWebSocket {
    static readonly OPEN = 1;
    static readonly CLOSED = 3;
    readyState = 0;
    onopen: ((ev: Event) => void) | null = null;
    onmessage: ((ev: MessageEvent) => void) | null = null;
    onerror: ((ev: Event) => void) | null = null;
    onclose: ((ev: CloseEvent) => void) | null = null;
    sent: string[] = [];
    url: string;

    constructor(url: string) {
      this.url = url;
      sockets.push(this as unknown as FakeWs);
      queueMicrotask(() => {
        this.readyState = 1;
        this.onopen?.(new Event('open'));
      });
    }

    send(data: string): void {
      this.sent.push(data);
    }

    close(_code?: number, _reason?: string): void {
      if (this.readyState === 3) return;
      this.readyState = 3;
      this.onclose?.(new CloseEvent('close'));
    }
  };
  // @ts-expect-error mirror static constants used by transport
  globalThis.WebSocket.OPEN = 1;
  // @ts-expect-error mirror static constants used by transport
  globalThis.WebSocket.CLOSED = 3;
}

function restoreWebSocket(): void {
  if (OriginalWebSocket !== undefined) {
    globalThis.WebSocket = OriginalWebSocket;
  }
}

function waitForOpen(): Promise<FakeWs> {
  return new Promise((resolve) => {
    const tick = (): void => {
      const s = sockets[sockets.length - 1];
      if (s !== undefined && s.readyState === 1) {
        resolve(s);
        return;
      }
      queueMicrotask(tick);
    };
    tick();
  });
}

function hasPing(socket: FakeWs): boolean {
  return socket.sent.some((raw) => {
    const m = JSON.parse(raw) as { kind?: string };
    return m.kind === ROOM_WIRE_KIND.ping;
  });
}

async function waitUntil(
  predicate: () => boolean,
  timeoutMs: number,
  label: string
): Promise<void> {
  const started = now();
  while (!predicate()) {
    if (now() - started > timeoutMs) {
      throw new Error(`${label} timed out after ${timeoutMs}ms`);
    }
    await new Promise<void>((resolve) => {
      timers.setTimeout(resolve, 5);
    });
  }
}

function deliverPong(socket: FakeWs): void {
  socket.onmessage?.(
    new MessageEvent('message', {
      data: JSON.stringify({
        v: WIRE_VERSION,
        kind: ROOM_WIRE_KIND.pong,
      }),
    })
  );
}

type TransportOpts = ConstructorParameters<typeof WebSocketRoomTransport>[0];

function testTransportOptions(
  overrides: Omit<TransportOpts, 'timers' | 'random'> &
    Partial<Pick<TransportOpts, 'timers' | 'random'>>
): TransportOpts {
  return {
    reconnectBaseMs: 5,
    reconnectMaxMs: 10,
    reconnectJitterMs: 0,
    timers: wallTimers,
    random: Math.random,
    ...overrides,
  };
}

describe('WebSocketRoomTransport heartbeat', () => {
  beforeEach(() => {
    installFakeWebSocket();
  });

  afterEach(() => {
    restoreWebSocket();
  });

  test('sends ping on heartbeat interval and reconnects when pong is missed', async () => {
    const transport = new WebSocketRoomTransport(
      testTransportOptions({
        url: 'ws://example.test/room',
        heartbeatMs: 30,
        heartbeatTimeoutMs: 20,
      })
    );
    try {
      transport.connect();
      const first = await waitForOpen();
      expect(first.readyState).toBe(1);
      await waitUntil(() => hasPing(first), 500, 'first heartbeat ping');
      await waitUntil(() => sockets.length > 1, 500, 'reconnect after miss');
    } finally {
      transport.destroy();
    }
  });

  test('probeLiveness reconnects when socket is closed', async () => {
    const transport = new WebSocketRoomTransport(
      testTransportOptions({
        url: 'ws://example.test/room',
        heartbeatMs: 60_000,
        heartbeatTimeoutMs: 30_000,
      })
    );
    try {
      transport.connect();
      const first = await waitForOpen();
      first.readyState = 3;
      transport.probeLiveness();
      await waitUntil(
        () => sockets.length > 1,
        500,
        'reconnect after probeLiveness'
      );
    } finally {
      transport.destroy();
    }
  });

  test('pong clears the heartbeat miss timer', async () => {
    const transport = new WebSocketRoomTransport(
      testTransportOptions({
        url: 'ws://example.test/room',
        heartbeatMs: 40,
        heartbeatTimeoutMs: 80,
      })
    );
    try {
      transport.connect();
      const first = await waitForOpen();
      await waitUntil(() => hasPing(first), 500, 'first heartbeat ping');
      deliverPong(first);
      // Miss timeout is 80ms; stay under that and confirm no reconnect.
      await new Promise<void>((resolve) => {
        timers.setTimeout(resolve, 50);
      });
      expect(sockets.length).toBe(1);
    } finally {
      transport.destroy();
    }
  });
});
