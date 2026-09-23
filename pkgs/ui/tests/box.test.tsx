/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { screen } from '@solidjs/testing-library';
import { renderUi } from './support/render';

describe('box host class', () => {
  test('applies layout utility classes', () => {
    renderUi(() => <div class="box p-2 bg-surface" data-testid="box" />);
    const el = screen.getByTestId('box');
    expect(el.tagName).toBe('DIV');
    expect(el.className).toMatch(/p-2/);
    expect(el.className).toMatch(/bg-surface/);
  });

  test('semantic elements keep their tag', () => {
    renderUi(() => <nav class="box" data-testid="nav" />);
    expect(screen.getByTestId('nav').tagName).toBe('NAV');
  });
});

describe('stack layout classes', () => {
  test('horizontal gap and alignment via utilities', () => {
    renderUi(() => (
      <div class="box flex-row gap-3 items-center" data-testid="stack">
        <p class="text">{'a'}</p>
        <p class="text">{'b'}</p>
      </div>
    ));
    const el = screen.getByTestId('stack');
    expect(el.className).toMatch(/flex-row/);
    expect(el.className).toMatch(/gap-3/);
    expect(el.className).toMatch(/items-center/);
  });
});
