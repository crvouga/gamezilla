import { afterEach, expect, test } from 'bun:test';
import net from 'node:net';
import { type DatabaseLink, startDatabaseLink } from './database-link';

const closers: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

function frame(tag: string, body: Buffer): Buffer {
  const head = Buffer.alloc(5);
  head.write(tag, 0, 'latin1');
  head.writeInt32BE(body.length + 4, 1);
  return Buffer.concat([head, body]);
}

const query = (text: string) => frame('Q', Buffer.from(`${text}\0`));
const terminate = () => frame('X', Buffer.alloc(0));
const readyForQuery = (status: 'I' | 'T') => frame('Z', Buffer.from(status));

function startup(): Buffer {
  const body = Buffer.from('user\0test\0\0');
  const head = Buffer.alloc(8);
  head.writeInt32BE(body.length + 8, 0);
  head.writeInt32BE(196_608, 4);
  return Buffer.concat([head, body]);
}

/** A database that answers every Query with ReadyForQuery, tracking BEGIN/COMMIT. */
async function fakeDatabase(): Promise<{ readonly url: string }> {
  const open = new Set<net.Socket>();
  const server = net.createServer((socket) => {
    open.add(socket);
    socket.once('close', () => open.delete(socket));
    let status: 'I' | 'T' = 'I';
    let buffer = Buffer.alloc(0);
    let started = false;
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      for (;;) {
        if (!started) {
          if (buffer.length < 4 || buffer.length < buffer.readInt32BE(0))
            return;
          buffer = buffer.subarray(buffer.readInt32BE(0));
          started = true;
          socket.write(
            Buffer.concat([frame('R', Buffer.alloc(4)), readyForQuery('I')])
          );
          continue;
        }
        if (buffer.length < 5 || buffer.length < buffer.readInt32BE(1) + 1)
          return;
        const total = buffer.readInt32BE(1) + 1;
        const tag = String.fromCharCode(buffer[0] ?? 0);
        const text = buffer.toString('utf8', 5, total - 1);
        buffer = buffer.subarray(total);
        if (tag === 'X') return socket.end();
        if (tag !== 'Q') continue;
        if (text.startsWith('BEGIN')) status = 'T';
        if (text.startsWith('COMMIT')) status = 'I';
        socket.write(
          Buffer.concat([
            frame('C', Buffer.from('OK\0')),
            readyForQuery(status),
          ])
        );
      }
    });
  });
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve())
  );
  closers.push(() => {
    server.close();
    for (const socket of open) socket.destroy();
  });
  const { port } = server.address() as net.AddressInfo;
  return { url: `postgres://test@127.0.0.1:${String(port)}/app` };
}

async function link(
  overrides: Partial<{
    sessions: number;
    roundTripMs: number;
    waitMs: number;
  }> = {}
): Promise<DatabaseLink> {
  const database = await fakeDatabase();
  const started = await startDatabaseLink({
    upstreamUrl: database.url,
    sessions: overrides.sessions ?? 10,
    roundTripMs: overrides.roundTripMs ?? 0,
    waitMs: overrides.waitMs ?? 5_000,
  });
  closers.push(() => started.stop());
  return started;
}

/** A client that has finished its handshake and can send queries. */
async function connect(started: DatabaseLink) {
  const socket = net.connect(started.port, '127.0.0.1');
  closers.push(() => void socket.destroy());
  let received = Buffer.alloc(0);
  const waiters: Array<() => void> = [];
  socket.on('data', (chunk) => {
    received = Buffer.concat([received, chunk]);
    for (const wake of waiters.splice(0)) wake();
  });
  const tags = (): string[] => {
    const found: string[] = [];
    let at = 0;
    while (received.length - at >= 5) {
      const total = received.readInt32BE(at + 1) + 1;
      if (received.length - at < total) break;
      found.push(String.fromCharCode(received[at] ?? 0));
      at += total;
    }
    return found;
  };
  const until = async (done: () => boolean) => {
    while (!done()) await new Promise<void>((resolve) => waiters.push(resolve));
  };
  const closed = new Promise<void>((resolve) =>
    socket.once('close', () => resolve())
  );
  socket.write(startup());
  await until(() => tags().includes('Z'));
  const rounds = () => tags().filter((tag) => tag === 'Z').length;
  return {
    socket,
    closed,
    async send(text: string): Promise<void> {
      const before = rounds();
      socket.write(query(text));
      await until(() => rounds() > before);
    },
    sendWithoutWaiting: (text: string) => socket.write(query(text)),
    until,
    rounds,
    errorText: () => {
      const at = received.indexOf(0x45);
      return at < 0 ? null : received.toString('utf8', at);
    },
    hangUp: () => socket.write(terminate()),
  };
}

test('every exchange costs the configured round trip', async () => {
  const started = await link({ roundTripMs: 80 });
  const client = await connect(started);
  const sentAt = performance.now();
  await client.send('SELECT 1');
  expect(performance.now() - sentAt).toBeGreaterThanOrEqual(70);
});

test('a connection is billed for its round trips and the statements it sent', async () => {
  const started = await link();
  const client = await connect(started);
  await client.send('SELECT 1');
  await client.send('SELECT 2');
  await client.send('SELECT 3');
  client.hangUp();
  await client.closed;
  const [bill] = started.summary().bills;
  expect(bill?.roundTrips).toBe(3);
  expect(bill?.statements).toEqual(['SELECT 1', 'SELECT 2', 'SELECT 3']);
  expect(bill?.refused).toBe(false);
});

test('a transaction keeps its session until it ends, and the next in line waits for it', async () => {
  const started = await link({ sessions: 1 });
  const first = await connect(started);
  const second = await connect(started);
  await first.send('BEGIN');
  second.sendWithoutWaiting('SELECT 1');
  await new Promise((resolve) => setTimeout(resolve, 120));
  expect(second.rounds()).toBe(1);
  await first.send('COMMIT');
  await second.until(() => second.rounds() > 1);
  const bills = started.summary().bills;
  expect(bills[1]?.waitedMs).toBeGreaterThanOrEqual(100);
  expect(started.summary().peakSessions).toBe(1);
  expect(bills[0]?.longestHoldMs).toBeGreaterThanOrEqual(100);
  expect(bills[0]?.longestHoldRoundTrips).toBe(2);
});

test('a connection that waits too long is refused with the pool error', async () => {
  // regression: local-database-had-no-session-pool
  const started = await link({ sessions: 1, waitMs: 150 });
  const holder = await connect(started);
  const waiting = await connect(started);
  await holder.send('BEGIN');
  waiting.sendWithoutWaiting('SELECT 1');
  await waiting.closed;
  expect(waiting.errorText()).toContain(
    'Timed out while waiting for an open slot in the pool.'
  );
  expect(started.summary().refused).toBe(1);
});

test('hanging up never waits for a session', async () => {
  const started = await link({ sessions: 1, waitMs: 5_000 });
  const holder = await connect(started);
  const leaver = await connect(started);
  await holder.send('BEGIN');
  const hungUpAt = performance.now();
  leaver.hangUp();
  await leaver.closed;
  expect(performance.now() - hungUpAt).toBeLessThan(1_000);
});
