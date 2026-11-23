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
// The points show once: on each player's seat, the opponent's above the
// court and the person's own below it, never on the court itself.
test("Pong's points show once, on each seat", () => {
  const state = initialPongState(pongConfig(), () => 0);
  const position = pongPositionCodec.encode({
    ...state,
    score: { left: 2, right: 5 },
    feedback: { ...state.feedback, points: 7 },
  });
  expect(pongFrame.seats.stat(position, 'white')).toEqual({
    label: 'Points',
    value: '2',
  });
  expect(pongFrame.seats.stat(position, 'black')).toEqual({
    label: 'Points',
    value: '5',
  });
  // The court names nobody: the seats do.
  expect(pongFrame.boardNames).toBeUndefined();
});

// regression: realtime-stage-arena-moves — the points that win and how to
// play were a paragraph under the court, which moved what came after it.
// They are the stage's facts (`First to 11`) and its one line.
test("Pong's points to win beside its name, and how to play in the stage's one line", () => {
  const config = pongConfig();
  const serving = initialPongState(config, () => 0);
  const position = pongPositionCodec.encode(serving);
  expect(pongFrame.target?.(position)).toBe(`First to ${config.targetScore}`);
  expect(pongFrame.turnStatus(position, 'white', [], () => null)).toBe(
    'Drag or use the arrow keys to move your paddle.'
  );
  expect(pongFrame.turnStatus(position, null, [], () => null)).toBe(
    'Watching the rally.'
  );
  const step = createPongStep(config);
  const playing = step({ ...serving, countdown: 1 }, [], {
    tick: 1,
    deltaMs: 1000 / config.tickRate,
    elapsedMs: 1000 / config.tickRate,
    random: () => 0.5,
  });
  expect(playing.phase).toBe('playing');
  // The line is the same through serve and rally: it never rewords mid-play.
  expect(
    pongFrame.turnStatus(
      pongPositionCodec.encode(playing),
      'white',
      [],
      () => null
    )
  ).toBe('Drag or use the arrow keys to move your paddle.');
});
