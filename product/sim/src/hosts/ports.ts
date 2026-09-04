import type { MultiAppRntlSession } from '@pkgs/ui-testing-rntl';
import type { SimSql } from '@product/sim/fabric/sim-sql';

export const SIM_START_MS = Date.parse('2024-06-01T00:00:00.000Z');

/**
 * UI adapter for a registered product host.
 * - `react-tree` — in-process React App (RNTL in tests; embedded App in playground)
 * - `bun-webview` — Bun.WebView per actor against localhost web + API
 */
export type ProductUi =
  | {
      readonly kind: 'react-tree';
      /** Present in bun:test / RNTL tests; omitted in playground / Expo. */
      readonly rntl?: MultiAppRntlSession;
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
export type ProductHostName = 'in-process' | 'bun-webview';
