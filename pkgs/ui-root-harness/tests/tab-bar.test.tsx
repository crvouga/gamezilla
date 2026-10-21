/** @jsxImportSource solid-js */
/** The compact bottom navigation, as a person and a listener meet it. */

import { describe, expect, mock, test } from 'bun:test';
import { requiredContext, requiredOwned } from '@pkgs/a11y-shared/aria-rules';
import { auditTree, formatFailure } from '@pkgs/a11y-shared/audit';
import { HouseIcon, SearchIcon, UserIcon } from '@pkgs/ui-root-client/icons';
import { TabBar, type TabBarItem } from '@pkgs/ui-root-client/tab-bar';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal } from 'solid-js';
import { renderUi } from './render';

const COMPACT = { width: 390, height: 800 };

describe('TabBar', () => {
  test('is a named navigation landmark of buttons with the current page marked', async () => {
    const user = userEvent.setup();
    const [current, setCurrent] = createSignal('home');
    const onSearch = mock(() => setCurrent('search'));
    const items: TabBarItem[] = [
      {
        id: 'home',
        label: 'Home',
        icon: HouseIcon,
        get current() {
          return current() === 'home';
        },
        onPress: () => setCurrent('home'),
        dataSet: { testid: 'tab-home' },
      },
      {
        id: 'search',
        label: 'Search',
        icon: SearchIcon,
        get current() {
          return current() === 'search';
        },
        onPress: onSearch,
        badge: '3',
      },
    ];
    renderUi(() => <TabBar aria-label="Main" items={items} />, COMPACT);
    const failures = auditTree(document.body, [requiredOwned, requiredContext]);
    expect(failures.map(formatFailure)).toEqual([]);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav.className).toMatch(/\bborder-t\b/);
    expect(nav.className).toMatch(/\bsafeBottom\b/);
    expect(screen.queryByRole('tablist')).toBeNull();
    const home = screen.getByRole('button', { name: 'Home' });
    expect(home.getAttribute('data-testid')).toBe('tab-home');
    expect(home.getAttribute('aria-current')).toBe('page');
    // The badge is shown, but the accessible name stays the label.
    const search = screen.getByRole('button', { name: 'Search' });
    expect(search.textContent).toContain('3');
    expect(search.hasAttribute('aria-current')).toBe(false);
    await user.click(search);
    expect(onSearch).toHaveBeenCalledTimes(1);
    // Updated in place: the same element is now the current page.
    expect(search.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Search' }) === search).toBe(
      true
    );
    expect(home.hasAttribute('aria-current')).toBe(false);
  });

  test('href items are links; onPress takes a plain click, modified clicks stay the browser’s', () => {
    const onPress = mock();
    renderUi(
      () => (
        <TabBar
          aria-label="Main"
          items={[
            {
              id: 'profile',
              label: 'Profile',
              icon: UserIcon,
              current: false,
              href: '/profile',
              onPress,
            },
          ]}
        />
      ),
      COMPACT
    );
    const link = screen.getByRole('link', { name: 'Profile' });
    expect(link.getAttribute('href')).toBe('/profile');
    const plain = fireEvent.click(link);
    expect(plain).toBe(false);
    expect(onPress).toHaveBeenCalledTimes(1);
    const modified = fireEvent.click(link, { metaKey: true });
    expect(modified).toBe(true);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
