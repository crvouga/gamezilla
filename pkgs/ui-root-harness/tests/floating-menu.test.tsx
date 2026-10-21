/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { auditTree, formatFailure } from '@pkgs/a11y-shared/audit';
import { labelInName } from '@pkgs/a11y-shared/name-rules';
import { ActionBar } from '@pkgs/ui-root-client/action-bar';
import {
  FLOATING_MENU_DEFAULT_WIDTH,
  FloatingMenu,
} from '@pkgs/ui-root-client/floating-menu';
import type { FloatingMenuContent } from '@pkgs/ui-root-client/floating-menu-content';
import {
  LogOutIcon,
  SettingsIcon,
  ShareIcon,
} from '@pkgs/ui-root-client/icons';
import { OverflowMenuButton } from '@pkgs/ui-root-client/overflow-menu-button';
import { SurfaceStackProvider } from '@pkgs/ui-root-client/surface-stack';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal, type JSX } from 'solid-js';
import { cssOf, mustQuery, renderUi } from './render';

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
      <button
        class="clickable clickableTint"
        data-testid="trigger"
        type="button"
        onClick={() => setOpen(true)}
      >
        <p class="text">{'Open'}</p>
      </button>
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
      // `min-h-11`: a 44px pointer target.
      expect(item.className).toMatch(/\bmin-h-11\b/);
    }
    expect(
      screen.getByRole('menuitem', { name: 'Disabled' }).className
    ).toMatch(/\bopacity-disabled\b/);
    // Floats above the content: hairline, card radius, the float shadow.
    expect(menu.className).toMatch(/\bshadow-float\b/);
    expect(menu.className).toMatch(/\brounded-card\b/);
    expect(menu.className).toMatch(/\bborder-border\b/);
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

  test('empty label falls back to aria-label / id; subtitle stays on one line', () => {
    renderUi(() => (
      <SurfaceStackProvider>
        <FloatingMenu
          open
          onClose={() => undefined}
          anchor={ANCHOR}
          label="Fallback"
          content={{
            rows: [
              {
                type: 'item',
                id: 'blank',
                label: '   ',
                'aria-label': 'Online',
                icon: SettingsIcon,
              },
              {
                type: 'item',
                id: 'theme',
                label: 'Theme',
                subtitle: 'Dark',
                icon: SettingsIcon,
              },
            ],
          }}
        />
      </SurfaceStackProvider>
    ));
    expect(screen.getByRole('menuitem', { name: 'Online' }).textContent).toBe(
      'Online'
    );
    const theme = screen.getByRole('menuitem', { name: 'Theme Dark' });
    expect(theme.textContent).toContain('Theme');
    expect(theme.textContent).toContain('Dark');
    expect(theme.querySelectorAll('p')).toHaveLength(2);
  });

  // regression: a11y-menu-label-not-in-name
  test('a row is named by what it shows, so a listener hears its visible label', () => {
    renderUi(() => (
      <SurfaceStackProvider>
        <FloatingMenu
          open
          onClose={() => undefined}
          anchor={ANCHOR}
          label="Account"
          content={{
            rows: [
              {
                type: 'item',
                id: 'theme',
                label: 'Theme',
                subtitle: 'System',
                icon: SettingsIcon,
              },
            ],
          }}
        />
      </SurfaceStackProvider>
    ));
    const panel = mustQuery('[data-component="FloatingMenuPanel"]');
    expect(auditTree(panel, [labelInName]).map(formatFailure)).toEqual([]);
    expect(screen.getByRole('menuitem', { name: 'Theme System' })).toBeTruthy();
  });

  test('focuses the first item, arrows skip disabled rows, select closes', async () => {
    const user = userEvent.setup();
    const onSettings = mock();
    const onSignOut = mock();
    const onClose = mock();
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
    const onClose = mock();
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
    const onAction = mock();
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
    const onBeta = mock();
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

describe('FloatingMenu header badge', () => {
  function renderHeader(badge: JSX.Element | undefined): void {
    renderUi(() => (
      <SurfaceStackProvider>
        <FloatingMenu
          open
          onClose={() => {}}
          anchor={ANCHOR}
          content={{ header: { title: 'Ada', badge }, rows: [] }}
          label="Account"
        />
      </SurfaceStackProvider>
    ));
  }

  test('renders the badge on its own row under the header title', () => {
    renderHeader(<span data-testid="tier-chip">{'Plus'}</span>);
    const header = mustQuery('[data-component="FloatingMenuHeader"]');
    const chip = screen.getByTestId('tier-chip');
    expect(header.contains(chip)).toBe(true);
    expect(chip.textContent).toBe('Plus');
    // Its own row: a direct child of the header, apart from the title's row.
    expect(chip.parentElement?.parentElement === header).toBe(true);
    expect(chip.parentElement?.textContent).toBe('Plus');
  });

  test('renders no badge slot without one', () => {
    renderHeader(undefined);
    expect(screen.queryByTestId('tier-chip')).toBeNull();
    expect(screen.getByText('Ada')).toBeInTheDocument();
  });
});
