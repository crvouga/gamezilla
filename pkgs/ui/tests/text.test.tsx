/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { screen } from '@solidjs/testing-library';
import { renderUi } from './support/render';

describe('text host class', () => {
  test('applies variant typography classes', () => {
    renderUi(() => (
      <h3 class="text textHeading" data-testid="t">
        {'Hi'}
      </h3>
    ));
    const el = screen.getByTestId('t');
    expect(el.className).toMatch(/textHeading/);
    expect(el).toHaveTextContent('Hi');
  });

  test('utility color classes compose with the text host', () => {
    renderUi(() => (
      <p class="text text-destructive" data-testid="t">
        {'Err'}
      </p>
    ));
    expect(screen.getByTestId('t').className).toMatch(/text-destructive/);
  });

  test('line-clamp utility works on the host', () => {
    renderUi(() => (
      <p class="text line-clamp-2" data-testid="t">
        {'long'}
      </p>
    ));
    const el = screen.getByTestId('t');
    expect(el.tagName).toBe('P');
    expect(el.className).toMatch(/line-clamp-2/);
  });
});
