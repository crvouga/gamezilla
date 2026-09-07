import type { Sim } from '@product/sim/fabric/create-sim';

export type SimHttpListener = {
  readonly apiUrl: string;
  stop(): Promise<void>;
};

export const ACTOR_HEADER = 'x-sim-actor';

/** The web bundle cannot bind Bun.serve — use Node host / bun-webview sidecar. */
export function listenSimHttpServer(_sim: Sim): Promise<SimHttpListener> {
  return Promise.reject(new Error('listenSimHttpServer is Node-only'));
}
