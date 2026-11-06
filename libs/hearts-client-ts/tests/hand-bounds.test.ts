import { expect, test } from 'bun:test';
import {
  assertHeartsHandBounds,
  assertHeartsPassingBounds,
  assertHeartsSeatRow,
} from '@libs/hearts-client-ts/hearts-hand-bounds.checks';

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

// regression: hearts-initial-deal-action-outside-viewport
test('390x844 initial passing checks the action and table as well as all 13 cards', () => {
  const cards = Array.from({ length: 13 }, (_, index) => ({
    left: 20 + (index % 7) * 50,
    right: 66 + (index % 7) * 50,
    top: 650 + Math.floor(index / 7) * 76,
    bottom: 714 + Math.floor(index / 7) * 76,
    width: 46,
    height: 64,
  }));
  const context = {
    left: 16,
    right: 374,
    top: 165,
    bottom: 600,
    width: 358,
    height: 435,
  };
  const action = {
    left: 270,
    right: 374,
    top: 820,
    bottom: 864,
    width: 104,
    height: 44,
  };
  const phone = { width: 390, height: 844 };
  expect(() => assertHeartsHandBounds(cards, phone)).not.toThrow();
  expect(() =>
    assertHeartsPassingBounds(cards, context, action, phone)
  ).toThrow('outside');
  const visibleAction = { ...action, top: 800, bottom: 844 };
  expect(() =>
    assertHeartsPassingBounds(cards, context, visibleAction, phone)
  ).not.toThrow();
  expect(() =>
    assertHeartsPassingBounds(cards.slice(1), context, visibleAction, phone)
  ).toThrow('13-card');
});

// regression: hearts-phone-trick-seat-mismatch
test('a phone trick card belongs beside its player, not a separate compass', () => {
  const seat = {
    left: 24,
    right: 192,
    top: 174,
    bottom: 294,
    width: 168,
    height: 120,
  };
  const compass = {
    left: 175,
    right: 215,
    top: 325,
    bottom: 381,
    width: 40,
    height: 56,
  };
  expect(() => assertHeartsSeatRow(seat, compass)).toThrow('named player');
  expect(() =>
    assertHeartsSeatRow(seat, {
      ...compass,
      left: 200,
      right: 240,
      top: 180,
      bottom: 236,
    })
  ).not.toThrow();
});
