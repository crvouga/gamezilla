// @io-wall-ok — tools composition root: sockets and timers of a test double.

/**
 * The link between the API and its database, shaped like production's.
 *
 * Deployed, the Worker reaches Postgres through Hyperdrive: every statement is
 * a network round trip, and a pool of a fixed number of sessions serves every
 * request in transaction mode (a session is held from a request's first
 * statement until its transaction ends, then handed to the next). A request
 * that cannot get a session waits, and fails if it waits too long. A laptop's
 * loopback database has none of that, so a request that sends two hundred
 * statements, or holds a session for eight seconds, is invisible there and
 * brings the deployed environment down.
 *
 * This is a PostgreSQL wire-protocol proxy that gives the local database the
 * same three properties and records what each connection cost:
 *
 * - **Latency.** Every message is delayed by half a round trip each way.
 * - **A session pool.** At most `sessions` connections are in a transaction
 *   or running a statement at once, the rest wait their turn in order, and a
 *   connection that waits `waitMs` is refused with Hyperdrive's own error.
 * - **A bill.** Per connection: round trips, time a session was held, longest
 *   single hold, time spent waiting. The API opens one connection per request,
 *   so these are per-request costs, and the counts do not depend on machine
 *   speed.
 *
 * Only the framing of the protocol is read (`postgres-frames.ts`); statements
 * are forwarded untouched.
 */

import net from 'node:net';
import {
  CANCEL_REQUEST,
  createFrameReader,
  type Frame,
  type FrameReader,
  fatalPoolError,
  GSS_REQUEST,
  IDLE,
  SSL_ACCEPTED,
  SSL_REQUEST,
  statementOf,
  TAG,
} from './postgres-frames';

export type DatabaseLinkOptions = {
  /** `postgres://…` of the real database. */
  readonly upstreamUrl: string;
  /** Sessions the pool serves at once. */
  readonly sessions: number;
  /** Round trip added to every exchange, in milliseconds. */
  readonly roundTripMs: number;
  /** How long a connection waits for a session before it is refused. */
  readonly waitMs: number;
  /** Port to listen on; 0 lets the OS choose. */
  readonly port?: number;
  /** How many of a connection's first statements to keep, to say which request it was. */
  readonly statementSample?: number;
};

/** What one connection cost. */
export type ConnectionBill = {
  readonly id: number;
  /** Exchanges the client sent (a statement is one, a batch of pipelined messages is one). */
  readonly roundTrips: number;
  /** Total time this connection held a pool session. */
  readonly heldMs: number;
  /** Longest uninterrupted hold: its longest transaction. */
  readonly longestHoldMs: number;
  /** Round trips inside that longest hold; unlike time, it does not depend on the machine. */
  readonly longestHoldRoundTrips: number;
  /** Total time spent waiting for a session. */
  readonly waitedMs: number;
  /** Refused after waiting `waitMs`. */
  readonly refused: boolean;
  /** The first statements, to say which request this was. */
  readonly statements: readonly string[];
};

export type DatabaseLinkSummary = {
  readonly connections: number;
  readonly peakSessions: number;
  readonly refused: number;
  readonly bills: readonly ConnectionBill[];
};

export type DatabaseLink = {
  /** The upstream URL with this link's address in place of the database's. */
  readonly url: string;
  readonly port: number;
  summary(): DatabaseLinkSummary;
  stop(): Promise<void>;
};

const STATEMENT_SAMPLE = 8;
const STATEMENT_CHARS = 90;
/** Housekeeping every request repeats; it says nothing about which request this is. */
const SESSION_STATEMENT =
  /^\s*(SET\b|SHOW\b|SELECT current_schema|BEGIN\b|COMMIT\b|ROLLBACK\b|SAVEPOINT\b|RELEASE\b)/i;

/** The pool: sessions, a first-come queue, and the peak in use. */
type SessionPool = {
  tryTake(): boolean;
  release(): void;
  /** Called when a connection starts waiting; `resume` returns true once it took a session. */
  enqueue(resume: () => boolean): void;
  forget(resume: () => boolean): void;
  peak(): number;
};

