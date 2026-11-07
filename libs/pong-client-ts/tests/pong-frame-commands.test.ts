import { expect, test } from 'bun:test';
import { pongFrame } from '@libs/pong-client-ts/pong-frame';
import { pongConfig } from '@libs/pong-shared-ts/pong-config';
import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import { initialPongState } from '@libs/pong-shared-ts/pong-state';
import { createPongStep } from '@libs/pong-shared-ts/pong-step';

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

// regression: pong-panel-repeats-hint — beside the court the players' panel
// said "Keep the ball in play.", repeating what the hint under the court
// already says about playing. While play simply goes on, Pong has no line
// of its own; the serve and the result still have one.
test('Pong has no turn line while play simply goes on', () => {
  const serving = initialPongState(pongConfig(), () => 0);
  expect(
    pongFrame.turnStatus(
      pongPositionCodec.encode(serving),
      null,
      [],
      () => null
    )
  ).toBeNull();
  const config = pongConfig();
  const step = createPongStep(config);
  const context = {
    tick: 1,
    deltaMs: 1000 / config.tickRate,
    elapsedMs: 1000 / config.tickRate,
    random: () => 0.5,
  };
  const playing = step({ ...serving, countdown: 1 }, [], context);
  expect(playing.phase).toBe('playing');
  expect(
    pongFrame.turnStatus(
      pongPositionCodec.encode(playing),
      null,
      [],
      () => null
    )
  ).toBeNull();
});
