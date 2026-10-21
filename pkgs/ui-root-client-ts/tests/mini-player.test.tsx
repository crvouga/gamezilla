/** @jsxImportSource solid-js */
/**
 * The miniplayer dock owns its geometry per layout mode: flush and square on
 * compact, gapped and card-rounded on wide.
 */

import { afterEach, expect, test } from 'bun:test';
import {
  MiniPlayerBar,
  MiniPlayerDock,
} from '@pkgs/ui-root-client-ts/mini-player';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, render } from '@solidjs/testing-library';

afterEach(cleanup);

function mount(width: number): { dock: Element; bar: Element } {
  const { container } = render(() => (
    <ThemeProvider colorScheme="light" fixedLayout={{ width, height: 900 }}>
      <MiniPlayerDock>
        <MiniPlayerBar testId="bar">{'Live space'}</MiniPlayerBar>
      </MiniPlayerDock>
    </ThemeProvider>
  ));
  const dock = container.querySelector('[data-component="MiniPlayerDock"]');
  const bar = container.querySelector('[data-testid="bar"]');
  if (dock === null || bar === null) throw new Error('dock not rendered');
  return { dock, bar };
}

test('compact: the bar runs flush and square above the tab bar', () => {
  const { dock, bar } = mount(390);
  expect(dock.getAttribute('data-layout')).toBe('compact');
  expect(dock.classList.contains('pt-ui-sm')).toBe(false);
  expect(bar.classList.contains('rounded-none')).toBe(true);
  expect(bar.classList.contains('rounded-card')).toBe(false);
});

test('wide: the bar keeps a gap above it and the card radius', () => {
  const { dock, bar } = mount(1440);
  expect(dock.getAttribute('data-layout')).toBe('wide');
  expect(dock.classList.contains('pt-ui-sm')).toBe(true);
  expect(bar.classList.contains('rounded-card')).toBe(true);
});
