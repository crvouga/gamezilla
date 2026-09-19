/**
 * A place the chess board harness runs: in-process Solid + happy-dom, or a
 * real browser engine through `Bun.WebView`. The suite only ever talks to a
 * host through this port and the `@pkgs/ui-testing` {@link Driver} it returns.
 */

import type { Driver } from '@pkgs/ui-testing';

import type { HarnessConfig } from '../harness/harness-config';

export type ChessBoardHost = {
  readonly name: string;
  /**
   * The host runs a real layout engine, so element boxes (e.g. a square's
   * painted cell) are measured, not synthesized. happy-dom cannot.
   */
  readonly measuresLayout: boolean;
  /** Mount the harness for `config` and return a launched driver. */
  readonly open: (config: HarnessConfig) => Promise<Driver>;
  /** Let `ms` of host time pass (virtual clock in-process, wall in a browser). */
  readonly settle: (ms: number) => Promise<void>;
  /** Tear down whatever `open` mounted. */
  readonly close: () => Promise<void>;
};
