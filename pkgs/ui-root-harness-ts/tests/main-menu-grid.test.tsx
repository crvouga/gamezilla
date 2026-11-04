/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { MainMenuScreen } from '@pkgs/ui-root-client-ts/main-menu-screen';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
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

describe('balanced grids', () => {
  test('four destinations take two columns so none is stranded', () => {
    renderUi(
      () => (
        <MainMenuScreen
          screenId="games"
          items={[
            ...ITEMS,
            { key: 'd', title: 'Path puzzle', onClick: () => undefined },
          ]}
          wideLayout="grid"
        />
      ),
      WIDE
    );
    expect(screen.getByRole('list').className).toMatch(/\bgrid-cols-2\b/);
  });
});

describe('MenuSection grid', () => {
  test('wide, a grid section gives every row its own card', () => {
    renderUi(
      () => (
        <MenuSection title="Spaces" wideLayout="grid">
          <MenuRow title="Friday game night" onClick={() => undefined} />
          <MenuRow title="robin_42's space" onClick={() => undefined} />
        </MenuSection>
      ),
      WIDE
    );
    const group = screen.getByRole('group');
    expect(group.getAttribute('data-layout')).toBe('cards');
    expect(group.querySelectorAll(':scope > .panel')).toHaveLength(2);
  });

  test('compact, the same section stays one panel', () => {
    renderUi(
      () => (
        <MenuSection title="Spaces" wideLayout="grid">
          <MenuRow title="Friday game night" onClick={() => undefined} />
          <MenuRow title="robin_42's space" onClick={() => undefined} />
        </MenuSection>
      ),
      COMPACT
    );
    const group = screen.getByRole('group');
    expect(group.getAttribute('data-layout')).toBeNull();
    expect(group.className).toMatch(/\bpanel\b/);
  });
});
