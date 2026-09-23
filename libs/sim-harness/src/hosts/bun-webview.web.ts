import type { Ports, Runtime } from '@pkgs/sim';

import type { BunWebviewRuntimeOptions } from './bun-webview';
import type { ProductExtra } from './ports';

<<<<<<<< HEAD:libs/sim-harness/src/hosts/localhost.web.ts
/** The web bundle cannot host Bun.WebView or sidecar Postgres / MinIO / EMQX. */
export function localhostRuntime(
  _profile: 'localhost:mocked' | 'localhost'
========
/** The web bundle cannot host Bun.WebView or sidecar Postgres / S3rver / EMQX. */
export function bunWebviewRuntime(
  _opts: BunWebviewRuntimeOptions
>>>>>>>> main:libs/sim-harness/src/hosts/bun-webview.web.ts
): Runtime<Ports & ProductExtra> {
  throw new Error('bun-webview runtime is Node-only');
}
