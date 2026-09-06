/** @jsxImportSource solid-js */
import { AppFrame, AppFrameChromeProvider, Text } from '@pkgs/ui';
import { AppHeaderIsland } from '@pkgs/ui/components/app-header-island';
import { HouseIcon, SettingsIcon } from '@pkgs/ui/components/icons';
import { screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { mustQuery, renderUi } from './support/render';

const WIDE = { width: 1280, height: 900 };

describe('AppHeaderIsland', () => {
  test('renders leading, tabs (aria-selected) and explicit trailing', async () => {
    const user = userEvent.setup();
    const onHome = vi.fn();
    const onSettings = vi.fn();
    renderUi(
      () => (
        <AppHeaderIsland
          leading={<Text label="Logo" />}
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
          trailing={<Text label="Avatar" />}
        />
      ),
      WIDE
    );
    const root = mustQuery('[data-component="AppHeaderIsland"]');
    expect(root.tagName).toBe('HEADER');
    expect(screen.getByText('Logo')).toBeTruthy();
    expect(screen.getByText('Avatar')).toBeTruthy();
    expect(screen.getByRole('tablist')).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('false');
    await user.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(onSettings).toHaveBeenCalledTimes(1);
    expect(onHome).not.toHaveBeenCalled();
  });

  test('omits the tablist without items and falls back to AppFrame global trailing', () => {
    renderUi(
      () => (
        <AppFrameChromeProvider globalTrailing={<Text label="Global" />}>
          <AppFrame
            header={<AppHeaderIsland leading={<Text label="Logo" />} />}
          >
            <Text label="body" />
          </AppFrame>
        </AppFrameChromeProvider>
      ),
      WIDE
    );
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByText('Global')).toBeTruthy();
    expect(mustQuery('[data-component="AppHeaderIsland"]')).toBeTruthy();
  });
});
