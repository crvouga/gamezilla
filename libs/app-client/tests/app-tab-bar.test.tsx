/** @jsxImportSource solid-js */
/** The tab bar as a listener hears it. */

import { describe, expect, test } from 'bun:test';
import { AppTabBar } from '@libs/app-client/app-tab-bar';
import { AppCompositionProvider } from '@libs/app-client/app-features-context';
import type { ComposedFeatureClients } from '@libs/feature-client/compose-client';
import { auditTree, formatFailure } from '@pkgs/a11y-shared/audit';
import { requiredContext, requiredOwned } from '@pkgs/a11y-shared/aria-rules';
import { SettingsIcon, UserIcon } from '@pkgs/ui-client/icons';
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
  featureNames: [],
  routes: [],
  tabs: TABS,
  Chrome: Passthrough,
  Session: Passthrough,
  tabsDocks: [],
} satisfies ComposedFeatureClients;

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
  });
});
