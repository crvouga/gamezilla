/**
 * What a sub contributes to a client app: its screens, its tab (if it
 * owns one), and the providers its screens need.
 *
 * Kept in its own module because the data manifest is folded on the server
 * too, and nothing in a Worker should pull Solid or the design system.
 *
 */

import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import type { Component, JSX } from 'solid-js';

export type SubRoute = {
  /** `@solidjs/router` path pattern (`:param` segments). */
  readonly path: string;
  readonly component: Component;
  /** Renders inside the tabs layout (bottom tab bar on compact). */
  readonly tab?: true | undefined;
};

export type SubTab = {
  readonly name: string;
  readonly href: string;
  /** Position in the tab bar. Ties are a composition error. */
  readonly order: number;
  /** Read at render time so the label follows the active locale. */
  readonly label: () => string;
  readonly Icon: IconComponent;
  readonly testID: string;
};

export type SubProvider = Component<{ readonly children: JSX.Element }>;

/** A sub's screens and providers, imported before the app mounts. */
export type SubClient = {
  readonly name: string;
  /** Nested subs of the same kind, folded after this node in listed order. */
  readonly subs?: readonly SubClient[];
  readonly routes: readonly SubRoute[];
  readonly tabs?: readonly SubTab[];
  readonly chrome?: SubProvider;
  readonly session?: SubProvider;
  /**
   * Docked between the tab body and the tab bar — the place a sub keeps a
   * persistent control that outlives navigation (a now-playing bar, a call
   * strip). Rendered in walk order, above the tab bar.
   */
  readonly tabsDock?: Component;
  /** Environment-management rows rendered on the shell settings screen. */
  readonly settings?: Component;
};

export function defineSubClient(client: SubClient): SubClient {
  return client;
}
