/**
 * Minimal Cloudflare Workers type stubs for the turbo-cache Worker.
 *
 * We intentionally avoid pulling in @cloudflare/workers-types because
 * the full package conflicts with the DOM types required by the Expo
 * web build that shares the root tsconfig.
 */

declare interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer | ReadableStream | string | Blob | null,
    options?: R2PutOptions
  ): Promise<R2Object | null>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string | string[]): Promise<void>;
  head(key: string): Promise<R2Object | null>;
}

declare interface R2PutOptions {
  httpMetadata?: R2HttpMetadata;
  customMetadata?: Record<string, string>;
}

declare interface R2HttpMetadata {
  contentType?: string;
}

declare interface R2Object {
  key: string;
  size: number;
  httpMetadata?: R2HttpMetadata;
  customMetadata?: Record<string, string>;
}

declare interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}

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
