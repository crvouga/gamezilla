import { CounterModule } from '@gamezilla/domain/spaces/counter-room-module';
import type { RoomState } from '@gamezilla/room';
import { RoomServer } from '@gamezilla/room/server';

import { DoRoomStorage } from './do-room-storage';

const ACCOUNT_HEADER = 'x-gamezilla-account-id';

type CounterState = RoomState;
type CounterCommand = unknown;
type CounterEvent = unknown;

/**
 * Durable Object: one instance per room topic (`idFromName(topic)`).
 * Authoritative counter (and future room state) via {@link RoomServer}.
 */
export class RoomRelay implements DurableObject {
  protected readonly ctx: DurableObjectState;
  readonly _env: unknown;

  private server: RoomServer<
    CounterState,
    CounterCommand,
    CounterEvent,
    string
  > | null = null;

  private readonly wsMeta = new WeakMap<
    WebSocket,
    { id: string; accountId: string }
  >();

  constructor(ctx: DurableObjectState, env: unknown) {
    this.ctx = ctx;
    this._env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const topic = url.searchParams.get('topic') ?? '';
    if (topic.length === 0) {
      return new Response('missing topic', { status: 400 });
    }

    await this.ctx.blockConcurrencyWhile(async () => {
      if (this.server === null) {
        const storage = new DoRoomStorage(this.ctx.storage);
        this.server = new RoomServer({
          topic,
          module: CounterModule,
          storage,
        });
        await this.server.hydrateFromStorage();
      }
    });

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket Upgrade', { status: 426 });
    }

    const accountId = request.headers.get(ACCOUNT_HEADER)?.trim() ?? '';
    if (accountId.length === 0) {
      return new Response('missing account header', { status: 401 });
    }

    if (this.server === null) {
      return new Response('room server unavailable', { status: 500 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const serverWs = pair[1];
    const connId = crypto.randomUUID();
    this.wsMeta.set(serverWs, { id: connId, accountId });

    this.server.registerConnection(connId, (msg) => {
      try {
        serverWs.send(JSON.stringify(msg));
      } catch {
        // socket may be closing
      }
    });

    this.ctx.acceptWebSocket(serverWs, [connId]);

    return new Response(null, {
      status: 101,
      webSocket: client,
    } as ResponseInit);
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    const meta = this.wsMeta.get(ws);
    if (meta === undefined || this.server === null) {
      return;
    }
    const data =
      typeof message === 'string'
        ? message
        : new TextDecoder().decode(message);
    let parsed: unknown;
    try {
      parsed = JSON.parse(data) as unknown;
    } catch {
      return;
    }
    await this.server.handleClientMessage(
      meta.id,
      meta.accountId,
      parsed
    );
  }

  webSocketClose(ws: WebSocket): void {
    const meta = this.wsMeta.get(ws);
    if (meta !== undefined && this.server !== null) {
      this.server.unregisterConnection(meta.id);
    }
  }
}
