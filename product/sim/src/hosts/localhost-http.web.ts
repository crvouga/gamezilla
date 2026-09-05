import type { Sim } from '@product/sim/fabric/create-sim';

export type SimHttpListener = {
  readonly apiUrl: string;
  stop(): Promise<void>;
};

export const ACTOR_HEADER = 'x-sim-actor';

/** Expo web cannot bind Bun.serve — use Node host / bun-webview sidecar. */
export async function listenSimHttpServer(_sim: Sim): Promise<SimHttpListener> {
  throw new Error('listenSimHttpServer is Node-only');
}
