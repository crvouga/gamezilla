/**
 * Clear DI surface for mounting {@link ClientRootLayout} (sims + tests).
 *
 * Does not own Expo Router / `require.context` — callers still compose
 * `ExpoRoot` with a filesystem context and swap only the root layout.
 */

import type { Io } from '@pkgs/io';
import { createElement, type ReactElement } from 'react';

import type { AppOverrides } from './app-overrides';
import { ClientRootLayout } from './client-root-layout';

export type CreateClientAppArgs = {
  readonly io?: Io;
  readonly overrides?: AppOverrides;
};

export type ClientApp = {
  readonly io: Io | undefined;
  readonly overrides: AppOverrides | undefined;
  /** Component that renders {@link ClientRootLayout} with this app's seams. */
  readonly RootLayout: () => ReactElement;
};

/**
 * Returns Io / AppOverrides plus a RootLayout element factory for mounting.
 */
export function createClientApp(args: CreateClientAppArgs = {}): ClientApp {
  return {
    io: args.io,
    overrides: args.overrides,
    RootLayout: () =>
      createElement(ClientRootLayout, {
        ...(args.io !== undefined ? { io: args.io } : {}),
        ...(args.overrides !== undefined ? { overrides: args.overrides } : {}),
      }),
  };
}
