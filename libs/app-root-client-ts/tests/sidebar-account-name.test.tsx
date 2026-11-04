/** @jsxImportSource solid-js */
/** The account menu at the foot of the wide sidebar names who is signed in. */

import { afterEach, expect, test } from 'bun:test';
import { AppHeaderGlobalMenuView } from '@libs/app-root-client-ts/app-header-global-menu-view';
import { auditTree, formatFailure } from '@pkgs/a11y-shared-ts/audit';
import { labelInName } from '@pkgs/a11y-shared-ts/name-rules';
import { cleanup, screen } from '@solidjs/testing-library';
import { renderChrome } from './render-chrome';

afterEach(cleanup);

const AVERY = {
  usernameLabel: '@avery',
  email: 'avery@example.test',
  avatar: null,
};

function mountMenu(showName: boolean): void {
  renderChrome(() => (
    <AppHeaderGlobalMenuView
      identity={AVERY}
      connectivity="online"
      theme="system"
      muted={false}
      onNavigate={() => undefined}
      showName={showName}
    />
  ));
}

// regression: sidebar-account-face-anonymous
test('in the sidebar the trigger shows the name and is named by it', () => {
  mountMenu(true);
  expect(screen.getByText('@avery')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: '@avery, account menu' })
  ).toBeTruthy();
  expect(auditTree(document.body, [labelInName]).map(formatFailure)).toEqual(
    []
  );
});

test('in a top bar the trigger stays the face alone', () => {
  mountMenu(false);
  expect(screen.queryByText('@avery')).toBeNull();
  expect(screen.getByRole('button', { name: 'Account menu' })).toBeTruthy();
});
