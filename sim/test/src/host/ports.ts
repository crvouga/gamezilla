import type { MultiAppRntlSession } from '@pkgs/ui-testing';
import type { SimSqlHandle } from '@sim/console/sim/sim-sql';

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
  readonly sql: SimSqlHandle;
  readonly ui: ProductUi;
  readonly http: ProductHttp;
};
