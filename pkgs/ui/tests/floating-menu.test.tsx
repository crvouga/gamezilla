/** @jsxImportSource solid-js */
import { Clickable, SurfaceStackProvider, Text } from '@pkgs/ui';
import { ActionBar } from '@pkgs/ui/components/action-bar';
import {
  FLOATING_MENU_DEFAULT_WIDTH,
  FLOATING_MENU_ITEM_MIN_HEIGHT,
  FloatingMenu,
  type FloatingMenuContent,
} from '@pkgs/ui/components/floating-menu';
import { LogOutIcon, SettingsIcon, ShareIcon } from '@pkgs/ui/components/icons';
import { OverflowMenuButton } from '@pkgs/ui/components/overflow-menu-button';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal, type JSX } from 'solid-js';
import { describe, expect, test, vi } from 'vitest';
import { cssOf, mustQuery, renderUi } from './support/render';

const ANCHOR = { x: 500, y: 20, width: 40, height: 40 };

function Harness(props: {
  onSettings: () => void;
  onSignOut: () => void;
  onClose?: () => void;
  initialOpen?: boolean;
}): JSX.Element {
  const [open, setOpen] = createSignal(props.initialOpen ?? false);
  const content: FloatingMenuContent = {
    header: { title: 'Ada', subtitle: 'ada@example.com' },
    rows: [
      {
        type: 'item',
        id: 'settings',
        label: 'Settings',
        icon: SettingsIcon,
        onClick: () => props.onSettings(),
      },
      {
        type: 'item',
        id: 'off',
        label: 'Disabled',
        icon: SettingsIcon,
        disabled: true,
      },
      { type: 'divider', id: 'd' },
      {
        type: 'item',
        id: 'signout',
        label: 'Sign out',
        icon: LogOutIcon,
        onClick: () => props.onSignOut(),
      },
    ],
  };
  return (
    <SurfaceStackProvider>
      <Clickable dataSet={{ testid: 'trigger' }} onClick={() => setOpen(true)}>
        <Text label="Open" />
      </Clickable>
      <FloatingMenu
        open={open()}
        onClose={() => {
          setOpen(false);
          props.onClose?.();
        }}
        anchor={ANCHOR}
        content={content}
        label="Account"
      />
    </SurfaceStackProvider>
  );
}

describe('FloatingMenu', () => {
  test('renders a positioned role=menu with ≥44px items and header', () => {
    renderUi(() => (
      <Harness onSettings={() => {}} onSignOut={() => {}} initialOpen />
    ));
    const menu = screen.getByRole('menu', { name: 'Account' });
    expect(menu.closest('[data-component="SurfaceStackHost"]')).not.toBeNull();
    const items = screen.getAllByRole('menuitem');
    expect(items.map((el) => el.textContent)).toEqual([
      'Settings',
      'Disabled',
      'Sign out',
    ]);
    for (const item of items) {
      expect(item.tagName).toBe('BUTTON');
      expect(cssOf(item)).toContain(
        `min-height:${FLOATING_MENU_ITEM_MIN_HEIGHT}px`
      );
    }
    expect(screen.getByRole('menuitem', { name: 'Disabled' })).toBeDisabled();
    expect(screen.getByRole('separator')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    const panel = mustQuery('[data-component="FloatingMenuPanel"]');
    const css = cssOf(panel);
    // Below the anchor (20 + 40 + 6 gap), right-aligned (540 - 260).
    expect(css).toContain('top:66px');
    expect(css).toContain(`left:${540 - FLOATING_MENU_DEFAULT_WIDTH}px`);
    expect(css).toContain(`width:${FLOATING_MENU_DEFAULT_WIDTH}px`);
  });

  test('focuses the first item, arrows skip disabled rows, select closes', async () => {
    const user = userEvent.setup();
    const onSettings = vi.fn();
    const onSignOut = vi.fn();
    const onClose = vi.fn();
    renderUi(() => (
      <Harness
        onSettings={onSettings}
        onSignOut={onSignOut}
        onClose={onClose}
      />
    ));
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    fireEvent.click(trigger);
    const settings = screen.getByRole('menuitem', { name: 'Settings' });
    const signOut = screen.getByRole('menuitem', { name: 'Sign out' });
    expect(settings).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(signOut).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(settings).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(signOut).toHaveFocus();
    await user.keyboard('{Home}');
    expect(settings).toHaveFocus();
    await user.keyboard('{End}');
    expect(signOut).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(onSettings).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  test('Escape and outside click close the menu', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderUi(() => (
      <Harness onSettings={() => {}} onSignOut={() => {}} onClose={onClose} />
    ));
    fireEvent.click(screen.getByTestId('trigger'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByTestId('trigger'));
    fireEvent.click(mustQuery('[data-component="FloatingMenuBackdrop"]'));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('default overflow menus', () => {
  test('OverflowMenuButton renders a FloatingMenu anchored to its trigger', () => {
    const onAction = vi.fn();
    renderUi(() => (
      <SurfaceStackProvider>
        <OverflowMenuButton
          aria-label="More"
          header={{ title: 'More' }}
          actions={[
            {
              id: 'a',
              label: 'Alpha',
              icon: ShareIcon,
              onClick: onAction,
              endsGroup: true,
            },
            { id: 'b', label: 'Beta', onClick: () => {} },
          ]}
        />
      </SurfaceStackProvider>
    ));
    const trigger = screen.getByRole('button', { name: 'More' });
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    expect(screen.getByRole('separator')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Alpha' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('ActionBar More trigger opens a FloatingMenu with the overflow rows', () => {
    const onBeta = vi.fn();
    renderUi(() => (
      <SurfaceStackProvider>
        <ActionBar
          items={[
            { id: 'a', label: 'Alpha', icon: ShareIcon, onClick: () => {} },
            {
              id: 'b',
              label: 'Beta',
              icon: SettingsIcon,
              onClick: onBeta,
              overflow: 'always',
            },
            {
              id: 'c',
              label: 'Gamma',
              icon: SettingsIcon,
              onClick: () => {},
              overflow: 'always',
            },
          ]}
        />
      </SurfaceStackProvider>
    ));
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    const item = screen.getByRole('menuitem', { name: 'Beta' });
    fireEvent.click(item);
    expect(onBeta).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
