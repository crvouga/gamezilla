/** @jsxImportSource solid-js */

import { expect, test } from 'bun:test';
import {
  AppFrameChromeProvider,
  GlobalTrailingInRail,
} from '@pkgs/ui-root-client-ts/app-frame-chrome';
import { SpaceShell } from '@pkgs/ui-root-client-ts/space-shell';
import type { SpaceRole } from '@pkgs/ui-root-client-ts/space-types';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { screen } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';
import { renderUi } from './render';

/** A variable, not a literal: a literal `role` reads as an ARIA role to jsx-a11y. */
const GUEST: SpaceRole = 'guest';

function shell(): JSX.Element {
  return (
    <SpaceShell
      spaceName="bob's space"
      role={GUEST}
      onBack={() => {}}
      onLeave={() => {}}
      onEnd={() => {}}
      people={<div />}
    >
      <div />
    </SpaceShell>
  );
}

function renderWithAccount(ui: () => JSX.Element) {
  return renderUi(() => (
    <SurfaceStackProvider>
      <AppFrameChromeProvider globalTrailing={<div data-testid="account" />}>
        {ui()}
      </AppFrameChromeProvider>
    </SurfaceStackProvider>
  ));
}

test('row 1 ends with the app’s own status and account menu', () => {
  renderWithAccount(shell);
  const row = document.querySelector('[data-space-row="actions"]');
  expect(row?.contains(screen.getByTestId('account'))).toBe(true);
});

test('beside a sidebar that already shows it, row 1 leaves it out', () => {
  renderWithAccount(() => (
    <GlobalTrailingInRail when>{shell()}</GlobalTrailingInRail>
  ));
  expect(screen.queryByTestId('account')).toBeNull();
});
