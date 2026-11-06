import { expect, test } from 'bun:test';
import { assertHeartsHandBounds } from '@libs/hearts-client-ts/hearts-hand-bounds.checks';

// regression: hearts-phone-hand-below-viewport
test('the 390x844 hand cannot put its lower row below the viewport', () => {
  const lowerCard = {
    left: 146,
    top: 801,
    right: 192,
    bottom: 865,
    width: 46,
    height: 64,
  };
  expect(() =>
    assertHeartsHandBounds([lowerCard], { width: 390, height: 844 })
  ).toThrow('outside');
  const hand = Array.from({ length: 13 }, (_, index) => ({
    left: 20 + (index % 7) * 50,
    right: 66 + (index % 7) * 50,
    top: 650 + Math.floor(index / 7) * 76,
    bottom: 714 + Math.floor(index / 7) * 76,
    width: 46,
    height: 64,
  }));
  expect(() =>
    assertHeartsHandBounds(hand, { width: 390, height: 844 })
  ).not.toThrow();
});
