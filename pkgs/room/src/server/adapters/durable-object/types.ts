/**
 * Minimal structural types for the Cloudflare Workers Durable Object APIs
 * the adapter depends on. Defined locally as named exports rather than
 * pulling `@cloudflare/workers-types`, which conflicts with the DOM types
 * required by the Expo web build that shares this workspace's tsconfig.
 *
 * Keep these in sync with the equivalent ambient declarations in
 * `packages/api/src/app/cloudflare.d.ts`.
 */

/** KV-style persistence available on every Durable Object instance. */
export interface DurableObjectKvStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

/**
 * Per-instance runtime context handed to a DO constructor. We only model
 * the surface the room adapter actually uses (storage + WebSocket
 * hibernation + concurrency latch).
 */
export interface DurableObjectInstanceState {
  acceptWebSocket(ws: WebSocket, tags?: string[]): void;
  readonly storage: DurableObjectKvStorage;
  blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>;
}

/** Shape every Durable Object class instance must satisfy. */
export interface DurableObjectInstance {
  fetch(request: Request): Promise<Response>;
  webSocketMessage?(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): void | Promise<void>;
  webSocketClose?(
    ws: WebSocket,
    code: number,
    reason: string
  ): void | Promise<void>;
}

/**
 * Constructor signature for a Durable Object class as referenced by
 * `class_name` in `wrangler.toml`. The `env` argument is opaque to the
 * adapter — concrete adapters can narrow it via the type parameter.
 */
export type DurableObjectClass<Env = unknown> = new (
  ctx: DurableObjectInstanceState,
  env: Env
) => DurableObjectInstance;

/**
 * Runtime accessor for the Workers `WebSocketPair` global. Lookup is
 * indirect so unit tests in non-Worker environments can stub it without
 * polluting the global type namespace.
 */
export function newWebSocketPair(): readonly [WebSocket, WebSocket] {
  const Ctor = (
    globalThis as unknown as {
      WebSocketPair?: new () => readonly [WebSocket, WebSocket];
    }
  ).WebSocketPair;
  if (Ctor === undefined) {
    throw new Error(
      'WebSocketPair is not available; createDurableObjectAdapter must run inside a Cloudflare Worker'
    );
  }
  return new Ctor();
}

/**
 * `ResponseInit` augmented with the Workers-only `webSocket` field used to
 * complete a WebSocket upgrade handshake.
 */
export type WebSocketUpgradeResponseInit = ResponseInit & {
  webSocket?: WebSocket;
};
