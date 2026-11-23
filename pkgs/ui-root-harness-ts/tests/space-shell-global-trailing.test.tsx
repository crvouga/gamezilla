/** @jsxImportSource solid-js */

import { expect, test } from 'bun:test';
import { AppFrameChromeProvider } from '@pkgs/ui-root-client-ts/app-frame-chrome';
import { SpaceShell } from '@pkgs/ui-root-client-ts/space-shell';
import type { SpaceRole } from '@pkgs/ui-root-client-ts/space-types';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { screen } from '@solidjs/testing-library';
import { renderUi } from './render';

/** A variable, not a literal: a literal `role` reads as an ARIA role to jsx-a11y. */
const GUEST: SpaceRole = 'guest';

test('the space\u2019s top bar is the space\u2019s alone: no app account menu in it', () => {
  renderUi(() => (
    <SurfaceStackProvider>
      <AppFrameChromeProvider globalTrailing={<div data-testid="account" />}>
        <SpaceShell
          spaceName="bob's space"
          role={GUEST}
          onBack={() => {}}
          onLeave={() => {}}
          onEnd={() => {}}
        >
          <div />
        </SpaceShell>
      </AppFrameChromeProvider>
    </SurfaceStackProvider>
  ));
  expect(document.querySelector('[data-space-row="actions"]')).not.toBeNull();
  expect(screen.queryByTestId('account')).toBeNull();
});
