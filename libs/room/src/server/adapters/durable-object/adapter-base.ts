import { RoomServer } from '../../core/room-server';
import type { RoomStorage } from '../../core/storage';
import type { RoomModule, RoomState } from '../../../types';

import {
  newWebSocketPair,
  type DurableObjectInstance,
  type DurableObjectInstanceState,
  type WebSocketUpgradeResponseInit,
} from './types';

/**
 * Resolved configuration handed to a {@link RoomDurableObjectAdapterBase}
 * instance. All defaults applied; no optional fields. Internal to the
 * adapter package.
 */
export type ResolvedAdapterConfig<S extends RoomState, C, E, Identity, Env> = {
  module: RoomModule<S, C, E, Identity>;
  identityHeader: string;
  parseIdentity: (raw: string) => Identity | null;
  createStorage: (state: DurableObjectInstanceState, env: Env) => RoomStorage;
};

/**
 * Module-scoped base class for the Cloudflare DO adapter. The Workers
 * runtime instantiates a DO via the fixed `(ctx, env)` constructor; the
 * factory in {@link ./adapter} returns a tiny subclass that forwards a
 * pre-resolved config as the third constructor argument.
 */
export class RoomDurableObjectAdapterBase<
  S extends RoomState,
  C,
  E,
  Identity,
  Env,
> implements DurableObjectInstance
{
  protected readonly ctx: DurableObjectInstanceState;
  readonly _env: Env;
  private readonly config: ResolvedAdapterConfig<S, C, E, Identity, Env>;
  private server: RoomServer<S, C, E, Identity> | null = null;
  private readonly wsMeta = new WeakMap<
    WebSocket,
    { id: string; identity: Identity }
  >();

  constructor(
    ctx: DurableObjectInstanceState,
    env: Env,
    config: ResolvedAdapterConfig<S, C, E, Identity, Env>
  ) {
    this.ctx = ctx;
    this._env = env;
    this.config = config;
  }

  async fetch(request: Request): Promise<Response> {
    const topic = new URL(request.url).searchParams.get('topic') ?? '';
    if (topic.length === 0) {
      return new Response('missing topic', { status: 400 });
    }
    await this.ensureServer(topic);
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket Upgrade', { status: 426 });
    }
    const rawIdentity =
      request.headers.get(this.config.identityHeader)?.trim() ?? '';
    const identity = this.config.parseIdentity(rawIdentity);
    if (identity === null) {
      return new Response('missing or invalid identity header', {
        status: 401,
      });
    }
    if (this.server === null) {
      return new Response('room server unavailable', { status: 500 });
    }
    return this.acceptUpgrade(this.server, identity);
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    const meta = this.wsMeta.get(ws);
    if (meta === undefined || this.server === null) return;
    const data =
      typeof message === 'string' ? message : new TextDecoder().decode(message);
    let parsed: unknown;
    try {
      parsed = JSON.parse(data) as unknown;
    } catch {
      return;
    }
    await this.server.handleClientMessage(meta.id, meta.identity, parsed);
  }

  webSocketClose(ws: WebSocket): void {
    const meta = this.wsMeta.get(ws);
    if (meta !== undefined && this.server !== null) {
      this.server.unregisterConnection(meta.id);
    }
  }

  private async ensureServer(topic: string): Promise<void> {
    await this.ctx.blockConcurrencyWhile(async () => {
      if (this.server !== null) return;
      const storage = this.config.createStorage(this.ctx, this._env);
      this.server = new RoomServer({
        topic,
        module: this.config.module,
        storage,
      });
      await this.server.hydrateFromStorage();
    });
  }

  private acceptUpgrade(
    server: RoomServer<S, C, E, Identity>,
    identity: Identity
  ): Response {
    const [client, serverWs] = newWebSocketPair();
    const connId = crypto.randomUUID();
    this.wsMeta.set(serverWs, { id: connId, identity });
    server.registerConnection(connId, (msg) => {
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
    } as WebSocketUpgradeResponseInit);
  }
}
