/** @jsxImportSource @solidjs/web */
import { expect, test } from 'bun:test';
import { ThemeProvider, useTheme } from '@pkgs/ui-root-client-ts/theme-context';
import { COLOR_PALETTE } from '@pkgs/ui-root-shared-ts/color-palette';
import { renderTokensCss } from '@pkgs/ui-root-shared-ts/css-vars';
import { render } from '@solidjs/testing-library';

function Probe() {
  const theme = useTheme();
  return (
    <output>
      {theme.palette.background} {theme.layout().width}
    </output>
  );
}

test('overlays share the game palette and measure their own viewport', () => {
  const view = render(() => (
    <ThemeProvider fixedLayout={{ width: 1024, height: 768 }}>
      <Probe />
      <ThemeProvider transparent fixedLayout={{ width: 390, height: 844 }}>
        <Probe />
      </ThemeProvider>
    </ThemeProvider>
  ));
  expect(view.getByText(`${COLOR_PALETTE.background} 1024`)).toBeDefined();
  const overlay = view.getByText(
    `${COLOR_PALETTE.background} 390`
  ).parentElement;
  expect(overlay?.classList.contains('bg-transparent')).toBe(true);
  expect(overlay?.classList.contains('bg-none')).toBe(true);
});

test('the root supplies one dark appearance before providers mount', () => {
  const css = renderTokensCss();
  expect(css).toContain('color-scheme: dark;');
  expect(css).not.toMatch(/prefers-color-scheme|data-theme/);
});
