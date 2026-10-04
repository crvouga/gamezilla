import type { Harness } from './create-harness';

export type HarnessHttpListener = {
  readonly apiUrl: string;
  stop(): Promise<void>;
};

export const ACTOR_HEADER = 'x-harness-actor';

/** The web bundle cannot bind Bun.serve — use Node host / bun-webview sidecar. */
export function listenHarnessHttpServer(
  _harness: Harness
): Promise<HarnessHttpListener> {
  return Promise.reject(new Error('listenHarnessHttpServer is Node-only'));
}
