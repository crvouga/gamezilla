/** @jsxImportSource solid-js */
/**
 * Nested ThemeProviders must isolate schemes: only the outermost mirrors
 * `data-theme` onto `<html>`; inner hosts + Solid context stay independent.
 * Tailwind `--color-*` aliases must re-bind on each `[data-theme]` host.
 */

import { describe, expect, test } from 'bun:test';
import { renderTokensCss, ThemeProvider, useTheme } from '@pkgs/ui';
import { render } from '@solidjs/testing-library';
import { createSignal, type JSX, Show } from 'solid-js';

const FIXED = { width: 320, height: 480 } as const;

function SchemeProbe(props: { readonly id: string }): JSX.Element {
  const theme = useTheme();
  return (
    <span
      data-testid={props.id}
      data-scheme={theme.colorScheme()}
      data-bg={theme.palette().background}
    />
  );
}

describe('nested ThemeProvider', () => {
  test('tokens.css rebinds Tailwind --color-* on every scheme host', () => {
    const css = renderTokensCss();
    expect(css).toContain('[data-theme="light"] {\n  --ui-color-background:');
    expect(css).toContain('[data-theme="dark"] {\n  --ui-color-background:');
    for (const scheme of ['light', 'dark'] as const) {
      const start = css.indexOf(`[data-theme="${scheme}"]`);
      const end =
        scheme === 'light'
          ? css.indexOf('[data-theme="dark"]', start + 1)
          : css.length;
      const block = css.slice(start, end);
      expect(block).toContain('--color-surface: var(--ui-color-surface);');
      expect(block).toContain('--color-text: var(--ui-color-text);');
      expect(block).toContain('--color-elevation-1: var(--ui-elevation-1);');
    }
  });

  test('independent transparent roots leave the document theme under its owner', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const { unmount } = render(() => (
      <ThemeProvider
        colorScheme="light"
        fixedLayout={FIXED}
        manageDocumentTheme={false}
        transparent
      >
        <SchemeProbe id="support" />
      </ThemeProvider>
    ));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    const host = document.querySelector('[data-component="ThemeProvider"]');
    expect(host?.classList.contains('bg-transparent')).toBe(true);
    expect(host?.classList.contains('bg-none')).toBe(true);
    expect(
      document
        .querySelector('[data-testid="support"]')
        ?.getAttribute('data-scheme')
    ).toBe('light');
    unmount();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    document.documentElement.removeAttribute('data-theme');
  });

  test('outer mirrors document; inner keeps its own host + JS scheme', () => {
    document.documentElement.removeAttribute('data-theme');

    const { unmount } = render(() => (
      <ThemeProvider colorScheme="dark" fixedLayout={FIXED}>
        <ThemeProvider colorScheme="light" fixedLayout={FIXED}>
          <SchemeProbe id="inner" />
        </ThemeProvider>
        <SchemeProbe id="outer" />
      </ThemeProvider>
    ));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    const hosts = document.querySelectorAll('[data-component="ThemeProvider"]');
    expect(hosts).toHaveLength(2);
    expect(hosts[0]?.getAttribute('data-theme')).toBe('dark');
    expect(hosts[1]?.getAttribute('data-theme')).toBe('light');

    const inner = document.querySelector('[data-testid="inner"]');
    const outer = document.querySelector('[data-testid="outer"]');
    expect(inner?.getAttribute('data-scheme')).toBe('light');
    expect(outer?.getAttribute('data-scheme')).toBe('dark');
    expect(inner?.getAttribute('data-bg')).not.toBe(
      outer?.getAttribute('data-bg')
    );

    unmount();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  test('nested dark host redefines --color-surface for Tailwind utilities', () => {
    document.documentElement.removeAttribute('data-theme');
    const style = document.createElement('style');
    style.textContent = renderTokensCss();
    document.head.appendChild(style);

    const { unmount } = render(() => (
      <ThemeProvider colorScheme="light" fixedLayout={FIXED}>
        <ThemeProvider colorScheme="dark" fixedLayout={FIXED}>
          <div data-testid="probe" class="bg-surface" />
        </ThemeProvider>
      </ThemeProvider>
    ));

    const hosts = document.querySelectorAll('[data-component="ThemeProvider"]');
    const outer = hosts[0] as HTMLElement;
    const inner = hosts[1] as HTMLElement;
    const outerUi = getComputedStyle(outer)
      .getPropertyValue('--ui-color-surface')
      .trim();
    const innerUi = getComputedStyle(inner)
      .getPropertyValue('--ui-color-surface')
      .trim();
    // Computed style resolves `var(--ui-color-surface)` to the host's HSL.
    const outerColor = getComputedStyle(outer)
      .getPropertyValue('--color-surface')
      .trim();
    const innerColor = getComputedStyle(inner)
      .getPropertyValue('--color-surface')
      .trim();

    expect(outerUi.length).toBeGreaterThan(0);
    expect(innerUi.length).toBeGreaterThan(0);
    expect(outerUi).not.toBe(innerUi);
    expect(outerColor).toBe(outerUi);
    expect(innerColor).toBe(innerUi);

    unmount();
    style.remove();
    document.documentElement.removeAttribute('data-theme');
  });

  test('unmounting a nested provider does not change document theme', () => {
    document.documentElement.removeAttribute('data-theme');
    const [showInner, setShowInner] = createSignal(true);

    const { unmount } = render(() => (
      <ThemeProvider colorScheme="dark" fixedLayout={FIXED}>
        <Show when={showInner()}>
          <ThemeProvider colorScheme="light" fixedLayout={FIXED}>
            <SchemeProbe id="inner" />
          </ThemeProvider>
        </Show>
      </ThemeProvider>
    ));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.querySelector('[data-testid="inner"]')).not.toBeNull();

    setShowInner(false);
    expect(document.querySelector('[data-testid="inner"]')).toBeNull();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    unmount();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  test('root restore leaves a pre-existing document theme intact', () => {
    document.documentElement.setAttribute('data-theme', 'light');

    const { unmount } = render(() => (
      <ThemeProvider colorScheme="dark" fixedLayout={FIXED}>
        <span data-testid="root-child" />
      </ThemeProvider>
    ));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    unmount();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    document.documentElement.removeAttribute('data-theme');
  });
});
