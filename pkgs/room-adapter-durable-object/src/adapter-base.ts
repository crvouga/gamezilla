import { Assert } from '@pkgs/assert';
import {
  ATTR,
  type Span,
  serializeTraceContext,
} from '@pkgs/observability/worker';

import {
  parseRoomModuleName,
  type RoomCommandPayload,
  type RoomEvent,
  type RoomModuleName,
  type RoomState,
} from '@pkgs/room';
import { RoomServer } from '@pkgs/room/server';

import type { ResolvedAdapterConfig } from './adapter-base-types';
import { DoAlarmHub, openDoModuleSchedule } from './do-schedule';
import {
  restoreHibernatedSockets,
  WS_CLOSE_SESSION_LOST,
  type WsMeta,
} from './hibernation-restore';
import {
  observeRoomError,
  observeRoomMessage,
  observeRoomUpgrade,
} from './observability';
import { writeRoomSocketAttachment } from './socket-attachment';
import { roomDoKeyNs } from './storage-keys';
import {
  type DurableObjectInstance,
  type DurableObjectInstanceState,
  newWebSocketPair,
  type WebSocketUpgradeResponseInit,
} from './types';

export type { ResolvedAdapterConfig } from './adapter-base-types';

const crash: Assert = Assert.crash();

/** WebSocket close codes used when the adapter rejects/abandons a connection. */
const WS_CLOSE = {
  /** RFC 6455 §7.4: 1003 — endpoint received data of a type it cannot accept. */
  invalidFrame: 1003,
  sessionLost: WS_CLOSE_SESSION_LOST,
  /** Same (identity, clientId) reconnected; prior socket is obsolete. */
  sessionTakenOver: 4000,
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
  clientId: string;
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
> implements DurableObjectInstance
{
  protected readonly ctx: DurableObjectInstanceState;
  readonly _env: Env;
  private readonly config: ResolvedAdapterConfig<S, C, E, Identity, Env>;
  private readonly servers = new Map<
    RoomModuleName,
    RoomServer<S, C, E, Identity>
  >();
  private readonly scheduleFire = new Map<
    RoomModuleName,
    () => Promise<void>
  >();
  private readonly alarmHub: DoAlarmHub;
  private readonly wsMeta = new WeakMap<WebSocket, WsMeta<Identity>>();
  private restored = false;
  private readonly telemetry;

  constructor(
    ctx: DurableObjectInstanceState,
    env: Env,
    config: ResolvedAdapterConfig<S, C, E, Identity, Env>
  ) {
    this.ctx = ctx;
    this._env = env;
    this.config = config;
    this.alarmHub = new DoAlarmHub(ctx.storage);
    this.telemetry = config.telemetry(env);
  }

  /** Cloudflare DO alarm callback — injects due scheduled commands. */
  async alarm(): Promise<void> {
    await this.ensureRestored();
    await this.ensureServersForPendingAlarms();
    for (const fire of this.scheduleFire.values()) {
      await fire();
    }
  }

  /** Recreate RoomServers after eviction when an alarm fires with no sockets. */
  private async ensureServersForPendingAlarms(): Promise<void> {
    for (const moduleName of this.config.modulesByName.keys()) {
      if (this.servers.has(moduleName)) continue;
      const ns = roomDoKeyNs(moduleName);
      const topic = await this.ctx.storage.get<string>(ns.topic);
      if (typeof topic !== 'string' || topic.length === 0) continue;
      const pending = await this.ctx.storage.list({
        prefix: ns.schedulePrefix,
        limit: 1,
      });
      if (pending.size === 0) continue;
      await this.getOrCreateServer(topic, moduleName);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    try {
      return await observeRoomUpgrade(
        request,
        {
          moduleName: url.searchParams.get('module')?.trim() ?? '',
          topic: url.searchParams.get('topic')?.trim() ?? '',
        },
        (span) => this.handleUpgrade(request, url, span)
      );
    } finally {
      this.flushTelemetry();
    }
  }

  private async handleUpgrade(
    request: Request,
    url: URL,
    span: Span
  ): Promise<Response> {
    await this.ensureRestored();
    const topic = url.searchParams.get('topic')?.trim() ?? '';
    if (topic.length === 0) return errorResponse(400, 'missing topic');
    const moduleName = this.parseModuleQuery(url);
    if (moduleName instanceof Response) return moduleName;
    if (request.headers.get('Upgrade') !== 'websocket') {
      return errorResponse(426, 'expected WebSocket upgrade');
    }
    const auth = this.parseUpgradeIdentity(request);
    if (auth instanceof Response) return auth;
    span.setAttribute(ATTR.USER_ID, auth.identityRaw);
    const server = await this.getOrCreateServer(topic, moduleName);
    return this.acceptUpgrade({
      server,
      identity: auth.identity,
      identityRaw: auth.identityRaw,
      clientId: this.resolveClientId(request),
      moduleName,
      topic,
    });
  }

  private parseUpgradeIdentity(
    request: Request
  ): { identity: Identity; identityRaw: string } | Response {
    const identityRaw =
      request.headers.get(this.config.identityHeader)?.trim() ?? '';
    const identity = this.config.parseIdentity(identityRaw);
    if (identity === null) {
      return errorResponse(401, 'missing or invalid identity header');
    }
    return { identity, identityRaw };
  }

  private resolveClientId(request: Request): string {
    const header =
      request.headers.get(this.config.clientIdHeader)?.trim() ?? '';
    return header.length > 0 ? header : this.config.createId();
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    try {
      await this.ensureRestored();
      const routed = this.routeSocket(ws);
      if (routed === null) return;
      const { server, meta } = routed;
      const text =
        typeof message === 'string' ? message : utf8Decoder.decode(message);
      await observeRoomMessage(
        meta,
        utf8Encoder.encode(text).byteLength,
        async (span) => {
          const parsed = parseJsonOrNull(text);
          if (parsed === null) {
            span.setAttribute(ATTR.APP_ROOM_OUTCOME, 'invalid_frame');
            ws.close(WS_CLOSE.invalidFrame, 'invalid JSON frame');
            return;
          }
          await server.handleClientMessage(meta.id, meta.identity, parsed);
          span.setAttribute(ATTR.APP_ROOM_OUTCOME, 'accepted');
        }
      );
    } finally {
      this.flushTelemetry();
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    try {
      await this.ensureRestored();
      const routed = this.routeSocket(ws);
      if (routed === null) return;
      const { server, meta } = routed;
      await observeRoomError(meta, error, () => {
        server.unregisterConnection(meta.id);
      });
    } finally {
      this.flushTelemetry();
    }
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
    const storage = this.config.createStorage(this.ctx, this._env, moduleName);
    let server!: RoomServer<S, C, E, Identity>;
    const schedule = await openDoModuleSchedule({
      storage: this.ctx.storage,
      moduleName,
      clock: this.config.clock,
      createId: this.config.createId,
      hub: this.alarmHub,
      topic,
      injectCommand: (cmd) =>
        server.injectCommand({
          id: cmd.id,
          payload: cmd.payload as C,
          identity: cmd.identity as Identity,
        }),
    });
    server = new RoomServer({
      topic,
      module: moduleImpl,
      storage,
      clock: this.config.clock,
      effectHandlers: [schedule.handler, ...this.config.effectHandlers],
    });
    await server.hydrateFromStorage();
    await this.ctx.storage.put(roomDoKeyNs(moduleName).topic, topic);
    this.servers.set(moduleName, server);
    this.scheduleFire.set(moduleName, schedule.fireDue);
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
    const { server, identity, identityRaw, clientId, moduleName, topic } = args;
    this.supersedeActorSession(server, identityRaw, clientId);
    const [client, serverWs] = newWebSocketPair();
    const connId = this.config.createId();
    const traceparent = serializeTraceContext() ?? null;
    this.wsMeta.set(serverWs, {
      id: connId,
      identity,
      identityRaw,
      clientId,
      moduleName,
      topic,
      traceparent,
    });
    writeRoomSocketAttachment(serverWs, {
      connId,
      identityRaw,
      clientId,
      moduleName,
      topic,
      traceparent,
    });
    server.registerConnection(connId, (msg) => sendJson(serverWs, msg), {
      id: identityRaw,
      clientId,
    });
    this.ctx.acceptWebSocket(serverWs, [connId, moduleName]);
    return new Response(null, {
      status: 101,
      webSocket: client,
    } as WebSocketUpgradeResponseInit);
  }

  private flushTelemetry(): void {
    this.telemetry.flushWith(this.ctx.waitUntil.bind(this.ctx));
  }

  /**
   * Close and unregister any live socket for the same `(identity, clientId)`
   * so reconnects cannot stack duplicate roster rows.
   */
  private supersedeActorSession(
    server: RoomServer<S, C, E, Identity>,
    identityRaw: string,
    clientId: string
  ): void {
    const staleIds = server.connectionIdsForActor(identityRaw, clientId);
    for (const connId of staleIds) {
      for (const ws of this.ctx.getWebSockets(connId)) {
        const meta = this.wsMeta.get(ws);
        if (meta === undefined || meta.id !== connId) continue;
        try {
          ws.close(WS_CLOSE.sessionTakenOver, 'session taken over');
        } catch {
          // peer already closing
        }
      }
      server.unregisterConnection(connId);
    }
  }
}

const utf8Decoder = new TextDecoder();
const utf8Encoder = new TextEncoder();

function parseJsonOrNull(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * One serialization per broadcast: {@link RoomServer} fans out a single frame
 * object to every connection, so the JSON text is memoized per object and
 * N sockets cost one `JSON.stringify`.
 */
const frameJson = new WeakMap<object, string>();

function serializeFrame(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) {
    return JSON.stringify(payload);
  }
  const cached = frameJson.get(payload);
  if (cached !== undefined) return cached;
  const text = JSON.stringify(payload);
  frameJson.set(payload, text);
  return text;
}

/**
 * Best-effort JSON broadcast to a connected socket. A throw here means the
 * peer is mid-close; the matching `webSocketClose` will unregister cleanly.
 */
function sendJson(ws: WebSocket, payload: unknown): void {
  try {
    ws.send(serializeFrame(payload));
  } catch {
    // socket is closing
  }
}
