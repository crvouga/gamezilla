import type { Ports, Runtime } from '@pkgs/sim';

import type { BunWebviewRuntimeOptions } from './bun-webview';
import type { ProductExtra } from './ports';

/** The web bundle cannot host Bun.WebView or sidecar Postgres / S3rver / EMQX. */
export function bunWebviewRuntime(
  _opts: BunWebviewRuntimeOptions
): Runtime<Ports & ProductExtra> {
  throw new Error('bun-webview runtime is Node-only');
}