function createSessionPool(sessions: number): SessionPool {
  let inUse = 0;
  let peak = 0;
  const waiting: Array<() => boolean> = [];
  const wake = (): void => {
    while (waiting.length > 0 && inUse < sessions) waiting.shift()?.();
  };
  return {
    tryTake() {
      if (inUse >= sessions) return false;
      inUse += 1;
      peak = Math.max(peak, inUse);
      return true;
    },
    release() {
      inUse -= 1;
      wake();
    },
    enqueue: (resume) => void waiting.push(resume),
    forget(resume) {
      const at = waiting.indexOf(resume);
      if (at >= 0) waiting.splice(at, 1);
    },
    peak: () => peak,
  };
}

type LinkConnectionArgs = {
  readonly id: number;
  readonly client: net.Socket;
  readonly upstream: net.Socket;
  readonly pool: SessionPool;
  readonly options: DatabaseLinkOptions;
  readonly now: () => number;
};

class LinkConnection {
  private readonly clientReader: FrameReader = createFrameReader(true);
  private readonly serverReader: FrameReader = createFrameReader(false);
  private readonly outbox: Frame[] = [];
  private ready = false;
  private holding = false;
  private closed = false;
  private blind = false;
  private holdSince = 0;
  private waitSince: number | null = null;
  private waitTimer: ReturnType<typeof setTimeout> | null = null;
  private roundTrips = 0;
  private heldMs = 0;
  private longestHoldMs = 0;
  private holdRoundTrips = 0;
  private longestHoldRoundTrips = 0;
  private waitedMs = 0;
  private refused = false;
  private readonly statements: string[] = [];
  private readonly resume = (): boolean => this.takeAndPump();

  constructor(private readonly args: LinkConnectionArgs) {
    const { client, upstream } = args;
    client.on('data', (chunk) => this.fromClient(chunk));
    upstream.on('data', (chunk) => this.fromServer(chunk));
    for (const socket of [client, upstream]) {
      socket.on('close', () => this.close());
      socket.on('error', () => this.close());
    }
  }

  bill(): ConnectionBill {
    return {
      id: this.args.id,
      roundTrips: this.roundTrips,
      heldMs: this.heldMs,
      longestHoldMs: this.longestHoldMs,
      longestHoldRoundTrips: this.longestHoldRoundTrips,
      waitedMs: this.waitedMs,
      refused: this.refused,
      statements: this.statements,
    };
  }

  private later(action: () => void): void {
    const half = this.args.options.roundTripMs / 2;
    if (half <= 0) action();
    else setTimeout(action, half);
  }

  private fromClient(chunk: Buffer): void {
    if (this.blind) {
      this.later(() => this.args.upstream.write(chunk));
      return;
    }
    for (const frame of this.clientReader.push(chunk)) {
      if (frame.tag === null && frame.bytes.length >= 8) {
        const code = frame.bytes.readInt32BE(4);
        if (code === SSL_REQUEST || code === GSS_REQUEST)
          this.serverReader.expectRaw(1);
        if (code === CANCEL_REQUEST) this.blind = true;
      }
      this.later(() => this.arrive(frame));
    }
  }

  /** A client frame reaches the pool, half a round trip after it was sent. */
  private arrive(frame: Frame): void {
    if (this.closed) return;
    this.outbox.push(frame);
    this.pump();
  }

  private pump(): void {
    while (this.outbox.length > 0 && !this.closed) {
      const next = this.outbox[0]!;
      // Hanging up never waits for a session.
      const needsSession = this.ready && next.tag !== TAG.terminate;
      if (needsSession && !this.holding && !this.takeSession()) return;
      this.outbox.shift();
      this.forward(next);
    }
  }

  private forward(frame: Frame): void {
    if (frame.tag === TAG.query || frame.tag === TAG.sync) {
      this.roundTrips += 1;
      this.holdRoundTrips += 1;
    }
    this.sample(frame);
    this.args.upstream.write(frame.bytes);
  }

  private sample(frame: Frame): void {
    const statement = statementOf(frame);
    const keep = this.args.options.statementSample ?? STATEMENT_SAMPLE;
    if (
      statement !== null &&
      !SESSION_STATEMENT.test(statement) &&
      this.statements.length < keep
    )
      this.statements.push(
        statement.replace(/\s+/g, ' ').slice(0, STATEMENT_CHARS)
      );
  }

