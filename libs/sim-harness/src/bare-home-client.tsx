/** @jsxImportSource solid-js */
/**
 * The screen a composition lands on when none of its features owns `/`.
 *
 * Production's `/` belongs to spaces. A feature below spaces in the package
 * graph (profile, search, billing) cannot compose it, and without a tab at `/`
 * the shell boots onto an empty tabs layout (no tabs at all) or the not-found
 * screen (no tab bar) — either way the actor cannot reach the feature. This
 * fills the gap with a bare screen: the shell header (global menu) and the
 * tab bar, nothing of any feature.
 */

import type { FeatureClient } from '@libs/feature/public/client';
import { defineFeatureClient } from '@libs/feature/public/client';
import { Handles } from '@libs/test-ids';
import { HouseIcon, ScreenBase } from '@pkgs/ui';
import type { JSX } from 'solid-js';

function BareHomeScreen(): JSX.Element {
  return (
    <ScreenBase
      screenId="sim-home"
      breadcrumbs={[{ name: 'Home' }]}
      content={() => <div class="box" />}
    />
  );
}

export const BARE_HOME_CLIENT = defineFeatureClient({
  name: 'sim-home',
  routes: [
    {
      path: '/',
      tab: true,
      load: () => Promise.resolve({ default: BareHomeScreen }),
    },
  ],
  tabs: [
    {
      name: 'SimHomeTab',
      href: '/',
      order: 0,
      label: () => 'Home',
      Icon: HouseIcon,
      testID: Handles.tabSimHome,
    },
  ],
});

/** `clients`, plus {@link BARE_HOME_CLIENT} when none of them owns `/`. */
export function withHome(
  clients: readonly FeatureClient[]
): readonly FeatureClient[] {
  const ownsRoot = clients.some((client) =>
    client.routes.some((route) => route.path === '/')
  );
  return ownsRoot ? clients : [BARE_HOME_CLIENT, ...clients];
}
