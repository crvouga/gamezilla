/** @jsxImportSource solid-js */
import { expect, mock, test } from 'bun:test';
import { FloatingMenu } from '@pkgs/ui-root-client/floating-menu';
import type { FloatingMenuContent } from '@pkgs/ui-root-client/floating-menu-content';
import { UserIcon } from '@pkgs/ui-root-client/icons';
import { SurfaceStackProvider } from '@pkgs/ui-root-client/surface-stack';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { renderUi } from './render';

test('an account menu keeps its pressed item while the displayed identity changes', () => {
  // regression: floating-menu-replaces-pressed-item
  const first = mock();
  const latest = mock();
  const content = (
    title: string,
    onClick: () => void
  ): FloatingMenuContent => ({
    header: { title },
    rows: [
      {
        type: 'item',
        id: 'account',
        label: 'Account',
        icon: UserIcon,
        onClick,
      },
    ],
  });
  const [value, update] = createSignal(content('Guest', first));
  renderUi(() => (
    <SurfaceStackProvider>
      <FloatingMenu
        open
        anchor={{ x: 20, y: 20, width: 40, height: 40 }}
        onClose={() => undefined}
        content={value()}
      />
    </SurfaceStackProvider>
  ));
  const pressed = screen.getByRole('menuitem', { name: 'Account' });
  pressed.focus();
  fireEvent.pointerDown(pressed);
  update(content('Cedar', latest));
  expect(pressed.isConnected).toBe(true);
  expect(screen.getByRole('menuitem', { name: 'Account' })).toBe(pressed);
  expect(pressed).toHaveFocus();
  fireEvent.pointerUp(pressed);
  fireEvent.click(pressed);
  expect(first).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledTimes(1);
});
