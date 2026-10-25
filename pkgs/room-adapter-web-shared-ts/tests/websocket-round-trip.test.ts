import { expect, test } from 'bun:test';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '@pkgs/room-root-shared-ts/wire';
import { Socket, websocketRig } from './reference-websocket';

test('the existing foreground heartbeat measures one round trip on the injected client clock', async () => {
  // regression: room-heartbeat-round-trip-unreported
  const rig = await websocketRig();
  try {
    const messages: unknown[] = [];
    rig.transport.subscribe((message) => messages.push(message));
    rig.clock.advance(7);
    rig.transport.probeLiveness();
    expect(rig.socket.sent).toHaveLength(1);
    rig.clock.advance(25);
    rig.socket.pong();
    expect(rig.milliseconds).toEqual([25]);
    expect(messages).toEqual([]);
    rig.socket.pong();
    expect(rig.milliseconds).toEqual([25]);
    expect(rig.clock.pendingOneShotCount()).toBe(0);
  } finally {
    rig.dispose();
  }
});

test('foreground and periodic probes share one pending ping and preserve its original time', async () => {
  const rig = await websocketRig();
  try {
    rig.clock.advance(19_990);
    rig.transport.probeLiveness();
    rig.clock.advance(10);
    expect(rig.socket.sent).toHaveLength(1);
    rig.clock.advance(25);
    rig.socket.pong();
    expect(rig.milliseconds).toEqual([35]);
    rig.clock.advance(19_975);
    expect(rig.socket.sent).toHaveLength(2);
    rig.clock.advance(30);
    rig.socket.pong();
    expect(rig.milliseconds).toEqual([35, 30]);
  } finally {
    rig.dispose();
  }
});

test('repeated foreground probes cannot postpone a missed heartbeat deadline', async () => {
  // regression: room-heartbeat-probe-postpones-timeout
  const rig = await websocketRig();
  try {
    rig.clock.advance(7);
    rig.transport.probeLiveness();
    rig.clock.advance(3999);
    rig.transport.probeLiveness();
    rig.clock.advance(4001);
    await Promise.resolve();
    expect(rig.socket.sent).toHaveLength(1);
    expect(rig.socket.closes).toEqual([Socket.OPEN]);
    expect(Socket.instances).toHaveLength(2);
    expect(rig.milliseconds).toEqual([]);
  } finally {
    rig.dispose();
  }
});

test('old socket callbacks cannot acknowledge a new generation or a disposed transport', async () => {
  const rig = await websocketRig();
  try {
    rig.transport.probeLiveness();
    const oldMessage = rig.socket.onmessage;
    rig.clock.advance(10);
    rig.transport.reconnectNow();
    await Promise.resolve();
    const replacement = Socket.instances[1]!;
    replacement.open();
    rig.transport.probeLiveness();
    rig.clock.advance(7);
    const pong = {
      data: JSON.stringify({ v: WIRE_VERSION, kind: ROOM_WIRE_KIND.pong }),
    };
    oldMessage?.(pong);
    expect(rig.milliseconds).toEqual([]);
    rig.clock.advance(3);
    replacement.pong();
    expect(rig.milliseconds).toEqual([10]);
    const currentMessage = replacement.onmessage;
    rig.transport.probeLiveness();
    rig.transport.destroy();
    rig.clock.advance(60_000);
    currentMessage?.(pong);
    expect(rig.milliseconds).toEqual([10]);
    expect(rig.clock.nextDueAt()).toBeNull();
    expect(Socket.instances).toHaveLength(2);
  } finally {
    rig.dispose();
  }
});

test('unsolicited pongs produce no sample and malformed frames cannot finish a pending round trip', async () => {
  const rig = await websocketRig();
  try {
    rig.socket.pong();
    expect(rig.milliseconds).toEqual([]);
    rig.transport.probeLiveness();
    rig.clock.advance(25);
    for (const data of [
      'invalid json',
      JSON.stringify({ v: 0, kind: 'pong' }),
      JSON.stringify({ v: WIRE_VERSION, kind: 'ping' }),
    ])
      rig.socket.onmessage?.({ data });
    expect(rig.milliseconds).toEqual([]);
    expect(rig.clock.pendingOneShotCount()).toBe(1);
    rig.clock.advance(1);
    rig.socket.pong();
    expect(rig.milliseconds).toEqual([26]);
  } finally {
    rig.dispose();
  }
});

test.each([Number.NaN, Number.POSITIVE_INFINITY, 90])(
  'invalid client clock %s consumes the reply without fabricating latency',
  async (reading) => {
    let now = 100;
    const rig = await websocketRig({ now: () => now });
    try {
      rig.transport.probeLiveness();
      now = reading;
      rig.socket.pong();
      now = 200;
      rig.socket.pong();
      expect(rig.milliseconds).toEqual([]);
      rig.transport.probeLiveness();
      now = 210;
      rig.socket.pong();
      expect(rig.milliseconds).toEqual([10]);
    } finally {
      rig.dispose();
    }
  }
);

test('a failed ping send reconnects and leaves no sample from the failed socket', async () => {
  const rig = await websocketRig();
  try {
    rig.socket.failSend = true;
    rig.transport.probeLiveness();
    await Promise.resolve();
    rig.socket.pong();
    expect(rig.milliseconds).toEqual([]);
    expect(Socket.instances).toHaveLength(2);
    expect(rig.clock.pendingOneShotCount()).toBe(0);
  } finally {
    rig.dispose();
  }
});
