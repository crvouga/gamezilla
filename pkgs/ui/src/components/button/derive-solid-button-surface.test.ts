import { describe, expect, test } from 'bun:test';

import { deriveSolidButtonSurface } from './derive-solid-button-surface';

describe('deriveSolidButtonSurface', () => {
  test('accent top is lighter than bottom', () => {
    const surface = deriveSolidButtonSurface(
      'hsla(221, 83%, 45%, 1)',
      'accent'
    );
    expect(surface.gradientTop).not.toBe(surface.gradientBottom);
    expect(surface.boxShadow).toContain('inset');
    expect(surface.boxShadow).toContain('-0.1rem');
    expect(surface.backgroundColor).toBe(surface.gradientTop);
  });

  test('neutral omits dark bottom rim', () => {
    const surface = deriveSolidButtonSurface('hsla(0, 0%, 98%, 1)', 'neutral');
    expect(surface.boxShadow).toContain('inset 0 0.1rem');
    expect(surface.boxShadow).not.toContain('inset 0 -0.1rem');
  });

  test('unparseable source stays flat', () => {
    const surface = deriveSolidButtonSurface('not-a-color', 'accent');
    expect(surface.gradientTop).toBe('not-a-color');
    expect(surface.gradientBottom).toBe('not-a-color');
    expect(surface.backgroundColor).toBe('not-a-color');
  });
});
