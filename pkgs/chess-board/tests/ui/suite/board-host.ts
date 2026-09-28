/**
 * A place the chess board harness runs (in-process Solid + happy-dom). The
 * suite only ever talks to a host through this port and the
 * `@pkgs/ui-testing` {@link Driver} it returns, so swapping the driver
 * implementation never touches a scenario.
 */

import type { Driver } from '@pkgs/ui-testing';

import type { HarnessConfig } from '../harness/config';

export type ChessBoardHost = {
  readonly name: string;
  /** Mount the harness for `config` and return a launched driver. */
  readonly open: (config: HarnessConfig) => Promise<Driver>;
  /** Let `ms` of host time pass on the host clock. */
  readonly settle: (ms: number) => Promise<void>;
  /** Tear down whatever `open` mounted. */
  readonly close: () => Promise<void>;
};
