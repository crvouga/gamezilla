/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { AppFrame } from '@pkgs/ui-root-client-ts/app-frame';
import {
  AppFrameChromeProvider,
  useSetAppFrameHeader,
} from '@pkgs/ui-root-client-ts/app-frame-chrome';
import { AppHeaderIsland } from '@pkgs/ui-root-client-ts/app-header-island';
import { HouseIcon, SettingsIcon } from '@pkgs/ui-root-client-ts/icons';
import { screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal, type JSX, Show } from 'solid-js';
import { mustQuery, renderUi } from './render';

const WIDE = { width: 1280, height: 900 };
const COMPACT = { width: 390, height: 844 };

function Sidebar(props: { onSettings?: () => void }): JSX.Element {
  return (
    <AppHeaderIsland
      orientation="vertical"
      leading={<p class="text">{'Logo'}</p>}
      items={[
        {
          id: 'home',
          label: 'Home',
          icon: HouseIcon,
          active: true,
          onClick: () => undefined,
        },
        {
          id: 'settings',
          label: 'Settings',
          icon: SettingsIcon,
          active: false,
          onClick: () => props.onSettings?.(),
        },
      ]}
      trailing={<p class="text">{'Avatar'}</p>}
    />
  );
}

/** A screen that draws its own chrome for its lifetime, like an open space. */
function OwnChrome(): JSX.Element {
  useSetAppFrameHeader(<p class="text">{'Space chrome'}</p>);
  return <p class="text">{'In a space'}</p>;
}

describe('AppHeaderIsland sidebar', () => {
  test('is a navigation of current-page rows with the global chrome at its foot', async () => {
    const user = userEvent.setup();
    const onSettings = mock();
    renderUi(() => <Sidebar onSettings={onSettings} />, WIDE);
    const root = mustQuery('[data-component="AppHeaderIsland"]');
    expect(root.tagName).toBe('HEADER');
    expect(root.getAttribute('data-orientation')).toBe('vertical');
    const nav = screen.getByRole('navigation', { name: 'Navigation' });
    const items = Array.from(nav.querySelectorAll('button'));
    expect(items).toHaveLength(2);
    expect(items[0]?.getAttribute('aria-current')).toBe('page');
    expect(items[1]?.hasAttribute('aria-current')).toBe(false);
    // Rows in a list take the control radius, not the pill.
    expect(items[0]?.className).toMatch(/\brounded-control\b/);
    expect(screen.getByText('Avatar')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onSettings).toHaveBeenCalledTimes(1);
  });
});

describe('AppFrame rail', () => {
  test('wide layouts draw the rail beside the content', () => {
    renderUi(
      () => (
        <AppFrameChromeProvider>
          <AppFrame rail={<Sidebar />}>
            <p class="text">{'Content'}</p>
          </AppFrame>
        </AppFrameChromeProvider>
      ),
      WIDE
    );
    const rail = mustQuery('[data-region="rail"]');
    expect(rail.contains(screen.getByRole('navigation'))).toBe(true);
    expect(rail.contains(screen.getByText('Content'))).toBe(false);
  });

  test('compact layouts never draw the rail', () => {
    renderUi(
      () => (
        <AppFrameChromeProvider>
          <AppFrame rail={<Sidebar />}>
            <p class="text">{'Content'}</p>
          </AppFrame>
        </AppFrameChromeProvider>
      ),
      COMPACT
    );
    expect(document.querySelector('[data-region="rail"]')).toBeNull();
    expect(screen.getByText('Content')).toBeTruthy();
  });

  test('the rail steps aside while a screen draws its own chrome', () => {
    const [inSpace, setInSpace] = createSignal(false);
    renderUi(
      () => (
        <AppFrameChromeProvider>
          <AppFrame rail={<Sidebar />}>
            <Show when={inSpace()} fallback={<p class="text">{'Lobby'}</p>}>
              <OwnChrome />
            </Show>
          </AppFrame>
        </AppFrameChromeProvider>
      ),
      WIDE
    );
    expect(document.querySelector('[data-region="rail"]')).not.toBeNull();
    setInSpace(true);
    expect(document.querySelector('[data-region="rail"]')).toBeNull();
    expect(screen.getByText('Space chrome')).toBeTruthy();
    setInSpace(false);
    expect(document.querySelector('[data-region="rail"]')).not.toBeNull();
  });

  test('an open space narrows the column so its chrome and screen share edges', () => {
    const [inSpace, setInSpace] = createSignal(false);
    renderUi(
      () => (
        <AppFrameChromeProvider>
          <AppFrame rail={<Sidebar />}>
            <Show when={inSpace()} fallback={<p class="text">{'Lobby'}</p>}>
              <OwnChrome />
            </Show>
          </AppFrame>
        </AppFrameChromeProvider>
      ),
      WIDE
    );
    const column = () => mustQuery('[data-region="column"]');
    expect(column().className).toMatch(/\bmax-w-ui-wide\b/);
    setInSpace(true);
    expect(column().className).toMatch(/\bmax-w-ui-space\b/);
    expect(column().className).not.toMatch(/\bmax-w-ui-wide\b/);
  });
});
