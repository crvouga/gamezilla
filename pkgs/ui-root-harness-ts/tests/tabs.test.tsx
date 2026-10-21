/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { auditTree, formatFailure } from '@pkgs/a11y-shared-ts/audit';
import type { TabItem } from '@pkgs/ui-root-client-ts/tabs';
import { Tabs } from '@pkgs/ui-root-client-ts/tabs';
import { screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal } from 'solid-js';
import { mustQuery, renderUi } from './render';

const ITEMS: readonly TabItem[] = [
  { value: 'games', label: 'Games', badge: 12 },
  { value: 'friends', label: 'Friends' },
  { value: 'saved', label: 'Saved', disabled: true },
  { value: 'about', label: 'About' },
];

function panelText(): string {
  return screen.getByRole('tabpanel').textContent;
}

describe('Tabs', () => {
  test('wires tabs to panels with roles, names and one tab stop', () => {
    renderUi(() => (
      <Tabs aria-label="Profile" items={ITEMS} testId="profile">
        {(value) => `${value} panel`}
      </Tabs>
    ));
    const list = screen.getByRole('tablist', { name: 'Profile' });
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Games12',
      'Friends',
      'Saved',
      'About',
    ]);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1, -1]);
    expect(tabs[2]).toBeDisabled();
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', tabs[0]?.id ?? '');
    expect(tabs[0]).toHaveAttribute('aria-controls', panel.id);
    for (const tab of tabs) {
      const controlled = tab.getAttribute('aria-controls') ?? '';
      expect(document.getElementById(controlled)).not.toBeNull();
    }
    expect(panelText()).toBe('games panel');
    expect(screen.getByTestId('profile-friends').textContent).toBe('Friends');
    expect(auditTree(list).map(formatFailure)).toEqual([]);
  });

  test('arrow keys, Home and End move and select, skipping disabled tabs', async () => {
    const user = userEvent.setup();
    const onValueChange = mock((_value: string) => undefined);
    renderUi(() => (
      <Tabs aria-label="Profile" items={ITEMS} onValueChange={onValueChange}>
        {(value) => `${value} panel`}
      </Tabs>
    ));
    const tab = (name: string) =>
      screen.getByRole('tab', { name: new RegExp(name) });
    tab('Games').focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(tab('Friends'));
    expect(tab('Friends')).toHaveAttribute('aria-selected', 'true');
    expect(panelText()).toBe('friends panel');
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(tab('About'));
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(tab('Games'));
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(tab('About'));
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(tab('Games'));
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(tab('About'));
    expect(panelText()).toBe('about panel');
    expect(onValueChange.mock.calls.map(([value]) => value)).toEqual([
      'friends',
      'about',
      'games',
      'about',
      'games',
      'about',
    ]);
  });

  test('controlled value wins and follows the owner', async () => {
    const user = userEvent.setup();
    const [value, setValue] = createSignal('friends');
    renderUi(() => (
      <Tabs
        aria-label="Profile"
        items={ITEMS}
        value={value()}
        onValueChange={setValue}
      >
        {(current) => `${current} panel`}
      </Tabs>
    ));
    expect(panelText()).toBe('friends panel');
    setValue('about');
    expect(panelText()).toBe('about panel');
    await user.click(screen.getByRole('tab', { name: /Games/ }));
    expect(screen.getByRole('tab', { name: /Games/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(panelText()).toBe('games panel');
  });

  test('defaultValue picks the first tab; unselected panels are hidden', () => {
    renderUi(() => (
      <Tabs aria-label="Profile" items={ITEMS} defaultValue="about">
        {(value) => `${value} panel`}
      </Tabs>
    ));
    expect(panelText()).toBe('about panel');
    const panels = document.querySelectorAll('[role="tabpanel"]');
    expect(panels).toHaveLength(ITEMS.length);
    expect(
      Array.from(panels).filter((p) => !p.hasAttribute('hidden'))
    ).toHaveLength(1);
  });

  test('underline tabs share the width on compact layouts; pill is a track', () => {
    const { unmount } = renderUi(
      () => (
        <Tabs aria-label="Profile" items={ITEMS}>
          {(value) => value}
        </Tabs>
      ),
      { width: 390 }
    );
    expect(screen.getAllByRole('tab')[0]?.className).toMatch(/\bflex-1\b/);
    expect(mustQuery('[role="tablist"]').className).toMatch(/\bborder-b\b/);
    unmount();
    renderUi(() => (
      <Tabs aria-label="Range" items={ITEMS} variant="pill">
        {(value) => value}
      </Tabs>
    ));
    expect(mustQuery('[data-component="Tabs"]')).toHaveAttribute(
      'data-variant',
      'pill'
    );
    expect(mustQuery('[role="tablist"]').className).toMatch(/\brounded-full\b/);
    expect(screen.getAllByRole('tab')[0]?.className).not.toMatch(/\bflex-1\b/);
  });
});
