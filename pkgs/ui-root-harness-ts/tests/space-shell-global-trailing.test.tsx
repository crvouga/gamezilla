/** @jsxImportSource @solidjs/web */

import { expect, test } from 'bun:test';
import {
  AppFrameChromeProvider,
  GlobalTrailingInRail,
} from '@pkgs/ui-root-client-ts/app-frame-chrome';
import { SpaceShell } from '@pkgs/ui-root-client-ts/space-shell';
import type { SpaceRole } from '@pkgs/ui-root-client-ts/space-types';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { screen } from '@solidjs/testing-library';
import type { JSX } from '@solidjs/web';
import { renderUi } from './render';

/** A variable, not a literal: a literal `role` reads as an ARIA role to jsx-a11y. */
const GUEST: SpaceRole = 'guest';

function shell(): JSX.Element {
  return (
    <SpaceShell
      spaceName="bob's space"
      role={GUEST}
      onBack={() => {}}
      onMembers={() => {}}
      onMinimize={() => {}}
    >
      <div />
    </SpaceShell>
  );
}

function renderInApp(ui: () => JSX.Element) {
  return renderUi(() => (
    <SurfaceStackProvider>
      <AppFrameChromeProvider
        globalStatus={<div data-testid="status" />}
        globalTrailing={<div data-testid="account" />}
      >
        {ui()}
      </AppFrameChromeProvider>
    </SurfaceStackProvider>
  ));
}

test('the space’s top bar leaves the app’s account menu out', () => {
  renderInApp(shell);
  expect(document.querySelector('[data-space-row="actions"]')).not.toBeNull();
  expect(screen.queryByTestId('account')).toBeNull();
});

// regression: space-bar-hides-connection-status
test('the space’s top bar still shows the app’s status', () => {
  renderInApp(shell);
  const row = document.querySelector('[data-space-row="actions"]');
  expect(row?.contains(screen.getByTestId('status'))).toBe(true);
});

test('beside a sidebar that already shows it, the top bar leaves the status out', () => {
  renderInApp(() => (
    <GlobalTrailingInRail when>{shell()}</GlobalTrailingInRail>
  ));
  expect(screen.queryByTestId('status')).toBeNull();
});
