import { expect, test } from 'bun:test';
import { heartsFrame } from '@libs/hearts-client-ts/hearts-frame';

// regression: frame-commands-one-size — Hearts showed "Offer draw" beside
// Resign; its table plays every hand out, so its frame offers no draw.
test('Hearts offers no draw by agreement among its commands', () => {
  expect(heartsFrame.drawOffers).toBe(false);
});
