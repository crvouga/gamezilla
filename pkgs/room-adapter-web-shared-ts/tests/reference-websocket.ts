import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import { WebSocketRoomTransport } from '@pkgs/room-adapter-web-shared-ts/websocket-transport';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '@pkgs/room-root-shared-ts/wire';

export class Socket {
  static readonly OPEN = 1;
  static readonly CONNECTING = 0;
  static instances: Socket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string | ArrayBuffer }) => void) | null = null;
  readonly sent: string[] = [];
  readonly closes: number[] = [];
  failSend = false;

  constructor() {
    Socket.instances.push(this);
  }

  close(): void {
    this.closes.push(this.readyState);
    this.readyState = 3;
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }

  send(payload: string): void {
    if (this.failSend) throw new Error('socket send failed');
    this.sent.push(payload);
  }

  pong(): void {
    this.onmessage?.({
      data: JSON.stringify({ v: WIRE_VERSION, kind: ROOM_WIRE_KIND.pong }),
    });
  }
}

export async function websocketRig(readClock?: Clock) {
  const original = globalThis.WebSocket;
  globalThis.WebSocket = Socket as unknown as typeof WebSocket;
  Socket.instances = [];
  const time = createHarnessClock();
  const milliseconds: number[] = [];
  const transport = new WebSocketRoomTransport({
    url: 'ws://room.example',
    ...time,
    clock: readClock ?? time.clock,
    random: () => 0,
    onRoundTrip: (sample: number) => milliseconds.push(sample),
  });
  transport.connect();
  await Promise.resolve();
  const socket = Socket.instances[0];
  if (socket === undefined) throw new Error('Socket was not created');
  socket.open();
  return {
    ...time,
    milliseconds,
    transport,
    socket,
    dispose: () => {
      transport.destroy();
      globalThis.WebSocket = original;
    },
  };
}
