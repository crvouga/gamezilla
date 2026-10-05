/**
 * What a feature contributes to a client app: its screens, its tab (if it
 * owns one), and the providers its screens need.
 *
 * Kept in its own module because the data manifest is folded on the server
 * too, and nothing in a Worker should pull Solid or the design system.
 *
 */

import type { IconComponent } from '@pkgs/ui-root-client/create-icon';
import type { Component, JSX } from 'solid-js';

export type FeatureRoute = {
  /** `@solidjs/router` path pattern (`:param` segments). */
  readonly path: string;
  readonly component: Component;
  /** Renders inside the tabs layout (bottom tab bar on compact). */
  readonly tab?: true | undefined;
};

export type FeatureTab = {
  readonly name: string;
  readonly href: string;
  /** Position in the tab bar. Ties are a composition error. */
  readonly order: number;
  /** Read at render time so the label follows the active locale. */
  readonly label: () => string;
  readonly Icon: IconComponent;
  readonly testID: string;
};

export type FeatureProvider = Component<{ readonly children: JSX.Element }>;

/** A feature's screens and providers, imported before the app mounts. */
export type FeatureClient = {
  readonly name: string;
  readonly routes: readonly FeatureRoute[];
  readonly tabs?: readonly FeatureTab[];
  readonly chrome?: FeatureProvider;
  readonly session?: FeatureProvider;
  /**
   * Docked between the tab body and the tab bar — the place a feature keeps a
   * persistent control that outlives navigation (a now-playing bar, a call
   * strip). Rendered in feature order, above the tab bar.
   */
  readonly tabsDock?: Component;
  /** Environment-management rows rendered on the shell settings screen. */
  readonly settings?: Component;
};

export function defineFeatureClient(client: FeatureClient): FeatureClient {
  return client;
}
