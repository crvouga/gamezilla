/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { AppFrame } from '@pkgs/ui-root-client/app-frame';
import { AppFrameChromeProvider } from '@pkgs/ui-root-client/app-frame-chrome';
import { AppHeaderIsland } from '@pkgs/ui-root-client/app-header-island';
import { HouseIcon, SettingsIcon } from '@pkgs/ui-root-client/icons';
import { screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { mustQuery, renderUi } from './render';

const WIDE = { width: 1280, height: 900 };

describe('AppHeaderIsland', () => {
  test('renders leading, a navigation of current-page buttons and explicit trailing', async () => {
    const user = userEvent.setup();
    const onHome = mock();
    const onSettings = mock();
    renderUi(
      () => (
        <AppHeaderIsland
          leading={<p class="text">{'Logo'}</p>}
          items={[
            {
              id: 'home',
              label: 'Home',
              icon: HouseIcon,
              active: true,
              onClick: onHome,
            },
            {
              id: 'settings',
              label: 'Settings',
              icon: SettingsIcon,
              active: false,
              onClick: onSettings,
            },
          ]}
          trailing={<p class="text">{'Avatar'}</p>}
        />
      ),
      WIDE
    );
    const root = mustQuery('[data-component="AppHeaderIsland"]');
    expect(root.tagName).toBe('HEADER');
    expect(screen.getByText('Logo')).toBeTruthy();
    expect(screen.getByText('Avatar')).toBeTruthy();
    expect(root.className).toMatch(/\bborder-b\b/);
    const nav = screen.getByRole('navigation', { name: 'Navigation' });
    expect(screen.queryByRole('tablist')).toBeNull();
    const items = Array.from(nav.querySelectorAll('button'));
    expect(items).toHaveLength(2);
    expect(items[0]?.getAttribute('aria-current')).toBe('page');
    expect(items[1]?.hasAttribute('aria-current')).toBe(false);
    expect(items[0]?.className).toMatch(/\bborder-b-text\b/);
    expect(items[1]?.className).toMatch(/\bborder-b-transparent\b/);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onSettings).toHaveBeenCalledTimes(1);
    expect(onHome).not.toHaveBeenCalled();
  });

  test('omits the navigation without items and falls back to AppFrame global trailing', () => {
    renderUi(
      () => (
        <AppFrameChromeProvider globalTrailing={<p class="text">{'Global'}</p>}>
          <AppFrame
            header={<AppHeaderIsland leading={<p class="text">{'Logo'}</p>} />}
          >
            <p class="text">{'body'}</p>
          </AppFrame>
        </AppFrameChromeProvider>
      ),
      WIDE
    );
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.getByText('Global')).toBeTruthy();
    expect(mustQuery('[data-component="AppHeaderIsland"]')).toBeTruthy();
  });
});
