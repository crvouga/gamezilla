/** @jsxImportSource @solidjs/web */

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
        screenId="game-home"
        title="Connect Four"
        motif="discs"
        moreTestId="choice-more"
        choices={[
          {
            key: 'game-session',
            title: 'Play with friends',
            caption: 'With the people in this space, or bots',
            icon: UsersIcon,
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

/** Open More, as a person does before a quiet choice. */
function openMore(view: ReturnType<typeof menu>): void {
  fireEvent.click(view.getByTestId('choice-more'));
}

function menu(width: number, onPlay: () => void) {
  return render(() => (
    <ThemeProvider colorScheme="light" fixedLayout={{ width, height: 900 }}>
      <GameMenuScreen
        screenId="game-home"
        title="Connect Four"
        motif="discs"
        subtitle="Drop discs and line up four"
        moreTestId="choice-more"
        choices={[
          {
            key: 'game-session',
            title: 'Play with friends or bots',
            caption: 'Choose who plays',
            icon: UsersIcon,
            dataSet: { testid: 'choice-play' },
            onClick: onPlay,
          },
          {
            key: 'history',
            title: 'History and stats',
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

const CSS = readFileSync(
  join(
    import.meta.dirname,
    '../../ui-root-client-ts/src/game-menu-screen/game-menu-screen.module.css'
  ),
  'utf8'
);

/** The declarations of one rule of the menu's stylesheet. */
function body(selector: string): string {
  const start = CSS.indexOf(`${selector} {`);
  return CSS.slice(start, CSS.indexOf('}', start));
}

describe('GameMenuScreen', () => {
  test('wide: the game heads its menu and its first way to play is the primary control', () => {
    const onPlay = mock(() => undefined);
    const view = menu(1440, onPlay);
    expect(view.getByRole('heading', { level: 1 }).textContent).toBe(
      'Connect Four'
    );
    expect(view.queryByText('Drop discs and line up four')).toBeNull();
    const play = view.getByTestId('choice-play');
    expect(play.getAttribute('data-emphasis')).toBe('primary');
    expect(play.getAttribute('data-component')).toBe('GameMenuChoice');
    expect(play.closest('[data-layout="primary"]')).not.toBeNull();
    expect(play.textContent).toContain('Play with friends or bots');
    expect(play.textContent).not.toContain('Choose who plays');
    fireEvent.click(play);
    expect(onPlay).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  // regression: game-menu-history-weighs-as-play — wide, "History and stats"
  // was a tile as large as the ways to play, so looking back weighed the
  // same as starting a game. It waits behind More, a compact row.
  test('wide: a quiet choice is a compact row behind More, never a tile', () => {
    const view = menu(1440, () => undefined);
    openMore(view);
    const history = view.getByTestId('choice-history');
    const play = view.getByTestId('choice-play');
    expect(history.closest('[data-layout="links"]')).not.toBeNull();
    expect(history.closest('[data-layout="grid"]')).toBeNull();
    expect(history.closest('[data-layout="primary"]')).toBeNull();
    expect(play.closest('[data-layout="links"]')).toBeNull();
    expect(history.getAttribute('data-component')).toBe('GameMenuChoice');
    view.unmount();
  });

  // regression: game-menu-history-row-styled-apart — wide, "History and
  // stats" was a transparent outlined row under two raised cards, with a
  // narrower inner edge, so it looked like a different kind of control.
  // It is a card of the rows' kind, their surface, edge and inner start
  // edge, only shorter.
  test("wide: the look back is a shorter card of the rows' own kind", () => {
    const tile = body('.tile');
    const link = body('.link');
    for (const property of ['background', 'border', 'border-radius']) {
      const value = new RegExp(`\\n\\s*${property}:\\s*([^;]+);`);
      expect(link.match(value)?.[1]).toBe(tile.match(value)?.[1]);
    }
    expect(link).toContain('padding: var(--ui-space-3) var(--ui-space-6);');
    expect(tile).toContain('padding: var(--ui-space-3) var(--ui-space-6);');
    expect(link).toContain('min-height: 64px;');
  });

  // regression: game-menu-recommended-badge-detached — the "Recommended"
  // tag was a chip far from its title. No row carries a tag, so a row is
  // its picture, its words and its chevron, one line across.
  test('wide: a row is one line across with no tag', () => {
    const view = threeChoices(1440);
    const find = view.getByTestId('choice-find');
    expect(find.querySelector('[data-component="Badge"]')).toBeNull();
    // Picture, words, chevron: three children across, no head row.
    expect(find.children).toHaveLength(3);
    view.unmount();
  });

  // regression: game-menu-lead-empty-top — wide, the featured lead tile
  // stacked its picture over its words, leaving an empty top, with its
  // chevron centred apart from the words. Rows read across.
  test("wide: a row reads across, its chevron on its words' axis", () => {
    const rule = body('.tile');
    expect(rule).toContain('flex-direction: row');
    expect(rule).toContain('align-items: center');
  });

  // regression: game-menu-first-tile-tinted — the first tile of a game's
  // menu was painted with the accent by position while its siblings stayed
  // on the card surface, and its caption lost contrast on it. Only the
  // primary control is filled, named by its own rule and never by position;
  // every row wears the same surface.
  test('only the primary control is filled; every row wears the card surface', () => {
    expect(CSS).not.toContain(':first-child');
    expect(CSS).not.toContain('--ui-color-primary-strong');
    for (const row of ['.tile', '.link']) {
      expect(body(row)).toContain('background: var(--ui-color-surface);');
      expect(body(row)).not.toContain('--ui-color-tint-active');
      expect(body(row)).not.toContain('--ui-color-on-primary');
    }
    const primary = body('.primary');
    expect(primary).toContain('background: var(--ui-color-surface);');
    expect(primary).toContain('color: var(--ui-color-text);');
    expect(primary).toContain('width: 100%;');
  });

  test('phone: the same choices, the primary control above the rows', () => {
    const view = menu(390, () => undefined);
    expect(view.getByTestId('choice-play').getAttribute('data-component')).toBe(
      'GameMenuChoice'
    );
    expect(view.queryByText('Drop discs and line up four')).toBeNull();
    view.unmount();
  });

  // regression: game-menu-primary-emphasis-differs-by-size — wide led with a
  // tinted card that read as hovered or chosen; a phone row lost the lead.
  // The first way to play is the one primary control on every size; no
  // other way to play is drawn as primary, and none carries a tag.
  test('exactly one way to play is primary, on every size', () => {
    for (const width of [1440, 390]) {
      const view = threeChoices(width);
      expect(
        view.getByTestId('choice-play').getAttribute('data-emphasis')
      ).toBe('primary');
      const find = view.getByTestId('choice-find');
      expect(find.getAttribute('data-emphasis')).toBeNull();
      expect(find.querySelector('[data-emphasis="primary"]')).toBeNull();
      expect(
        view.container.querySelectorAll('[data-emphasis="primary"]')
      ).toHaveLength(1);
      expect(view.queryByText('Recommended')).toBeNull();
      fireEvent.click(view.getByTestId('choice-more'));
      expect(
        view
          .getByTestId('choice-history')
          .querySelector('[aria-hidden="true"][data-emphasis="quiet"]')
      ).not.toBeNull();
      view.unmount();
    }
  });

  // regression: game-menu-uneven-hierarchy — wide, two large tiles sat over
  // one slim full-width "History and stats" row, an uneven block.
  // regression: game-menu-lead-tall-empty — the lead then spanned the other
  // tile and the look back, 180px tall with its words floating in its
  // middle. The primary control is as tall as its words; the other way to
  // play is a full-width row under it; the look back waits behind More.
  test('wide: the primary control, then the other ways to play as rows, then More', () => {
    const view = threeChoices(1440);
    const play = view.getByTestId('choice-play');
    const find = view.getByTestId('choice-find');
    const more = view.getByTestId('choice-more');
    const grid = find.closest('[data-layout="grid"]') as HTMLElement;
    const lead = play.closest('[data-layout="primary"]') as HTMLElement;
    const follows = (a: Element, b: Element): boolean =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(grid).not.toBeNull();
    expect(lead).not.toBeNull();
    expect(grid.contains(play)).toBe(false);
    expect(follows(lead, grid)).toBe(true);
    expect(follows(grid, more)).toBe(true);
    // regression: game-menu-history-orphaned — the look back was a half-width
    // row alone under the two tiles; it is a full-width row inside More.
    // regression: game-menu-history-floats-at-hero — the look back is a row
    // behind More under the rows, never at the hero.
    fireEvent.click(more);
    const history = view.getByTestId('choice-history');
    const links = history.closest('[data-layout="links"]') as HTMLElement;
    expect(links.closest('[data-layout="hero"]')).toBeNull();
    expect(links.closest('[data-component="DisclosureCard"]')).toBeTruthy();
    expect(follows(grid, links)).toBe(true);
    expect(history.closest('[data-layout="grid"]')).toBeNull();
    view.unmount();
  });

  test('More is a named control, closed at first; opening it leaves the primary control in place', () => {
    for (const width of [1440, 390]) {
      const view = menu(width, () => undefined);
      const more = view.getByRole('button', { name: 'More' });
      expect(more).toBe(view.getByTestId('choice-more'));
      expect(more.getAttribute('aria-expanded')).toBe('false');
      const play = view.getByTestId('choice-play');
      const lead = play.closest('[data-layout="primary"]');
      const above = lead?.previousElementSibling;
      fireEvent.click(more);
      expect(more.getAttribute('aria-expanded')).toBe('true');
      expect(view.getByTestId('choice-play')).toBe(play);
      expect(play.closest('[data-layout="primary"]')).toBe(lead);
      expect(lead?.previousElementSibling).toBe(above);
      view.unmount();
    }
  });

  test('a game with no quiet choice shows no More', () => {
    const view = render(() => (
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 390, height: 900 }}
      >
        <GameMenuScreen
          screenId="game-home"
          title="Numberlink"
          motif="paths"
          moreTestId="choice-more"
          choices={[
            {
              key: 'library',
              title: 'Puzzles and packs',
              icon: UsersIcon,
              dataSet: { testid: 'choice-library' },
              onClick: () => undefined,
            },
          ]}
        />
      </ThemeProvider>
    ));
    expect(view.queryByTestId('choice-more')).toBeNull();
    expect(
      view.getByTestId('choice-library').getAttribute('data-emphasis')
    ).toBe('primary');
    view.unmount();
  });

  // regression: game-menu-recommended-own-line — on a phone the
  // "Recommended" tag took a line of its own between the title and caption.
  // regression: game-menu-recommended-splits-sentence — moved to the start
  // of the caption, it then broke the caption's sentence.
  // regression: game-menu-tag-uneven-rows — then it headed the row over the
  // title, making the lead's row taller than the rest. No row carries a
  // tag, so every row is its title over its whole caption.
  test('phone: every row is its title over its caption, with no tag anywhere', () => {
    const view = threeChoices(390);
    fireEvent.click(view.getByTestId('choice-more'));
    expect(
      view.queryByText('With the people in this space, or bots')
    ).toBeNull();
    expect(view.getByText('Play with friends')).toBeTruthy();
    for (const id of ['choice-play', 'choice-find', 'choice-history'])
      expect(
        view.getByTestId(id).querySelector('[data-component="Badge"]')
      ).toBeNull();
    view.unmount();
  });
});
