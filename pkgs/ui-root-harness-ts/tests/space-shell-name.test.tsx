/** @jsxImportSource @solidjs/web */

import { expect, test } from 'bun:test';
import { SpaceShell } from '@pkgs/ui-root-client-ts/space-shell';
import type { SpaceRole } from '@pkgs/ui-root-client-ts/space-types';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { screen } from '@solidjs/testing-library';
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
        onMembers={() => {}}
        onMinimize={() => {}}
        testIds={{ title: 'title', name: 'name' }}
      >
        <div />
      </SpaceShell>
    </SurfaceStackProvider>
  ));
}

// regression: space-name-not-shown-in-space
test('the top bar names the screen and its space', () => {
  renderShell('Friday puzzles');
  expect(screen.getByTestId('title').textContent).toBe('Choose game');
  expect(screen.getByTestId('name').textContent).toBe('Friday puzzles');
});

test('a space whose name is still unknown shows only the screen title', () => {
  renderShell('');
  expect(screen.queryByTestId('name')).toBeNull();
});
