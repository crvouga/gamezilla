import type { ReactElement } from 'react';

/**
 * Application-supplied bootstrap. The framework never imports an app —
 * consumers implement this port and pass it to the in-process driver.
 *
 * `TContext` lets harnesses share setup state (fakes, DB handles, …) with
 * `createRoot` and `teardown` without the framework knowing about it.
 */
export interface AppHarness<TContext = void> {
  /** Optional one-time setup before the root mounts. */
  setup?(): Promise<TContext>;

  /**
   * Return the application root element (providers and all).
   * Called once per `launch()`.
   */
  createRoot(ctx: TContext): ReactElement;

  /** Optional teardown after `close()`. */
  teardown?(ctx: TContext): Promise<void>;
}
