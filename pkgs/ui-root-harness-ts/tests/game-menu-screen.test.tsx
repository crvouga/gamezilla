/** @jsxImportSource @solidjs/web */

import { describe, expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { GameMenuScreen } from '@pkgs/ui-root-client-ts/game-menu-screen';
import {
  FriendsArt,
  HistoryArt,
  SearchArt,
} from '@pkgs/ui-root-client-ts/illustration';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';

/** Connect Four's menu: two ways to play and one look back. */
function threeChoices(width: number) {
  return render(() => (
    <ThemeProvider fixedLayout={{ width, height: 900 }}>
      <GameMenuScreen
        screenId="game-home"
        title="Connect Four"
        motif="discs"
        choices={[
          {
            key: 'game-session',
            title: 'Play with friends',
            caption: 'With the people in this space, or bots',
            icon: FriendsArt,
            dataSet: { testid: 'choice-play' },
            onClick: () => undefined,
          },
          {
            key: 'matchmaking',
            title: 'Find an opponent',
            caption: 'Meet another Connect Four player',
            icon: SearchArt,
            dataSet: { testid: 'choice-find' },
            onClick: () => undefined,
          },
          {
            key: 'history',
            title: 'History and stats',
            caption: 'Review your games, wins and draws',
            icon: HistoryArt,
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
    <ThemeProvider fixedLayout={{ width, height: 900 }}>
      <GameMenuScreen
        screenId="game-home"
        title="Connect Four"
        motif="discs"
        subtitle="Drop discs and line up four"
        choices={[
          {
            key: 'game-session',
            title: 'Play with friends or bots',
            caption: 'Choose who plays',
            icon: FriendsArt,
            dataSet: { testid: 'choice-play' },
            onClick: onPlay,
          },
          {
            key: 'history',
            title: 'History and stats',
            icon: HistoryArt,
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
    expect(play.closest('ul')).toBe(view.getByRole('list'));
    expect(play.textContent).toContain('Play with friends or bots');
    expect(play.textContent).not.toContain('Choose who plays');
    fireEvent.click(play);
    expect(onPlay).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  // regression: game-menu-history-weighs-as-play — wide, "History and stats"
  // was a tile as large as the ways to play, so looking back weighed the
  // same as starting a game. It follows the primary action as a supporting row.
  test('wide: history follows play as a supporting row', () => {
    const view = menu(1440, () => undefined);
    const history = view.getByTestId('choice-history');
    const play = view.getByTestId('choice-play');
    expect(history.closest('ul')).toBe(play.closest('ul'));
    expect(history.getAttribute('data-emphasis')).toBe('quiet');
    expect(history.getAttribute('data-component')).toBe('GameMenuChoice');
    view.unmount();
  });

  // regression: game-menu-history-row-styled-apart — wide, "History and
  // stats" was a transparent outlined row under two raised cards, with a
  // narrower inner edge, so it looked like a different kind of control.
  // It is a card of the rows' kind, their surface, edge and inner start
  // edge, only shorter.
  test("wide: the look back is a shorter card of the rows' own kind", () => {
    const view = threeChoices(1440);
    const history = view.getByTestId('choice-history');
    expect(history.className).toBe(view.getByTestId('choice-find').className);
    expect(history).toHaveAttribute('data-emphasis', 'quiet');
    const tile = body('.tile');
    expect(tile).toContain('background: var(--ui-color-surface);');
    expect(tile).toContain('solid var(--ui-color-border);');
    expect(tile).toContain('border-radius: var(--ui-radius-control);');
    expect(tile).toContain('padding: var(--ui-space-3) var(--ui-space-6);');
    expect(tile).toContain('min-height: 64px;');
    expect(body('.tile[data-emphasis="primary"]')).toContain(
      'min-height: 72px;'
    );
    view.unmount();
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
    const view = threeChoices(1440);
    const play = view.getByTestId('choice-play');
    expect(play).toHaveAttribute('data-emphasis', 'primary');
    expect(play.className).toBe(view.getByTestId('choice-find').className);
    const tile = body('.tile');
    expect(tile).toContain('width: 100%;');
    expect(tile).toContain('color: var(--ui-color-text);');
    expect(tile).toContain('background: var(--ui-color-surface);');
    const primary = body('.tile[data-emphasis="primary"]');
    expect(primary).not.toContain('background:');
    expect(primary).toContain('border-color: var(--ui-color-tint);');
    expect(body('.tile[data-emphasis="primary"] .chevron')).toContain(
      'background: var(--ui-color-tint-active);'
    );
    view.unmount();
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
      expect(view.getByTestId('choice-history')).toHaveAttribute(
        'data-emphasis',
        'quiet'
      );
      for (const id of ['choice-play', 'choice-find', 'choice-history']) {
        const artwork = view.getByTestId(id).firstElementChild;
        expect(artwork?.tagName).toBe('IMG');
        expect(artwork).toHaveAttribute('width', '48');
        expect(artwork).toHaveAttribute('alt', '');
      }
      view.unmount();
    }
  });

  // regression: game-menu-uneven-hierarchy — wide, two large tiles sat over
  // one slim full-width "History and stats" row, an uneven block.
  // regression: game-menu-lead-tall-empty — the lead then spanned the other
  // tile and the look back, 180px tall with its words floating in its
  // middle. The primary control is as tall as its words; the other way to
  // play and the look back each keep a full row.
  // regression: game-menu-history-orphaned — a lone half-width history row broke alignment.
  // regression: game-menu-history-floats-at-hero — history belongs after the play rows.
  test.each([390, 1440])(
    'at %ipx every choice is a sibling in its original order',
    (width) => {
      const view = threeChoices(width);
      const list = view.getByRole('list');
      expect(Array.from(list.children, (row) => row.textContent)).toEqual([
        'Play with friends',
        'Find an opponent',
        'History and stats',
      ]);
      expect(view.queryByRole('button', { name: 'More' })).toBeNull();
      view.unmount();
    }
  );

  test('a single play option is still the primary action', () => {
    const view = render(() => (
      <ThemeProvider fixedLayout={{ width: 390, height: 900 }}>
        <GameMenuScreen
          screenId="game-home"
          title="Numberlink"
          motif="paths"
          choices={[
            {
              key: 'library',
              title: 'Puzzles and packs',
              icon: FriendsArt,
              dataSet: { testid: 'choice-library' },
              onClick: () => undefined,
            },
          ]}
        />
      </ThemeProvider>
    ));
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
