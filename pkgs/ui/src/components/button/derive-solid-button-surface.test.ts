import { describe, expect, test } from 'bun:test';
import { deriveSolidButtonSurface } from './derive-solid-button-surface';

describe('deriveSolidButtonSurface', () => {
  test('accent yields flat fill with no boxShadow', () => {
    const surface = deriveSolidButtonSurface(
      'hsla(210, 90%, 50%, 1)',
      'accent'
    );
    expect(surface.boxShadow).toBe('');
    expect(surface.backgroundColor.length).toBeGreaterThan(0);
  });

  test('neutral yields flat fill with no boxShadow', () => {
    const surface = deriveSolidButtonSurface('hsla(0, 0%, 98%, 1)', 'neutral');
    expect(surface.boxShadow).toBe('');
    expect(surface.backgroundColor.length).toBeGreaterThan(0);
  });

  test('unparseable input uses raw string as fill', () => {
    const surface = deriveSolidButtonSurface('not-a-color', 'accent');
    expect(surface.backgroundColor).toBe('not-a-color');
    expect(surface.boxShadow).toBe('');
  });
});
