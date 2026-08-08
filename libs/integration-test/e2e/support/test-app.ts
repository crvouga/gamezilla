import type { Driver } from '@pkgs/ui-testing';

import type { AuthPort } from './auth-port';

/**
 * Per-target handle for driver-agnostic scenarios.
 * The web binding wires PlaywrightDriver + Better Auth; future in-process /
 * native bindings construct the same shape.
 */
export type TestApp = {
  readonly driver: Driver;
  readonly auth: AuthPort;
  /**
   * Navigate to an application path (`/` , `/?reset-db=1`, …).
   * Web: browser history. Other targets supply deep-link / harness equivalents.
   */
  open(path: string): Promise<void>;
};
