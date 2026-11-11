/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { GameMenuScreen } from '@pkgs/ui-root-client-ts/game-menu-screen';
import {
  HistoryIcon,
  SearchIcon,
  UsersIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';

/** Connect Four's menu: two ways to play and one look back. */
function threeChoices(width: number) {
  return render(() => (
    <ThemeProvider colorScheme="light" fixedLayout={{ width, height: 900 }}>
      <GameMenuScreen
        screenId="game-choices"
        title="Connect Four"
        motif="discs"
        choices={[
          {
            key: 'custom-game',
            title: 'Play with friends',
            caption: 'With the people in this space, or bots',
            icon: UsersIcon,
            emphasis: 'primary',
            badge: 'Recommended',
            dataSet: { testid: 'choice-play' },
            onClick: () => undefined,
          },
          {
            key: 'matchmaking',
            title: 'Find an opponent',
            caption: 'Meet another Connect Four player',
            icon: SearchIcon,
            dataSet: { testid: 'choice-find' },
            onClick: () => undefined,
          },
          {
            key: 'history',
            title: 'History and stats',
            caption: 'Review your games, wins and draws',
            icon: HistoryIcon,
            emphasis: 'quiet',
            dataSet: { testid: 'choice-history' },
            onClick: () => undefined,
          },
        ]}
      />
    </ThemeProvider>
  ));
}

function menu(width: number, onPlay: () => void) {
  return render(() => (
    <ThemeProvider colorScheme="light" fixedLayout={{ width, height: 900 }}>
      <GameMenuScreen
        screenId="game-choices"
        title="Connect Four"
        motif="discs"
        subtitle="Drop discs and line up four"
        choices={[
          {
            key: 'custom-game',
            title: 'Play with friends or bots',
            caption: 'Choose who plays',
            icon: UsersIcon,
            emphasis: 'primary',
            badge: 'Recommended',
            dataSet: { testid: 'choice-play' },
            onClick: onPlay,
          },
          {
            key: 'history',
            title: 'History and stats',
            icon: HistoryIcon,
            emphasis: 'quiet',
            badge: 'Ignored',
            dataSet: { testid: 'choice-history' },
            onClick: () => undefined,
          },
        ]}
      />
    </ThemeProvider>
  ));
}

describe('GameMenuScreen', () => {
  test('wide: the game heads its menu, every way to play a tile, the main way in leading', () => {
    const onPlay = mock(() => undefined);
    const view = menu(1440, onPlay);
    expect(view.getByRole('heading', { level: 1 }).textContent).toBe(
      'Connect Four'
    );
    expect(view.getByText('Drop discs and line up four')).toBeTruthy();
    const tiles = view.getAllByRole('listitem');
    expect(tiles).toHaveLength(2);
    const play = view.getByTestId('choice-play');
    expect(play.getAttribute('data-emphasis')).toBe('primary');
    expect(play.getAttribute('data-component')).toBe('GameMenuChoice');
    fireEvent.click(play);
    expect(onPlay).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  // regression: game-menu-history-weighs-as-play — wide, "History and stats"
  // was a tile as large as the ways to play, so looking back weighed the
  // same as starting a game.
  test('wide: a quiet choice is a compact row under the tiles, never a tile', () => {
    const view = menu(1440, () => undefined);
    const history = view.getByTestId('choice-history');
    const play = view.getByTestId('choice-play');
    expect(history.closest('[data-layout="links"]')).not.toBeNull();
    expect(history.closest('[data-layout="grid"]')).toBeNull();
    expect(play.closest('[data-layout="grid"]')).not.toBeNull();
    expect(history.getAttribute('data-component')).toBe('GameMenuChoice');
    view.unmount();
  });

  // regression: game-menu-history-row-styled-apart — wide, "History and
  // stats" was a transparent outlined row under two raised cards, with a
  // narrower inner edge, so it looked like a different kind of control.
  // It is a card of the tiles' kind, their surface, edge and inner start
  // edge, only shorter.
  test("wide: the look back is a shorter card of the tiles' own kind", () => {
    const css = readFileSync(
      join(
        import.meta.dirname,
        '../../ui-root-client-ts/src/game-menu-screen/game-menu-screen.module.css'
      ),
      'utf8'
    );
    const body = (selector: string): string => {
      const start = css.indexOf(`${selector} {`);
      return css.slice(start, css.indexOf('}', start));
    };
    const tile = body('.tile');
    const link = body('.link');
    for (const property of ['background', 'border', 'border-radius']) {
      const value = new RegExp(`\\n\\s*${property}:\\s*([^;]+);`);
      expect(link.match(value)?.[1]).toBe(tile.match(value)?.[1]);
    }
    expect(link).toContain('padding: var(--ui-space-3) var(--ui-space-6);');
    expect(tile).toContain('padding: var(--ui-space-6);');
    expect(link).toContain('min-height: 64px;');
  });

  // regression: game-menu-recommended-badge-detached — wide, the
  // "Recommended" tag was a 10px chip at the tile's far corner, far from its
  // title, and the tile's chevron sat at the foot of a mostly empty card.
  test('wide: the lead tag sits beside its title at a readable size, the tile one line across', () => {
    const view = menu(1440, () => undefined);
    const play = view.getByTestId('choice-play');
    const badge = view
      .getByText('Recommended')
      .closest('[data-component="Badge"]');
    expect(badge?.getAttribute('data-size')).toBe('md');
    expect(badge?.getAttribute('data-intent')).toBe('brand');
    expect(
      badge?.parentElement?.contains(
        view.getByText('Play with friends or bots')
      )
    ).toBe(true);
    // Picture, words, chevron: three children across, no head row.
    expect(play.children).toHaveLength(3);
    view.unmount();
  });

  // regression: game-menu-lead-empty-top — wide, the featured lead tile
  // stacked its picture over its words, leaving an empty top, with its
  // chevron centred apart from the words. It reads across like every tile.
  test("wide: the lead reads across, its chevron on its words' axis", () => {
    const css = readFileSync(
      join(
        import.meta.dirname,
        '../../ui-root-client-ts/src/game-menu-screen/game-menu-screen.module.css'
      ),
      'utf8'
    );
    const tile = css.slice(css.indexOf('.tile {'));
    const rule = tile.slice(0, tile.indexOf('}'));
    expect(rule).toContain('flex-direction: row');
    expect(rule).toContain('align-items: center');
    const view = threeChoices(1440);
    expect(view.getByTestId('choice-play').children).toHaveLength(3);
    view.unmount();
  });

  test('phone: the same choices as one panel of menu rows', () => {
    const view = menu(390, () => undefined);
    expect(view.getByTestId('choice-play').getAttribute('data-component')).toBe(
      'MainMenuItem'
    );
    expect(view.getByText('Drop discs and line up four')).toBeTruthy();
    view.unmount();
  });

  // regression: game-menu-primary-emphasis-differs-by-size — wide led with a
  // tinted card that read as hovered or chosen; a phone row lost the lead.
  test('the main way in leads alike on every size: its picture on the accent and its tag', () => {
    for (const width of [1440, 390]) {
      const view = menu(width, () => undefined);
      const play = view.getByTestId('choice-play');
      const history = view.getByTestId('choice-history');
      expect(play.textContent).toContain('Recommended');
      expect(history.textContent).not.toContain('Ignored');
      expect(
        play.querySelector('[aria-hidden="true"][data-emphasis="primary"]')
      ).not.toBeNull();
      expect(
        history.querySelector('[aria-hidden="true"][data-emphasis="quiet"]')
      ).not.toBeNull();
      view.unmount();
    }
  });

  // regression: game-menu-uneven-hierarchy — wide, two large tiles sat over
  // one slim full-width "History and stats" row, an uneven block.
  // regression: game-menu-lead-tall-empty — the lead then spanned the other
  // tile and the look back, 180px tall with its words floating in its
  // middle, beside titles of two sizes. The two ways to play are tiles of
  // one size and one title style, as tall as their words; the look back is
  // a compact row that never spans the menu alone.
  test('wide: two ways to play are tiles of one size, the look back a full-width row under them', () => {
    const view = threeChoices(1440);
    const play = view.getByTestId('choice-play');
    const find = view.getByTestId('choice-find');
    const grid = play.closest('[data-layout="grid"]') as HTMLElement | null;
    expect(grid?.contains(find)).toBe(true);
    expect(grid?.style.getPropertyValue('--game-menu-columns')).toBe('2');
    const titleClass = (choice: HTMLElement) =>
      choice.querySelector('.textHeading')?.textContent;
    expect(titleClass(play)).toBe('Play with friends');
    expect(titleClass(find)).toBe('Find an opponent');
    // regression: game-menu-history-orphaned — the look back was then a
    // half-width row alone under the two tiles.
    // regression: game-menu-history-floats-at-hero — moved to the hero's
    // end it floated top-right, aligned with nothing. One quiet choice alone
    // is a row under the tiles spanning their full width.
    const history = view.getByTestId('choice-history');
    const links = history.closest('[data-layout="links"]') as HTMLElement;
    expect(links.closest('[data-layout="hero"]')).toBeNull();
    expect(links.style.getPropertyValue('--game-menu-link-columns')).toBe('1');
    expect(
      grid !== null &&
        (grid.compareDocumentPosition(links) &
          Node.DOCUMENT_POSITION_FOLLOWING) !==
          0
    ).toBe(true);
    expect(history.closest('[data-layout="grid"]')).toBeNull();
    view.unmount();
  });

  // regression: game-menu-recommended-own-line — on a phone the
  // "Recommended" tag took a line of its own between the title and caption.
  // regression: game-menu-recommended-splits-sentence — moved to the start
  // of the caption, it then broke the caption's sentence.
  // regression: game-menu-tag-uneven-rows — then it headed the row over the
  // title, making the lead's row taller than the rest. It sits beside its
  // (shorter) title on the title's own line, never in the caption.
  test("phone: the lead's tag sits beside its title, never on a line of its own or in the caption", () => {
    const view = threeChoices(390);
    const caption = view.getByText('With the people in this space, or bots');
    expect(caption.querySelector('[data-component="Badge"]')).toBeNull();
    const badge = view
      .getByTestId('choice-play')
      .querySelector('[data-component="Badge"]');
    expect(badge?.textContent).toBe('Recommended');
    const title = view.getByText('Play with friends');
    const before = (a: Node, b: Node): boolean =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    if (badge === null) throw new Error('No tag');
    // On the title's own line: the tag and the title share one row box.
    expect(badge.parentElement?.contains(title)).toBe(true);
    expect(before(title, badge)).toBe(true);
    expect(before(badge, caption)).toBe(true);
    view.unmount();
  });
});
