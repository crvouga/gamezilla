import { expect, test } from 'bun:test';
import { battleshipFrame } from '@libs/battleship-client-ts/battleship-frame';

// regression: frame-commands-one-size — Battleship has no draw (its
// glossary says so), yet its frame offered "Offer draw" beside Resign.
test('Battleship offers no draw by agreement among its commands', () => {
  expect(battleshipFrame.drawOffers).toBe(false);
});
