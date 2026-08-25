import type { ReactElement } from 'react';

import type { RenderedApp } from './render-adapter';

/**
 * Application-supplied bootstrap. The framework never imports an app —
 * consumers implement this port and pass it to the rntl driver.
 *
 * `TContext` lets harnesses share setup state (fakes, DB handles, …) with
 * `createRoot` / `mount` and `teardown` without the framework knowing about it.
 *
 * Provide either {@link createRoot} (mounted via the driver's {@link RenderAdapter})
 * or {@link mount} (harness owns the renderer, e.g. expo-router `renderRouter`).
 */
export interface AppHarness<TContext = void> {
  /** Optional one-time setup before the root mounts. */
  setup?(): Promise<TContext>;

  /**
   * Return the application root element (providers and all).
   * Called once per `launch()` when {@link mount} is omitted.
   */
  createRoot?(ctx: TContext): ReactElement;

  /**
   * Own the mount (e.g. `expo-router/testing-library` `renderRouter`).
   * When set, takes precedence over {@link createRoot} + RenderAdapter.
   */
  mount?(ctx: TContext): Promise<RenderedApp>;

  /** Optional teardown after `close()`. */
  teardown?(ctx: TContext): Promise<void>;
}
