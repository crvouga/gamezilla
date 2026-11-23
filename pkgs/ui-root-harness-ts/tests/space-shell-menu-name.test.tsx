/** @jsxImportSource solid-js */

import { expect, test } from 'bun:test';
import { SpaceShell } from '@pkgs/ui-root-client-ts/space-shell';
import type { SpaceRole } from '@pkgs/ui-root-client-ts/space-types';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { fireEvent, screen } from '@solidjs/testing-library';
import { renderUi } from './render';

/** A variable, not a literal: a literal `role` reads as an ARIA role to jsx-a11y. */
const GUEST: SpaceRole = 'guest';

function renderShell(spaceName: string): void {
  renderUi(() => (
    <SurfaceStackProvider>
      <SpaceShell
        spaceName={spaceName}
        title="Choose game"
        role={GUEST}
        onBack={() => {}}
        onLeave={() => {}}
        onEnd={() => {}}
        testIds={{ title: 'title', name: 'name' }}
      >
        <div />
      </SpaceShell>
    </SurfaceStackProvider>
  ));
}

// regression: space-name-not-shown-in-space
test('the top bar says what the screen is and the space menu which space it is', () => {
  renderShell('Friday puzzles');
  expect(screen.getByTestId('title').textContent).toBe('Choose game');
  expect(screen.queryByTestId('name')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Space menu' }));
  expect(screen.getByTestId('name').textContent).toBe('Friday puzzles');
  expect(screen.getByRole('menu').contains(screen.getByTestId('name'))).toBe(
    true
  );
});

test('a space whose name is not known yet heads its menu with nothing', () => {
  renderShell('');
  fireEvent.click(screen.getByRole('button', { name: 'Space menu' }));
  expect(screen.getByRole('menu')).toBeDefined();
  expect(screen.queryByTestId('name')).toBeNull();
});
