import type { MultiAppRntlSession } from '@pkgs/ui-testing';
import type { SimSql } from '@sim/console/sim/sim-sql';

export const SIM_START_MS = Date.parse('2024-06-01T00:00:00.000Z');

export type ProductUi =
  | {
      readonly kind: 'rntl';
      readonly rntl: MultiAppRntlSession;
      readonly runFor: (durationMs: number) => Promise<void>;
    }
  | {
      readonly kind: 'playwright';
    };

export type ProductHttp = {
  readonly kind: 'in-process' | 'loopback';
};

export type ProductExtra = {
  readonly sql: SimSql;
  readonly ui: ProductUi;
  readonly http: ProductHttp;
  /**
   * Mutable box set after `createSim`: drains in-process serialized server HTTP.
   * Held by reference so `Runtime.with` port spreads keep the same box.
   * `simRuntime` awaits `current()` after each virtual-time `runFor`.
   */
  readonly drainServerHttp: { current: () => Promise<void> };
};
