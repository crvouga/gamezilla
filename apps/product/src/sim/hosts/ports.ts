import type { LocalhostServerServices } from '@apps/product/sim/fabric/create-sim';
import type { SimSql } from '@apps/product/sim/fabric/sim-sql';
import type { MultiAppSolidDomSession } from '@pkgs/ui-testing-solid-dom';

export const SIM_START_MS = Date.parse('2024-06-01T00:00:00.000Z');

/**
 * UI adapter for a registered product host.
 * - `solid-dom` — in-process Solid App rendered into a DOM (happy-dom in
 *   bun:test via `MultiAppSolidDomSession`; the live browser document in the
 *   product-simulator, where the console mounts `live.App` itself)
 * - `bun-webview` — Bun.WebView per actor against localhost web + API
 */
export type ProductUi =
  | {
      readonly kind: 'solid-dom';
      /** Present in bun:test (happy-dom); omitted in the product-simulator. */
      readonly session?: MultiAppSolidDomSession;
      readonly runFor: (durationMs: number) => Promise<void>;
    }
  | {
      readonly kind: 'bun-webview';
      readonly webOrigin: string;
    };

export type ProductHttp =
  | { readonly kind: 'in-process' }
  | { readonly kind: 'localhost'; readonly origin: string };

export type ProductExtra = {
  readonly sql: SimSql;
  readonly serverServices?: LocalhostServerServices;
  readonly ui: ProductUi;
  readonly http: ProductHttp;
  /**
   * Mutable box set after `createSim`: drains in-process serialized server HTTP.
   * Held by reference so `Runtime.with` port spreads keep the same box.
   * In-process host awaits `current()` after each virtual-time `runFor`.
   */
  readonly drainServerHttp: { current: () => Promise<void> };
};

/** Registered host names on the product system. */
export type ProductHostName = 'in-process' | 'localhost:mocked' | 'localhost';
