/** @jsxImportSource solid-js */
import { Box, Stack, Text } from '@pkgs/ui';
import { screen } from '@solidjs/testing-library';
import { describe, expect, test } from 'vitest';
import { renderUi } from './support/render';

describe('Box', () => {
  test('applies layout classes and data-component', () => {
    renderUi(() => <Box data-testid="box" class="p-2 bg-surface" />);
    const el = screen.getByTestId('box');
    expect(el.tagName).toBe('DIV');
    expect(el.className).toMatch(/p-2/);
    expect(el.className).toMatch(/bg-surface/);
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
    const el = screen.getByTestId('stack');
    expect(el.className).toMatch(/flex-row/);
    expect(el.className).toMatch(/gap-3/);
    expect(el.className).toMatch(/items-center/);
    expect(el).toHaveAttribute('data-component', 'Stack');
  });
});
