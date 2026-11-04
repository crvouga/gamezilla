/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { MainMenuScreen } from '@pkgs/ui-root-client-ts/main-menu-screen';
import { screen } from '@solidjs/testing-library';
import { renderUi } from './render';

const WIDE = { width: 1280, height: 900 };
const COMPACT = { width: 390, height: 844 };
const ITEMS = [
  { key: 'a', title: 'Board duel', onClick: () => undefined },
  { key: 'b', title: 'Card table', onClick: () => undefined },
  { key: 'c', title: 'Light race', onClick: () => undefined },
];

describe('MainMenuScreen wide grid', () => {
  test('wide, a grid menu gives every destination its own card', () => {
    renderUi(
      () => <MainMenuScreen screenId="games" items={ITEMS} wideLayout="grid" />,
      WIDE
    );
    const list = screen.getByRole('list');
    expect(list.getAttribute('data-layout')).toBe('grid');
    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(3);
    for (const card of cards) expect(card.className).toMatch(/\bpanel\b/);
  });

  test('compact, the same menu stays one panel of rows', () => {
    renderUi(
      () => <MainMenuScreen screenId="games" items={ITEMS} wideLayout="grid" />,
      COMPACT
    );
    const list = screen.getByRole('list');
    expect(list.getAttribute('data-layout')).toBeNull();
    expect(list.className).toMatch(/\bpanel\b/);
  });

  test('without the grid, wide menus keep their rows', () => {
    renderUi(() => <MainMenuScreen screenId="settings" items={ITEMS} />, WIDE);
    expect(screen.getByRole('list').getAttribute('data-layout')).toBeNull();
  });
});
