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

describe('tiles', () => {
  // regression: space-game-cards-underfilled — wide, the space's games were
  // two-column cards with one-line descriptions, each mostly empty room.
  test('four games are four tiles in one row, each read top to bottom with two lines of what it is', () => {
    renderUi(
      () => (
        <MainMenuScreen
          screenId="games"
          items={[
            ...ITEMS,
            { key: 'd', title: 'Path puzzle', onClick: () => undefined },
          ].map((item) => ({
            ...item,
            caption: 'Two players, one board, turn by turn.',
            meta: '2 players',
            leading: <span data-testid={`tile-${item.key}`}>tile</span>,
          }))}
          wideLayout="tiles"
        />
      ),
      WIDE
    );
    const list = screen.getByRole('list');
    expect(list.getAttribute('data-layout')).toBe('tiles');
    expect(list.className).toMatch(/\bgrid-cols-4\b/);
    const caption = screen.getAllByText(
      'Two players, one board, turn by turn.'
    )[0];
    expect(caption?.className).toMatch(/\bline-clamp-2\b/);
    // The picture heads the tile, above the name.
    const picture = screen.getByTestId('tile-a');
    const title = screen.getByText('Board duel');
    expect(
      picture.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(picture.parentElement?.contains(title)).toBe(false);
  });

  test('compact, a tile menu stays one panel of rows', () => {
    renderUi(
      () => (
        <MainMenuScreen screenId="games" items={ITEMS} wideLayout="tiles" />
      ),
      COMPACT
    );
    expect(screen.getByRole('list').getAttribute('data-layout')).toBeNull();
  });
});
