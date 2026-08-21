import { describe, expect, test } from 'bun:test';
import { shouldUseMobileSheet } from './should-use-mobile-sheet';

describe('shouldUseMobileSheet', () => {
  test('uses sheet on mobile when host supports sheet presentation', () => {
    expect(
      shouldUseMobileSheet({
        presentation: undefined,
        breakpoint: 'mobile',
        supportsSheetPresentation: true,
      })
    ).toBe(true);
    expect(
      shouldUseMobileSheet({
        presentation: 'responsive',
        breakpoint: 'mobile',
        supportsSheetPresentation: undefined,
      })
    ).toBe(true);
  });

  test('forces modal when passthrough host disables sheet presentation', () => {
    expect(
      shouldUseMobileSheet({
        presentation: undefined,
        breakpoint: 'mobile',
        supportsSheetPresentation: false,
      })
    ).toBe(false);
  });

  test('forces modal when presentation is modal', () => {
    expect(
      shouldUseMobileSheet({
        presentation: 'modal',
        breakpoint: 'mobile',
        supportsSheetPresentation: true,
      })
    ).toBe(false);
  });

  test('uses modal on tablet and desktop', () => {
    expect(
      shouldUseMobileSheet({
        presentation: undefined,
        breakpoint: 'tablet',
        supportsSheetPresentation: true,
      })
    ).toBe(false);
    expect(
      shouldUseMobileSheet({
        presentation: undefined,
        breakpoint: 'desktop',
        supportsSheetPresentation: true,
      })
    ).toBe(false);
  });
});
