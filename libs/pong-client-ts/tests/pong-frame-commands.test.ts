import { expect, test } from 'bun:test';
import { pongFrame } from '@libs/pong-client-ts/pong-frame';

// regression: frame-commands-one-size — Pong, played in real time, showed
// the turn games' "Offer draw" beside Resign. Each game declares whether
// its frame offers a draw; Pong does not.
test('Pong offers no draw by agreement among its commands', () => {
  expect(pongFrame.drawOffers).toBe(false);
});
