/**
 * Minimal Cloudflare Workers type stubs for api.ts.
 *
 * We intentionally avoid pulling in @cloudflare/workers-types because
 * the full package conflicts with the DOM types required by the Expo
 * web build that shares this tsconfig.
 */

interface WebSocket {
  accept(): void;
}

interface ResponseInit {
  webSocket?: WebSocket;
}

declare class WebSocketPair {
  constructor();
  readonly 0: WebSocket;
  readonly 1: WebSocket;
  readonly length: 2;
  [index: number]: WebSocket;
}

type DurableObjectId = object;

declare interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

declare interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

type DurableObjectState = object;

declare interface DurableObject {
  fetch(request: Request): Promise<Response>;
}

// -- D1 (SQLite) database binding -------------------------------------------

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(
    statements: D1PreparedStatement[]
  ): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta: { changes?: number; last_row_id?: number; changed_db?: boolean };
}

interface D1ExecResult {
  count: number;
  duration: number;
}

// ---------------------------------------------------------------------------

declare interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

declare interface ExportedHandler<Env = unknown> {
  fetch?(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Response | Promise<Response>;
}
