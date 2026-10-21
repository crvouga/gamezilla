/** @jsxImportSource solid-js */
/**
 * The screen a composition lands on when none of its subs owns `/`.
 *
 * Production's `/` belongs to spaces. A sub below spaces in the package
 * graph (profile, search, billing) cannot compose it, and without a tab at `/`
 * the shell boots onto an empty tabs layout (no tabs at all) or the not-found
 * screen (no tab bar) — either way the actor cannot reach the sub. This
 * fills the gap with a bare screen: the shell header (global menu) and the
 * tab bar, nothing of any sub.
 */

import type { SubClient } from '@libs/sub-client-ts/client';
import { defineSubClient } from '@libs/sub-client-ts/client';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { HouseIcon } from '@pkgs/ui-root-client-ts/icons';
import { ScreenBase } from '@pkgs/ui-root-client-ts/screen-base';
import type { JSX } from 'solid-js';

function BareHomeScreen(): JSX.Element {
  return (
    <ScreenBase
      screenId="harness-home"
      breadcrumbs={[{ name: 'Home' }]}
      content={() => <div class="box" />}
    />
  );
}

export const BARE_HOME_CLIENT = defineSubClient({
  name: 'harness-home',
  routes: [
    {
      path: '/',
      tab: true,
      component: BareHomeScreen,
    },
  ],
  tabs: [
    {
      name: 'HarnessHomeTab',
      href: '/',
      order: 0,
      label: () => 'Home',
      Icon: HouseIcon,
      testID: Handles.tabHarnessHome,
    },
  ],
});

/** `clients`, plus {@link BARE_HOME_CLIENT} when none of them owns `/`. */
export function withHome(clients: readonly SubClient[]): readonly SubClient[] {
  const ownsRoot = clients.some((client) =>
    client.routes.some((route) => route.path === '/')
  );
  return ownsRoot ? clients : [BARE_HOME_CLIENT, ...clients];
}
