/** @jsxImportSource solid-js */
/** Puzzle boards read figure over ground, and lists keep their card's corners. */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PathGridBoard } from '@pkgs/ui-root-client-ts/path-grid-board';
import { TileBoard } from '@pkgs/ui-root-client-ts/tile-board';
import { contrastRatio, parseColor } from '@pkgs/ui-root-shared-ts/contrast';
import { renderUi } from './render';

const UI_SRC = join(import.meta.dirname, '../../ui-root-client-ts/src');
const TOKENS = join(
  import.meta.dirname,
  '../../ui-root-shared-ts/src/design-tokens.json'
);

/** The body of the first rule whose selector is exactly `selector`. */
function rule(file: string, selector: string): string {
  const css = readFileSync(join(UI_SRC, file), 'utf8');
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no rule ${selector}`);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
}

/** A declaration's value in a rule body. */
function declared(body: string, property: string): string {
  const match = new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+);`).exec(body);
  if (match?.[1] === undefined) throw new Error(`no ${property}`);
  return match[1].trim();
}

/** A Sokoban board colour, by its token name (the same in both schemes). */
function sokoban(name: string): string {
  const tokens = JSON.parse(readFileSync(TOKENS, 'utf8')) as {
    color: Record<string, Record<string, { $value: { hex: string } }>>;
  };
  const light = tokens.color['light']?.[name]?.$value.hex;
  const dark = tokens.color['dark']?.[name]?.$value.hex;
  if (light === undefined || light !== dark) throw new Error(name);
  return light;
}

function contrast(a: string, b: string): number {
  const front = parseColor(a);
  const back = parseColor(b);
  if (front === null || back === null) throw new Error(`${a} ${b}`);
  return contrastRatio(front, back);
}

/** `var(--tile-board-wall)` → the Sokoban token the board names for it. */
function boardColor(variable: string): string {
  const css = readFileSync(
    join(UI_SRC, 'tile-board/tile-board.module.css'),
    'utf8'
  );
  const token = declared(css, variable.replace(/^var\((.+)\)$/, '$1'));
  const name = /--ui-color-game-(sokoban-[a-z]+)/.exec(token)?.[1];
  if (name === undefined) throw new Error(token);
  const camel = name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return sokoban(`game${camel[0]?.toUpperCase()}${camel.slice(1)}`);
}

describe('Sokoban board', () => {
  // regression: sokoban-pieces-tiny-walls-dominate — the worker, crates and
  // goals were 12px glyphs in 50–76px tiles, and the walls were pale tiles
  // with cream grout over a dark floor, so the walls led and the pieces
  // read last. Walls are now dark solid blocks on a light floor, and each
  // piece is an outlined token most of its tile wide.
  test('walls are dark, the floor light, and pieces fill most of a tile', () => {
    const view = renderUi(() => (
      <TileBoard
        label="Board"
        testId="board"
        columns={2}
        rows={1}
        tiles={[
          { terrain: 'open', marked: false, label: 'A1: floor' },
          { terrain: 'solid', marked: false, label: 'B1: wall' },
        ]}
        pieces={[
          { id: 'walker', column: 0, row: 0, glyph: '☻', tone: 'actor' },
        ]}
      />
    ));
    const piece = view.container.querySelector('[data-piece="walker"]');
    expect(piece?.children).toHaveLength(1);
    expect(piece?.textContent).toBe('☻');
    const css = 'tile-board/tile-board.module.css';
    const token = rule(css, '.token');
    expect(Number.parseFloat(declared(token, 'width'))).toBeGreaterThanOrEqual(
      60
    );
    const wall = boardColor(
      declared(rule(css, '.tile[data-terrain="solid"]'), 'background')
    );
    const floor = boardColor(
      declared(rule(css, '.tile[data-terrain="open"]'), 'background')
    );
    const outline = boardColor('var(--tile-board-outline)');
    // The floor is the light ground the dark walls and outlines stand on.
    expect(contrast(floor, wall)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(outline, floor)).toBeGreaterThanOrEqual(4.5);
  });

  test("the builder's board draws its pieces as the player does", () => {
    const css = 'cell-grid-board/cell-grid-board.module.css';
    const glyph = rule(
      css,
      '.board[data-board-theme="sokoban"] .cell[data-identity] .glyph'
    );
    expect(Number.parseFloat(declared(glyph, 'width'))).toBeGreaterThanOrEqual(
      60
    );
    expect(
      declared(
        rule(
          css,
          '.board[data-board-theme="sokoban"] .cell[data-tone="occupied"]'
        ),
        'background'
      )
    ).toBe('var(--ui-color-game-sokoban-canvas)');
  });
});

