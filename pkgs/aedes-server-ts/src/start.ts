// @io-wall-ok
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import {
  createServer as createTcpServer,
  type Server as TcpServer,
} from 'node:net';
import type { Duplex } from 'node:stream';
import {
  Aedes,
  type AedesOptions,
  type Client,
  type PublishPacket,
} from 'aedes';
import websocketStreamModule from 'websocket-stream';

type WebsocketServer = {
  close(callback: (error?: Error) => void): void;
};

type WebsocketStreamModule = {
  createServer(
    options: { server: TcpServer; path: string },
    callback: (stream: Duplex, request: IncomingMessage) => void
  ): WebsocketServer;
};

const websocketStream =
  websocketStreamModule as unknown as WebsocketStreamModule;
const DEFAULT_HOST = '127.0.0.1';
const MQTT_WS_PATH = '/mqtt';

export type AedesServerHandle = {
  /** Host and port for MQTT-over-TCP clients. */
  readonly mqttOrigin: string;
  readonly mqttUrl: string;
  readonly mqttPort: number;
  /** Everything the broker has refused a limited client, in order. */
  denials(): readonly Denial[];
  /** Host and port for MQTT-over-WebSocket clients. */
  readonly wsOrigin: string;
  readonly wsUrl: string;
  readonly wsPort: number;
  stop(): Promise<void>;
};

/** What a connected client may do on the broker; each takes a broker topic. */
export type ClientAccess = {
  canSubscribe(topic: string): boolean;
  canPublish(topic: string): boolean;
  /** Whether a message on `topic` is delivered to this client. */
  canReceive(topic: string): boolean;
};

/**
 * What the broker does with a connecting client: let it do anything (the
 * stack's own services), refuse it, or limit it to what a session grants.
 */
export type Admission =
  | { readonly kind: 'open' }
  | { readonly kind: 'refused' }
  | { readonly kind: 'limited'; readonly access: ClientAccess };

export type ClientCredentials = {
  readonly clientId: string;
  readonly username: string | undefined;
  readonly password: string | undefined;
};

/** A request the broker refused a limited client. */
export type Denial = {
  readonly operation: 'connect' | 'subscribe' | 'publish';
  readonly clientId: string;
  /** Null for a refused connection, which names no topic. */
  readonly topic: string | null;
  /**
   * The same client was later let through the same operation on this topic:
   * what refused it was a stale session, and a new one cured it.
   */
  readonly cured: boolean;
};

type RecordedDenial = { -readonly [K in keyof Denial]: Denial[K] };

/** Mark what a client was refused earlier as cured now that it is let through. */
function cure(
  denials: readonly RecordedDenial[],
  operation: Denial['operation'],
  clientId: string,
  topic: string
): void {
  for (const denial of denials) {
    if (
      denial.operation === operation &&
      denial.clientId === clientId &&
      denial.topic === topic
    ) {
      denial.cured = true;
    }
  }
}

export type StartAedesServerOptions = {
  /**
   * Decides every connection. Without it the broker is open, which no
   * deployed broker is: a stack that wants to find what a real broker would
   * refuse passes the same rules the real one runs.
   */
  readonly admit?: (credentials: ClientCredentials) => Admission;
  /** Bind address. Defaults to loopback so the helper is local-stack safe. */
  readonly host?: string;
  /** MQTT-over-TCP port. `0` asks the OS for an available port. */
  readonly mqttPort?: number;
  /** MQTT-over-WebSocket port. `0` asks the OS for an available port. */
  readonly wsPort?: number;
};

/** The broker's admission and authorization, from what the caller admits. */
function brokerRules(
  admit: StartAedesServerOptions['admit'],
  denials: RecordedDenial[]
): AedesOptions {
  const limits = new WeakMap<Client, ClientAccess>();
  return {
    authenticate: (client, username, password, done) => {
      const admission = admit?.({
        clientId: client.id,
        username,
        password: password?.toString('utf8'),
      }) ?? { kind: 'open' };
      if (admission.kind === 'refused') {
        denials.push({
          operation: 'connect',
          clientId: client.id,
          topic: null,
          cured: false,
        });
        const refusal = Object.assign(new Error('not authorized'), {
          returnCode: 5 as const,
        });
        done(refusal as never, null);
        return;
      }
      if (admission.kind === 'limited') limits.set(client, admission.access);
      done(null, true);
    },
    authorizePublish: (client, packet, done) => {
      const access = client === null ? undefined : limits.get(client);
      if (access === undefined || access.canPublish(packet.topic)) {
        if (client !== null) cure(denials, 'publish', client.id, packet.topic);
        done(null);
        return;
      }
      denials.push({
        operation: 'publish',
        clientId: client?.id ?? '',
        topic: packet.topic,
        cured: false,
      });
      done(new Error('not authorized'));
    },
    authorizeSubscribe: (client, subscription, done) => {
      const access = limits.get(client);
      if (access === undefined || access.canSubscribe(subscription.topic)) {
        cure(denials, 'subscribe', client.id, subscription.topic);
        done(null, subscription);
        return;
      }
      denials.push({
        operation: 'subscribe',
        clientId: client.id,
        topic: subscription.topic,
        cured: false,
      });
      done(null, null);
    },
    authorizeForward: (client, packet) => {
      const access = limits.get(client);
      return access === undefined || access.canReceive(packet.topic)
        ? packet
        : undefined;
    },
  };
}