  private takeSession(): boolean {
    if (this.args.pool.tryTake()) {
      this.beginHold();
      return true;
    }
    if (this.waitSince === null) {
      this.waitSince = this.args.now();
      this.args.pool.enqueue(this.resume);
      this.waitTimer = setTimeout(
        () => this.refuse(),
        this.args.options.waitMs
      );
    }
    return false;
  }

  private takeAndPump(): boolean {
    if (this.closed || !this.args.pool.tryTake()) return false;
    this.beginHold();
    this.pump();
    return true;
  }

  private beginHold(): void {
    this.holding = true;
    this.holdSince = this.args.now();
    if (this.waitSince !== null) {
      this.waitedMs += this.holdSince - this.waitSince;
      this.waitSince = null;
    }
    if (this.waitTimer !== null) clearTimeout(this.waitTimer);
    this.waitTimer = null;
  }

  private endHold(): void {
    if (!this.holding) return;
    this.holding = false;
    const held = this.args.now() - this.holdSince;
    this.heldMs += held;
    this.longestHoldMs = Math.max(this.longestHoldMs, held);
    this.longestHoldRoundTrips = Math.max(
      this.longestHoldRoundTrips,
      this.holdRoundTrips
    );
    this.holdRoundTrips = 0;
    this.args.pool.release();
  }

  private refuse(): void {
    if (this.closed) return;
    this.refused = true;
    this.args.pool.forget(this.resume);
    if (this.waitSince !== null)
      this.waitedMs += this.args.now() - this.waitSince;
    this.waitSince = null;
    this.args.client.write(
      fatalPoolError('Timed out while waiting for an open slot in the pool.')
    );
    this.close();
  }

  private fromServer(chunk: Buffer): void {
    if (this.blind) {
      this.later(() => this.args.client.write(chunk));
      return;
    }
    for (const frame of this.serverReader.push(chunk)) {
      if (frame.tag === TAG.readyForQuery && frame.bytes.length >= 6) {
        this.ready = true;
        // Idle ends the hold. Anything else is inside a transaction and keeps its session.
        if (frame.bytes[5] === IDLE) this.endHold();
      }
      // If the server agreed to encrypt, nothing after the answer can be read.
      if (frame.tag === null && frame.bytes[0] === SSL_ACCEPTED)
        this.blind = true;
      this.later(() => {
        if (!this.closed) this.args.client.write(frame.bytes);
      });
    }
  }

  private close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.waitTimer !== null) clearTimeout(this.waitTimer);
    this.args.pool.forget(this.resume);
    this.endHold();
    this.args.client.destroy();
    this.args.upstream.destroy();
  }
}

export async function startDatabaseLink(
  options: DatabaseLinkOptions,
  now: () => number = () => performance.now()
): Promise<DatabaseLink> {
  const upstreamUrl = new URL(options.upstreamUrl);
  const upstreamPort = Number(upstreamUrl.port || 5432);
  const pool = createSessionPool(options.sessions);
  const connections: LinkConnection[] = [];
  const sockets = new Set<net.Socket>();
  // The configured round trip owns latency; neither proxy leg adds Nagle buffering.
  const server = net.createServer({ noDelay: true }, (client) => {
    const upstream = net.connect({
      port: upstreamPort,
      host: upstreamUrl.hostname,
      noDelay: true,
    });
    for (const socket of [client, upstream]) {
      sockets.add(socket);
      socket.once('close', () => sockets.delete(socket));
    }
    connections.push(
      new LinkConnection({
        id: connections.length,
        client,
        upstream,
        pool,
        options,
        now,
      })
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, '127.0.0.1', () => resolve());
  });
  const port = (server.address() as net.AddressInfo).port;
  const url = new URL(options.upstreamUrl);
  url.hostname = '127.0.0.1';
  url.port = String(port);
  return {
    url: url.toString(),
    port,
    summary() {
      const bills = connections.map((connection) => connection.bill());
      return {
        connections: bills.length,
        peakSessions: pool.peak(),
        refused: bills.filter((bill) => bill.refused).length,
        bills,
      };
    },
    stop: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        for (const socket of sockets) socket.destroy();
      }),
  };
}