describe('Sokoban walls', () => {
  // regression: sokoban-wall-grout-strips — each wall tile drew a lit top
  // edge (an inset shadow in the board's surface tone) and a surface
  // border, so a run of walls showed lighter horizontal strips that read as
  // a rendering glitch. No wall draws a lit edge or any stripe inside it.
  //
  // regression: sokoban-wall-bricks-off-grid — walls were running-bond
  // brickwork, two courses to a tile with the upper course's joint at half
  // a tile, so the bricks' joints fell between the builder's column labels
  // and the floor's grid lines and the walls looked offset by half a
  // square. Each wall is now one block to its square: a dark fill, its
  // mortar an even border on the square's own four edges.
  const walls = [
    ['tile-board/tile-board.module.css', '.tile[data-terrain="solid"]'],
    [
      'cell-grid-board/cell-grid-board.module.css',
      '.board[data-board-theme="sokoban"] .cell[data-tone="occupied"]',
    ],
  ] as const;
  test.each(walls)(
    '%s draws each wall as one block, its joints on the grid',
    (file, selector) => {
      const wall = rule(file, selector);
      expect(wall).not.toContain('box-shadow');
      expect(wall).not.toContain('background-image');
      expect(wall).not.toContain('background-position');
      // One even border on all four edges: the mortar is the square's outline.
      expect(wall).not.toMatch(/border-(?:top|right|bottom|left|block|inline)/);
      expect(declared(wall, 'border')).toMatch(
        /^max\(1px, calc\(2cqw \/ var\(--[a-z-]+-columns\)\)\) solid\s+var\(--[a-z-]+\)$/
      );
      expect(declared(wall, 'border')).not.toContain('transparent');
    }
  );
});

describe('path board', () => {
  // regression: numberlink-path-seams — the cells' grid lines painted over
  // the paths, so every path showed a seam at each cell border. The paths
  // now paint above the grid and the endpoints above the paths.
  test('paths paint over the grid lines, endpoints over the paths', () => {
    const css = 'path-grid-board/path-grid-board.module.css';
    const lines = Number(declared(rule(css, '.lines'), 'z-index'));
    const endpoint = Number(declared(rule(css, '.endpoint'), 'z-index'));
    expect(lines).toBeGreaterThan(0);
    expect(endpoint).toBeGreaterThan(lines);
    expect(declared(rule(css, '.endpoint'), 'position')).toBe('relative');
  });

  /** A 5 × 5 board with a "4" path begun over two squares. */
  function begun(): HTMLElement {
    const view = renderUi(() => (
      <PathGridBoard
        columns={5}
        rows={5}
        label="Numberlink board"
        testId="path"
        endpoints={[
          { cell: 10, label: '4', tone: 'green', connected: false },
          { cell: 16, label: '4', tone: 'green', connected: false },
        ]}
        lines={[
          { id: 'four', tone: 'green', cells: [10, 11], connected: false },
        ]}
        cellLabel={(index) => `Square ${index}`}
      />
    ));
    return view.getByRole('group', { name: 'Numberlink board' });
  }

  // regression: numberlink-open-path-capsules — a path still being drawn
  // was dashed, so the "4" path begun over two squares broke into two
  // separate capsules that read as a rendering fault. Every path, open or
  // joined, is one continuous stroke between its squares' centres.
  test('a path still open is one continuous stroke between its squares', () => {
    const css = readFileSync(
      join(UI_SRC, 'path-grid-board/path-grid-board.module.css'),
      'utf8'
    );
    expect(css).not.toContain('stroke-dasharray');
    const board = begun();
    const lines = board.querySelectorAll('[data-path="four"]');
    expect(lines.length).toBe(1);
    expect(lines[0]?.getAttribute('points')).toBe('50,250 150,250');
    expect(
      declared(
        rule('path-grid-board/path-grid-board.module.css', '.line'),
        'stroke-linecap'
      )
    ).toBe('round');
  });

  // regression: numberlink-light-board-cream — in the light theme the
  // board turned a cream sheet with a mustard "3", unlike every other
  // game's board. Like Sokoban's, it keeps one palette in both themes.
  test('the board keeps its night palette in the light theme', () => {
    expect(begun().getAttribute('data-theme')).toBe('dark');
  });
});

describe('panels', () => {
  // regression: panel-focus-ring-square-corners — a focused first row drew
  // a square ring across its card's rounded corners. The first and last
  // rows take the card's inner corners, so the ring follows them.
  test("a panel's end rows round their corners with the card", () => {
    const first = rule('hosts.css', '  .panelItem:first-child > .clickable');
    const last = rule('hosts.css', '  .panelItem:last-child > .clickable');
    expect(declared(first, 'border-start-start-radius')).toBe(
      'calc(var(--ui-radius-card) - 1px)'
    );
    expect(declared(last, 'border-end-end-radius')).toBe(
      'calc(var(--ui-radius-card) - 1px)'
    );
  });
});