/**
 * Start an in-memory Aedes broker with MQTT/TCP and MQTT/WebSocket listeners.
 *
 * Each invocation creates an independent broker and asks the OS for ports by
 * default, so multiple local stacks can run concurrently.
 */
export async function startAedesServer(
  options: StartAedesServerOptions = {}
): Promise<AedesServerHandle> {
  const host = options.host ?? DEFAULT_HOST;
  const denials: RecordedDenial[] = [];
  const broker = new Aedes(brokerRules(options.admit, denials));

  const mqttServer = createTcpServer((stream) => {
    broker.handle(stream);
  });
  const httpServer = createHttpServer((request, response) => {
    if (request.method === 'POST' && request.url === '/api/v5/publish') {
      void publishHttpMessage(request, response, broker);
      return;
    }
    response.writeHead(404);
    response.end();
  });
  const wsServer = websocketStream.createServer(
    { server: httpServer, path: MQTT_WS_PATH },
    (stream, request) => {
      broker.handle(stream, request);
    }
  );

  try {
    await broker.listen();
    const [mqttPort, wsPort] = await Promise.all([
      listen(mqttServer, options.mqttPort ?? 0, host),
      listen(httpServer, options.wsPort ?? 0, host),
    ]);
    const hostForUrl = formatHostForUrl(host);
    const mqttOrigin = `mqtt://${hostForUrl}:${String(mqttPort)}`;
    const wsOrigin = `ws://${hostForUrl}:${String(wsPort)}`;
    const mqttUrl = mqttOrigin;
    const wsUrl = `${wsOrigin}${MQTT_WS_PATH}`;

    let stopPromise: Promise<void> | undefined;
    return {
      mqttOrigin,
      mqttUrl,
      mqttPort,
      denials: () => denials,
      wsOrigin,
      wsUrl,
      wsPort,
      stop: () => {
        stopPromise ??= stopServers(broker, mqttServer, httpServer, wsServer);
        return stopPromise;
      },
    };
  } catch (error) {
    try {
      await stopServers(broker, mqttServer, httpServer, wsServer);
    } catch {
      // Preserve the listener-start error; cleanup is best effort on failure.
    }
    throw error;
  }
}

async function publishHttpMessage(
  request: IncomingMessage,
  response: ServerResponse,
  broker: Aedes
): Promise<void> {
  try {
    const raw = await readRequestBody(request);
    const body = JSON.parse(raw) as { topic?: unknown; payload?: unknown };
    if (typeof body.topic !== 'string' || typeof body.payload !== 'string') {
      response.writeHead(400);
      response.end('invalid publish body');
      return;
    }
    const published = Promise.withResolvers<void>();
    broker.publish(
      {
        cmd: 'publish',
        topic: body.topic,
        payload: Buffer.from(body.payload),
        qos: 0,
        retain: false,
        dup: false,
      } as PublishPacket,
      (error) => {
        if (error === undefined || error === null) published.resolve();
        else published.reject(error);
      }
    );
    await published.promise;
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{}');
  } catch (error) {
    response.writeHead(400);
    response.end(error instanceof Error ? error.message : String(error));
  }
}

function readRequestBody(request: IncomingMessage): Promise<string> {
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  const chunks: Buffer[] = [];
  request.on('data', (chunk: Buffer) => chunks.push(chunk));
  request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  request.on('error', reject);
  return promise;
}

function formatHostForUrl(host: string): string {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}

function listen(
  server: TcpServer,
  port: number,
  host: string
): Promise<number> {
  const { promise, resolve, reject } = Promise.withResolvers<number>();
  const onError = (error: Error) => {
    server.off('listening', onListening);
    reject(error);
  };
  const onListening = () => {
    server.off('error', onError);
    const address = server.address();
    if (address === null || typeof address === 'string') {
      reject(new Error('Listener did not expose an address after starting'));
      return;
    }
    resolve(address.port);
  };

  server.once('error', onError);
  server.once('listening', onListening);
  try {
    server.listen(port, host);
  } catch (error) {
    server.off('error', onError);
    server.off('listening', onListening);
    reject(error);
  }
  return promise;
}

async function stopServers(
  broker: Aedes,
  mqttServer: TcpServer,
  httpServer: TcpServer,
  wsServer: WebsocketServer
): Promise<void> {
  let firstError: unknown;
  try {
    await closeBroker(broker);
  } catch (error) {
    firstError = error;
  }

  const results = await Promise.allSettled([
    closeWebsocketServer(wsServer),
    closeNodeServer(mqttServer),
    closeNodeServer(httpServer),
  ]);
  if (firstError === undefined) {
    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );
    firstError = failed?.reason;
  }
  if (firstError !== undefined) throw firstError;
}

function closeBroker(broker: Aedes): Promise<void> {
  if (broker.closed) return Promise.resolve();
  const { promise, resolve } = Promise.withResolvers<void>();
  broker.close(() => resolve());
  return promise;
}

function closeNodeServer(server: TcpServer): Promise<void> {
  if (!server.listening) return Promise.resolve();
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  server.close((error) => {
    if (error !== undefined && !isServerNotRunning(error)) {
      reject(error);
    } else {
      resolve();
    }
  });
  return promise;
}

function closeWebsocketServer(server: WebsocketServer): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  try {
    server.close((error) => {
      if (error !== undefined && !isServerNotRunning(error)) {
        reject(error);
      } else {
        resolve();
      }
    });
  } catch (error) {
    if (isServerNotRunning(error)) resolve();
    else reject(error);
  }
  return promise;
}

function isServerNotRunning(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ERR_SERVER_NOT_RUNNING'
  );
}
