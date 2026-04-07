import { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';
import { createPatchDbApiHandler } from '@gamezilla/patch-db/api';
import { DurableObjectPubSub } from '@gamezilla/shared/pub-sub/impl-durable-object';
import { SqlClientImplPlanetScale } from '@gamezilla/shared/sql-client/impl-planetscale';

export interface Env {
  DATABASE_URL: string;
  PUBSUB_DO: DurableObjectNamespace;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    headers.set(k, v);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

async function createHandler(env: Env) {
  const sqlClient = new SqlClientImplPlanetScale(env.DATABASE_URL);
  await sqlClient.connect();

  const db = new PatchDbImplPostgres(sqlClient);
  await db.migrate();

  const doId = env.PUBSUB_DO.idFromName('global');
  const doStub = env.PUBSUB_DO.get(doId);
  const pubSub = new DurableObjectPubSub(doStub);

  return createPatchDbApiHandler({ db, pubSub });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === '/health') {
      return withCors(
        new Response('ok', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      );
    }

    // SSE events path — forward to the Durable Object for cross-request push
    if (url.pathname.endsWith('/events') && request.method === 'GET') {
      const doId = env.PUBSUB_DO.idFromName('global');
      const doStub = env.PUBSUB_DO.get(doId);
      const doResponse = await doStub.fetch(request);
      return withCors(doResponse);
    }

    try {
      const handler = await createHandler(env);
      const { handleRequest, basePath } = handler;

      if (url.pathname.startsWith(basePath)) {
        const res = await handleRequest(request);
        if (res === null) {
          return withCors(
            new Response('Not Found', {
              status: 404,
              headers: { 'Content-Type': 'text/plain' },
            })
          );
        }
        return withCors(res);
      }
    } catch (err: unknown) {
      console.error('[api] handler error:', err);
      const message = err instanceof Error ? err.message : String(err);
      return withCors(
        new Response(JSON.stringify({ error: message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }

    return withCors(
      new Response('Not Found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      })
    );
  },
} satisfies ExportedHandler<Env>;

/**
 * Durable Object that manages SSE/WebSocket connections for cross-request
 * pub-sub invalidation broadcasts.
 *
 * Workers forward SSE requests here. Write requests notify via POST /publish.
 * The DO broadcasts to all connected WebSocket clients.
 */
export class PubSubDurableObject implements DurableObject {
  private readonly connections = new Set<WebSocket>();

  constructor(_state: DurableObjectState, _env: Env) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/publish' && request.method === 'POST') {
      return this.handlePublish(request);
    }

    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket();
    }

    return this.handleSSE(request);
  }

  private async handlePublish(request: Request): Promise<Response> {
    const body = (await request.json()) as {
      topic: string;
      message: unknown;
    };
    const data = JSON.stringify(body.message);

    for (const ws of this.connections) {
      try {
        ws.send(data);
      } catch {
        this.connections.delete(ws);
      }
    }

    return new Response('ok', { status: 200 });
  }

  private handleWebSocket(): Response {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();
    this.connections.add(server);

    server.addEventListener('close', () => {
      this.connections.delete(server);
    });
    server.addEventListener('error', () => {
      this.connections.delete(server);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  private handleSSE(request: Request): Response {
    const encoder = new TextEncoder();
    let closed = false;

    const stream = new ReadableStream({
      start: (controller) => {
        const onMessage = (_event: MessageEvent) => {
          if (closed) return;
          const data = JSON.stringify({ type: 'invalidated' });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        const pair = new WebSocketPair();
        const server = pair[1];
        server.accept();
        this.connections.add(server);
        server.addEventListener('message', onMessage);
        server.addEventListener('close', () => {
          this.connections.delete(server);
        });

        request.signal?.addEventListener('abort', () => {
          closed = true;
          this.connections.delete(server);
          server.close();
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }
}
