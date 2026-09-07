import type { Ports, Runtime } from '@pkgs/sim';

import type { ProductExtra } from './ports';

/** The web bundle cannot host Bun.WebView or sidecar Postgres / MinIO / EMQX. */
export function bunWebviewRuntime(): Runtime<Ports & ProductExtra> {
  throw new Error('bun-webview runtime is Node-only');
}
