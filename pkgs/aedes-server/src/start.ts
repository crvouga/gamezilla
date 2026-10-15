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
import { Aedes, type PublishPacket } from 'aedes';
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
  /** Host and port for MQTT-over-WebSocket clients. */
  readonly wsOrigin: string;
  readonly wsUrl: string;
  readonly wsPort: number;
  stop(): Promise<void>;
};

export type StartAedesServerOptions = {
  /** Bind address. Defaults to loopback so the helper is local-stack safe. */
  readonly host?: string;
  /** MQTT-over-TCP port. `0` asks the OS for an available port. */
  readonly mqttPort?: number;
  /** MQTT-over-WebSocket port. `0` asks the OS for an available port. */
  readonly wsPort?: number;
};

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
  const broker = new Aedes({
    authenticate: (_client, _username, _password, done) => {
      // Local stack clients use both credentialed and anonymous MQTT clients.
      done(null, true);
    },
    authorizePublish: (_client, _packet, done) => {
      done(null);
    },
    authorizeSubscribe: (_client, subscription, done) => {
      done(null, subscription);
    },
  });

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
