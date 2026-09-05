import type { Ports, Runtime } from '@pkgs/sim';

import type { ProductExtra } from './ports';

/** Expo web cannot host Bun.WebView or sidecar Postgres / MinIO / EMQX. */
export function bunWebviewRuntime(): Runtime<Ports & ProductExtra> {
  throw new Error('bun-webview runtime is Node-only');
}
