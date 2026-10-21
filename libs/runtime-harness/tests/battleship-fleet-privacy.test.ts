import { describe, expect, test } from 'bun:test';
import {
  boardsShownIn,
  fleetSeenBeyondShots,
  wholeFleetShown,
} from '@libs/battleship-harness/battleship-boards-shown';

const BOARD = 'multiplayer-board';

type Cell = { readonly tone: string; readonly label: string };

function button(view: 'own' | 'target', cell: string, shown: Cell): string {
  return `<button data-testid="${BOARD}-${view}-${cell}" data-tone="${shown.tone}" aria-label="${shown.label}" aria-disabled="true">x</button>`;
}

/** Rows 1 and 2 hold the fleet: carrier a1–e1, battleship a2–d2, cruiser f1–h1, submarine f2–h2, destroyer i1–i2. */
const FLEET: Readonly<Record<string, string>> = {
  a1: 'carrier',
  b1: 'carrier',
  c1: 'carrier',
  d1: 'carrier',
  e1: 'carrier',
  a2: 'battleship',
  b2: 'battleship',
  c2: 'battleship',
  d2: 'battleship',
  f1: 'cruiser',
  g1: 'cruiser',
  h1: 'cruiser',
  f2: 'submarine',
  g2: 'submarine',
  h2: 'submarine',
  i1: 'destroyer',
  i2: 'destroyer',
};

function ownHtml(): string {
  return Object.entries(FLEET)
    .map(([cell, ship]) =>
      button('own', cell, { tone: 'occupied', label: `${cell}: your ${ship}` })
    )
    .join('');
}

function screen(target: Readonly<Record<string, Cell>>, extra = ''): string {
  return (
    ownHtml() +
    Object.entries(target)
      .map(([cell, shown]) => button('target', cell, shown))
      .join('') +
    extra
  );
}

const rival = boardsShownIn(ownHtml(), BOARD).own;

describe('what a Battleship screen shows of the rival fleet', () => {
  test('a screen with its own whole fleet reads as one', () => {
    expect(wholeFleetShown(rival)).toBe(true);
  });

  test('marks the viewer’s shots found are not seen beyond them', () => {
    const html = screen({
      a1: { tone: 'alert', label: 'A1: hit' },
      j9: { tone: 'quiet', label: 'J9: miss' },
      b1: { tone: 'open', label: 'Fire at B1' },
    });
    expect(
      fleetSeenBeyondShots({
        viewerHtml: html,
        viewer: boardsShownIn(html, BOARD),
        rivalOwn: rival,
      })
    ).toBe(0);
  });

  test('a targeting cell drawn as a ship no shot struck is seen', () => {
    const html = screen({
      b1: { tone: 'occupied', label: 'B1' },
      c1: { tone: 'open', label: 'C1: the carrier' },
    });
    expect(
      fleetSeenBeyondShots({
        viewerHtml: html,
        viewer: boardsShownIn(html, BOARD),
        rivalOwn: rival,
      })
    ).toBe(2);
  });

  test('a placement of an unsunk rival ship anywhere on the screen is seen', () => {
    const html = screen({}, '<div data-setup="fleet:cruiser@f1h"></div>');
    expect(
      fleetSeenBeyondShots({
        viewerHtml: html,
        viewer: { ...boardsShownIn(html, BOARD), own: {} },
        rivalOwn: rival,
      })
    ).toBe(1);
  });
});
