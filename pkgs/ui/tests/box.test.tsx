/** @jsxImportSource solid-js */
import { Box, Stack, Text } from '@pkgs/ui';
import { screen } from '@solidjs/testing-library';
import { describe, expect, test } from 'vitest';
import { cssOf, renderUi } from './support/render';

describe('Box', () => {
  test('compiles sx to inline CSS with token variables', () => {
    renderUi(() => (
      <Box data-testid="box" sx={{ p: 2, background: 'surface' }} />
    ));
    const el = screen.getByTestId('box');
    expect(el.tagName).toBe('DIV');
    expect(cssOf(el)).toContain('padding:8px');
    expect(cssOf(el)).toContain('background-color:var(--ui-color-surface)');
    expect(el).toHaveAttribute('data-component', 'Box');
  });

  test('renders semantic elements via `as` and outer dataSet wins', () => {
    renderUi(() => (
      <Box as="nav" data-testid="nav" dataSet={{ component: 'Custom' }} />
    ));
    const el = screen.getByTestId('nav');
    expect(el.tagName).toBe('NAV');
    expect(el).toHaveAttribute('data-component', 'Custom');
  });
});

describe('Stack', () => {
  test('lays out horizontally with gap and alignment', () => {
    renderUi(() => (
      <Stack
        data-testid="stack"
        direction="horizontal"
        spacing={3}
        align="center"
      >
        <Text label="a" />
        <Text label="b" />
      </Stack>
    ));
    const style = cssOf(screen.getByTestId('stack'));
    expect(style).toContain('flex-direction:row');
    expect(style).toContain('gap:12px');
    expect(style).toContain('align-items:center');
    expect(screen.getByTestId('stack')).toHaveAttribute(
      'data-component',
      'Stack'
    );
  });
});
