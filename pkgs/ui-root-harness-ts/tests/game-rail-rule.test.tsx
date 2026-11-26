/** @jsxImportSource solid-js */

import { afterEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { GameLayout } from '@pkgs/ui-root-client-ts/game-screen';
import { cleanup } from '@solidjs/testing-library';
import { renderUi } from './render';

const UI_SRC = join(import.meta.dirname, '../../ui-root-client-ts/src');
const css = (): string =>
  readFileSync(join(UI_SRC, 'game-ui.module.css'), 'utf8');
const wide = (): string => {
  const text = css();
  return text.slice(text.indexOf('@container game-column (min-width: 880px)'));
};

const realRect = HTMLElement.prototype.getBoundingClientRect;
afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = realRect;
  cleanup();
});

// regression: game-rail-widths-differ — beside a wide board the rail was
// 395px for Chess and Connect Four, 444px for Battleship and 300px beside
// Pong and Light Cycles, so no two games' panels matched. Every game's rail
// is now one width at the column's end, an arena's too; the board's column
// takes the rest.
test('every game keeps one rail width beside its board, an arena too', () => {
  const text = css();
  const widths = [...text.matchAll(/--game-rail-measure:\s*([^;]+);/g)].map(
    (match) => match[1]
  );
  expect(widths).toEqual(['392px']);
  expect(text).not.toContain('--game-arena-rail-measure');
  const arena = wide().slice(
    wide().indexOf(
      '.layout[data-arena="true"][data-has-stage="true"][data-has-aside="true"] {'
    )
  );
  expect(arena.slice(0, arena.indexOf('}'))).not.toContain(
    'grid-template-columns'
  );
});

// regression: game-rail-above-board — beside a wide board the record card's
// top stood level with the seat above the board, not with the board, so the
// board and its card shared no line (Battleship's record started 70px
// above its grid). The stage measures how far its board sits below the
// seat and the rail's first card starts that far down.
test("the rail beside a wide board starts level with the board's top", async () => {
  HTMLElement.prototype.getBoundingClientRect = function rect(
    this: HTMLElement
  ) {
    // The board's wrapper sits 64px below the stage's top (the seat above).
    const wrapsBoard =
      this.firstElementChild?.getAttribute('data-testid') === 'board';
    const top = wrapsBoard ? 64 : 0;
    return new DOMRect(0, top, 100, 100);
  };
  renderUi(
    () => (
      <GameLayout aside={<div>Record</div>}>
        <GameBoardStage others={<div>Them</div>} own={<div>Me</div>}>
          <div data-testid="board" />
        </GameBoardStage>
      </GameLayout>
    ),
    { width: 1440, height: 900 }
  );
  await Promise.resolve();
  const layout = document.querySelector<HTMLElement>(
    '[data-component="GameLayout"]'
  );
  expect(layout?.style.getPropertyValue('--game-board-lead')).toBe('64px');
  const at = wide().indexOf('margin-block-start: var(--game-board-lead, 0px);');
  expect(at).toBeGreaterThan(-1);
  const rule = wide().slice(wide().lastIndexOf('}', at), at);
  expect(rule).toContain('> .rail');
  expect(rule).toContain('> .controls');
  expect(rule).toContain('> .setup');
});
