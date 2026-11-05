/** @jsxImportSource solid-js */

import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditTree, formatFailure } from '@pkgs/a11y-shared-ts/audit';
import { fireEvent, screen } from '@solidjs/testing-library';
import CellGridPaletteExample from '../../ui-root-client-ts/src/cell-grid-palette/cell-grid-palette.example';
import { renderUi } from './render';

function tool(name: string): HTMLElement {
  return screen.getByRole('radio', { name });
}

test('the tools are one named group, each a swatch of its square over its name', () => {
  renderUi(() => <CellGridPaletteExample />, { width: 390, height: 844 });
  const group = screen.getByRole('radiogroup', { name: 'Tool' });
  const tools = group.querySelectorAll('[role="radio"]');
  expect(tools).toHaveLength(8);
  const crate = tool('Crate');
  // The swatch is the board's own cell, in the board's palette, hidden
  // from listeners: the tool's name is what they hear.
  const swatch = crate.querySelector('[aria-hidden="true"]');
  expect(swatch?.getAttribute('data-board-theme')).toBe('sokoban');
  const cell = swatch?.firstElementChild;
  expect(cell?.getAttribute('data-tone')).toBe('open');
  expect(cell?.getAttribute('data-identity')).toBe('one');
  expect(
    tool('Wall').querySelector('[data-tone]')?.getAttribute('data-tone')
  ).toBe('occupied');
  const failures = auditTree(document.body);
  expect(failures.map(formatFailure)).toEqual([]);
});

test('one tool is chosen at a time, and it is the one tab stop', () => {
  renderUi(() => <CellGridPaletteExample />, { width: 390, height: 844 });
  expect(tool('Wall').getAttribute('aria-checked')).toBe('true');
  expect(tool('Wall').tabIndex).toBe(0);
  expect(tool('Goal').tabIndex).toBe(-1);
  fireEvent.click(tool('Goal'));
  expect(tool('Goal').getAttribute('aria-checked')).toBe('true');
  expect(tool('Wall').getAttribute('aria-checked')).toBe('false');
  expect(tool('Goal').tabIndex).toBe(0);
  tool('Goal').focus();
  fireEvent.keyDown(tool('Goal'), { key: 'ArrowRight' });
  expect(tool('Outside').getAttribute('aria-checked')).toBe('true');
  expect(document.activeElement).toBe(tool('Outside'));
});

test('a disabled palette chooses nothing', () => {
  renderUi(() => <CellGridPaletteExample disabled />, {
    width: 390,
    height: 844,
  });
  fireEvent.click(tool('Crate'));
  expect(tool('Crate').getAttribute('aria-checked')).toBe('false');
  expect(
    screen
      .getByRole('radiogroup', { name: 'Tool' })
      .getAttribute('aria-disabled')
  ).toBe('true');
});

/** The body of the first rule whose selector is exactly `selector`. */
function paletteRule(selector: string): string {
  const css = readFileSync(
    join(
      import.meta.dirname,
      '../../ui-root-client-ts/src/cell-grid-palette/cell-grid-palette.module.css'
    ),
    'utf8'
  );
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no rule ${selector}`);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
}

// regression: sokoban-palette-phone-unlabelled-tools — on a phone the
// palette was one row of eight bare swatches, only the chosen tool named,
// so Erase, Lift crate and Outside were told apart by icon alone. Every
// tile now shows its name at every width.
test('every tool shows its name beside no other cue, at every width', () => {
  renderUi(() => <CellGridPaletteExample />, { width: 390, height: 844 });
  const group = screen.getByRole('radiogroup', { name: 'Tool' });
  const names = Array.from(
    group.querySelectorAll('[role="radio"]'),
    (radio) => {
      const name = radio.lastElementChild;
      expect(name?.getAttribute('aria-hidden')).toBeNull();
      return name?.textContent;
    }
  );
  expect(names).toEqual([
    'Wall',
    'Floor',
    'Goal',
    'Outside',
    'Worker',
    'Crate',
    'Lift crate',
    'Erase',
  ]);
  const name = paletteRule('.name');
  expect(name).not.toContain('clip-path');
  expect(name).not.toMatch(/position:\s*absolute/);
  expect(paletteRule('.track')).toContain('repeat(4, minmax(0, 1fr))');
});

// regression: sokoban-palette-ragged-baselines — wide, "Remove crate"
// wrapped to two lines and bare glyphs stretched their swatches, so the
// swatches and names sat at different heights from tile to tile. Names
// keep to one line under a top-aligned swatch, and a bare glyph is set
// small enough not to stretch its square.
test('tiles keep one height: names on one line under a top-aligned swatch', () => {
  const name = paletteRule('.name');
  expect(name).toMatch(/white-space:\s*nowrap/);
  expect(paletteRule('.tool')).toMatch(/justify-content:\s*flex-start/);
  const glyph = paletteRule(
    '.swatch[data-board-theme] [data-tone]:not([data-identity]) > .swatchGlyph'
  );
  expect(glyph).toMatch(/line-height:\s*1;/);
  expect(glyph).toMatch(/font-size:\s*var\(--ui-font-size-xs\)/);
});
