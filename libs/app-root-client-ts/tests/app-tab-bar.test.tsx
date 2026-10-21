/** @jsxImportSource solid-js */
/** The tab bar as a listener hears it. */

import { describe, expect, test } from 'bun:test';
import { AppCompositionProvider } from '@libs/app-root-client-ts/app-subs-context';
import { AppTabBar } from '@libs/app-root-client-ts/app-tab-bar';
import type { ComposedSubClients } from '@libs/sub-client-ts/compose-client';
import {
  requiredContext,
  requiredOwned,
} from '@pkgs/a11y-shared-ts/aria-rules';
import { auditTree, formatFailure } from '@pkgs/a11y-shared-ts/audit';
import { SettingsIcon, UserIcon } from '@pkgs/ui-root-client-ts/icons';
import { screen } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';
import { renderChrome } from './render-chrome';

const TABS = [
  {
    name: 'spaces',
    href: '/',
    order: 0,
    label: () => 'Spaces',
    Icon: SettingsIcon,
    testID: 'tab-spaces',
  },
  {
    name: 'profile',
    href: '/profile',
    order: 1,
    label: () => 'Profile',
    Icon: UserIcon,
    testID: 'tab-profile',
  },
];

function Passthrough(props: { readonly children: JSX.Element }): JSX.Element {
  return <>{props.children}</>;
}

const CLIENTS = {
  subNames: [],
  routes: [],
  tabs: TABS,
  Chrome: Passthrough,
  Session: Passthrough,
  tabsDocks: [],
  settings: [],
} satisfies ComposedSubClients;

function renderTabBar(): void {
  renderChrome(() => (
    <AppCompositionProvider
      value={{
        clients: CLIENTS,
        loadApp: () => Promise.reject(new Error('not loaded')),
      }}
    >
      <AppTabBar pathname="/" onSelect={() => undefined} />
    </AppCompositionProvider>
  ));
}

describe('app tab bar', () => {
  // regression: a11y-tab-bar-empty-tablist
  test('is a navigation of buttons, never a tab list without tabs (ACT bc4a75)', () => {
    renderTabBar();
    const failures = auditTree(document.body, [requiredOwned, requiredContext]);
    expect(failures.map(formatFailure)).toEqual([]);
    expect(screen.getByRole('navigation')).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: 'Spaces' })
        .getAttribute('aria-current')
    ).toBe('page');
    // Journeys drive the tabs by test id, in the subs' declared order.
    const order = Array.from(
      screen.getByRole('navigation').querySelectorAll('[data-testid]')
    ).map((tab) => tab.getAttribute('data-testid'));
    expect(order).toEqual(['tab-spaces', 'tab-profile']);
    expect(screen.getByTestId('tab-profile').hasAttribute('aria-current')).toBe(
      false
    );
  });
});
