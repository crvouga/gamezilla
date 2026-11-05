/** @jsxImportSource solid-js */

import { expect, test } from 'bun:test';
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
