import type { MultiAppSolidDomSession } from '@pkgs/ui-testing-solid-dom';
import type { SimSql } from '../fabric/sim-sql';

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
  /** The sim balancer, bound to a loopback port by this process. */
  | { readonly kind: 'localhost'; readonly origin: string }
  /** A separately booted localhost stack; this process owns no servers. */
  | {
      readonly kind: 'stack';
      readonly origin: string;
      /** The stack's simulated Google and Apple, each on its own origin. */
      readonly idpOrigins: { readonly google: string; readonly apple: string };
      /**
       * A stack outlives one run, so each run brings its own people: actor
       * `alice` signs in as `alice.<tag>@gmail.com`, never as an earlier
       * run's alice.
       */
      readonly accountTag: string;
    };

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
