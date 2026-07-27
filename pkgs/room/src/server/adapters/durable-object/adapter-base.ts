import { Assert } from '@pkgs/assert';

import {
  parseRoomModuleName,
  type RoomCommandPayload,
  type RoomEvent,
  type RoomModuleName,
  type RoomState,
} from '../../../types';
import { RoomServer } from '../../core/room-server';

import type { ResolvedAdapterConfig } from './adapter-base-types';
import {
  restoreHibernatedSockets,
  WS_CLOSE_SESSION_LOST,
  type WsMeta,
} from './hibernation-restore';
import { writeRoomSocketAttachment } from './socket-attachment';
import {
  newWebSocketPair,
  type DurableObjectInstance,
  type DurableObjectInstanceState,
  type WebSocketUpgradeResponseInit,
} from './types';

export type { ResolvedAdapterConfig } from './adapter-base-types';

const crash: Assert = Assert.crash();

/** WebSocket close codes used when the adapter rejects/abandons a connection. */
const WS_CLOSE = {
  /** RFC 6455 §7.4: 1003 — endpoint received data of a type it cannot accept. */
  invalidFrame: 1003,
  sessionLost: WS_CLOSE_SESSION_LOST,
} as const;

/** All adapter HTTP error responses share the same JSON shape: `{ error: string }`. */
function errorResponse(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type AcceptUpgradeArgs<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
> = {
  server: RoomServer<S, C, E, Identity>;
  identity: Identity;
  identityRaw: string;
  moduleName: RoomModuleName;
  topic: string;
};

/**
 * Module-scoped base class for the Cloudflare DO adapter. The Workers
 * runtime instantiates a DO via the fixed `(ctx, env)` constructor; the
 * factory in {@link ./adapter} returns a tiny subclass that forwards a
 * pre-resolved config as the third constructor argument.
 *
 * One DO instance hosts one {@link RoomServer} per configured module
 * (created lazily on first upgrade). Each accepted socket carries its
 * `moduleName` in {@link wsMeta}, so inbound frames route to exactly the
 * server that opened them. Per-socket routing is also written to the
 * Hibernation WebSocket attachment so {@link ensureRestored} can rebuild
 * `wsMeta` + senders after DO eviction.
 */
export class RoomDurableObjectAdapterBase<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
  Env,
> implements DurableObjectInstance {
  protected readonly ctx: DurableObjectInstanceState;
  readonly _env: Env;
  private readonly config: ResolvedAdapterConfig<S, C, E, Identity, Env>;
  private readonly servers = new Map<
    RoomModuleName,
    RoomServer<S, C, E, Identity>
  >();
  private readonly wsMeta = new WeakMap<WebSocket, WsMeta<Identity>>();
  private restored = false;

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
    await this.ensureRestored();
    const url = new URL(request.url);
    const topic = url.searchParams.get('topic')?.trim() ?? '';
    if (topic.length === 0) return errorResponse(400, 'missing topic');
    const moduleName = this.parseModuleQuery(url);
    if (moduleName instanceof Response) return moduleName;
    if (request.headers.get('Upgrade') !== 'websocket') {
      return errorResponse(426, 'expected WebSocket upgrade');
    }
    const identityRaw =
      request.headers.get(this.config.identityHeader)?.trim() ?? '';
    const identity = this.config.parseIdentity(identityRaw);
    if (identity === null) {
      return errorResponse(401, 'missing or invalid identity header');
    }
    const server = await this.getOrCreateServer(topic, moduleName);
    return this.acceptUpgrade({
      server,
      identity,
      identityRaw,
      moduleName,
      topic,
    });
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    await this.ensureRestored();
    const routed = this.routeSocket(ws);
    if (routed === null) return;
    const { server, meta } = routed;
    const text =
      typeof message === 'string' ? message : new TextDecoder().decode(message);
    const parsed = parseJsonOrNull(text);
    if (parsed === null) {
      ws.close(WS_CLOSE.invalidFrame, 'invalid JSON frame');
      return;
    }
    await server.handleClientMessage(meta.id, meta.identity, parsed);
  }

  webSocketClose(ws: WebSocket): void {
    const meta = this.wsMeta.get(ws);
    if (meta === undefined) return;
    this.servers.get(meta.moduleName)?.unregisterConnection(meta.id);
  }

  /**
   * Rebuilds in-memory socket routing after DO hibernation eviction.
   * Idempotent for the lifetime of this JS isolate.
   */
  private async ensureRestored(): Promise<void> {
    if (this.restored) return;
    await this.ctx.blockConcurrencyWhile(async () => {
      if (this.restored) return;
      await restoreHibernatedSockets({
        ctx: this.ctx,
        config: this.config,
        servers: this.servers,
        wsMeta: this.wsMeta,
        createServerLocked: (topic, moduleName) =>
          this.createServerLocked(topic, moduleName),
        sendJson,
      });
      this.restored = true;
    });
  }

  /**
   * Resolves the {@link RoomServer} responsible for an inbound socket frame.
   * Returns `null` (and closes the socket) when routing is still missing
   * after restore — genuine last resort; the client reconnects.
   */
  private routeSocket(
    ws: WebSocket
  ): { server: RoomServer<S, C, E, Identity>; meta: WsMeta<Identity> } | null {
    const meta = this.wsMeta.get(ws);
    if (meta === undefined) {
      ws.close(WS_CLOSE.sessionLost, 'socket lost adapter routing state');
      return null;
    }
    const server = this.servers.get(meta.moduleName);
    crash.ok(
      server !== undefined,
      'RoomServer missing for routed socket — module was deregistered after upgrade',
      { moduleName: meta.moduleName }
    );
    return { server, meta };
  }

  private parseModuleQuery(url: URL): RoomModuleName | Response {
    const raw = url.searchParams.get('module')?.trim() ?? '';
    if (raw.length === 0) return errorResponse(400, 'missing module');
    const name = parseRoomModuleName(raw);
    if (name === null) return errorResponse(400, `invalid module: ${raw}`);
    if (!this.config.modulesByName.has(name)) {
      return errorResponse(400, `unknown module: ${raw}`);
    }
    return name;
  }

  /**
   * Latch-free create/get. Caller must already hold
   * {@link DurableObjectInstanceState.blockConcurrencyWhile}.
   */
  private async createServerLocked(
    topic: string,
    moduleName: RoomModuleName
  ): Promise<RoomServer<S, C, E, Identity>> {
    const existing = this.servers.get(moduleName);
    if (existing !== undefined) {
      crash.ok(
        existing.topic === topic,
        'RoomServer topic drifted within a DO instance — gateway must key DO id by topic',
        { existing: existing.topic, requested: topic, moduleName }
      );
      return existing;
    }
    const moduleImpl = this.config.modulesByName.get(moduleName);
    crash.ok(
      moduleImpl !== undefined,
      'module disappeared between parseModuleQuery and createServerLocked',
      { moduleName }
    );
    const storage = this.config.createStorage(
      this.ctx,
      this._env,
      moduleName
    );
    const server = new RoomServer({ topic, module: moduleImpl, storage });
    await server.hydrateFromStorage();
    this.servers.set(moduleName, server);
    return server;
  }

  private async getOrCreateServer(
    topic: string,
    moduleName: RoomModuleName
  ): Promise<RoomServer<S, C, E, Identity>> {
    return await this.ctx.blockConcurrencyWhile(() =>
      this.createServerLocked(topic, moduleName)
    );
  }

  private acceptUpgrade(args: AcceptUpgradeArgs<S, C, E, Identity>): Response {
    const { server, identity, identityRaw, moduleName, topic } = args;
    const [client, serverWs] = newWebSocketPair();
    const connId = crypto.randomUUID();
    this.wsMeta.set(serverWs, { id: connId, identity, moduleName });
    writeRoomSocketAttachment(serverWs, {
      connId,
      identityRaw,
      moduleName,
      topic,
    });
    server.registerConnection(connId, (msg) => sendJson(serverWs, msg));
    this.ctx.acceptWebSocket(serverWs, [connId, moduleName]);
    return new Response(null, {
      status: 101,
      webSocket: client,
    } as WebSocketUpgradeResponseInit);
  }
}

function parseJsonOrNull(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * Best-effort JSON broadcast to a connected socket. A throw here means the
 * peer is mid-close; the matching `webSocketClose` will unregister cleanly.
 */
function sendJson(ws: WebSocket, payload: unknown): void {
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    // socket is closing
  }
}
