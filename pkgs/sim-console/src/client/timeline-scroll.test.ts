import { describe, expect, test } from 'bun:test';

import { scrollOffsetToReveal } from './timeline-scroll';

describe('scrollOffsetToReveal', () => {
  test('returns null when already fully visible', () => {
    expect(
      scrollOffsetToReveal({
        layout: { x: 40, width: 80 },
        viewportWidth: 200,
        scrollX: 0,
      })
    ).toBeNull();
  });

  test('scrolls left when the item is clipped on the left', () => {
    expect(
      scrollOffsetToReveal({
        layout: { x: 10, width: 50 },
        viewportWidth: 200,
        scrollX: 40,
      })
    ).toBe(2);
  });

  test('scrolls right when the item is clipped on the right', () => {
    expect(
      scrollOffsetToReveal({
        layout: { x: 160, width: 80 },
        viewportWidth: 200,
        scrollX: 0,
      })
    ).toBe(48);
  });

  test('returns null when layout or viewport is missing', () => {
    expect(
      scrollOffsetToReveal({
        layout: undefined,
        viewportWidth: 200,
        scrollX: 0,
      })
    ).toBeNull();
    expect(
      scrollOffsetToReveal({
        layout: { x: 0, width: 40 },
        viewportWidth: 0,
        scrollX: 0,
      })
    ).toBeNull();
  });
});
