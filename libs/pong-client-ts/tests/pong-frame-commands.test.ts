import { expect, test } from 'bun:test';
import { pongFrame } from '@libs/pong-client-ts/pong-frame';
import { pongConfig } from '@libs/pong-shared-ts/pong-config';
import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import { initialPongState } from '@libs/pong-shared-ts/pong-state';

// regression: frame-commands-one-size — Pong, played in real time, showed
// the turn games' "Offer draw" beside Resign. Each game declares whether
// its frame offers a draw; Pong does not.
test('Pong offers no draw by agreement among its commands', () => {
  expect(pongFrame.drawOffers).toBe(false);
});

// regression: pong-score-shown-twice — on a phone the score showed twice,
// large in the court's halves and again as "Points" on each player's strip.
// The court alone shows the points; the strips name the players.
test("Pong's seats show no figure: the court shows each side's points", () => {
  const position = pongPositionCodec.encode(
    initialPongState(pongConfig(), () => 0)
  );
  expect(pongFrame.seats.stat(position, 'white')).toBeNull();
  expect(pongFrame.seats.stat(position, 'black')).toBeNull();
});
