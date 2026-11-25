import { expect, test } from 'bun:test';
import {
  pongFrame,
  pongHeldLine,
  pongSharedLine,
} from '@libs/pong-client-ts/pong-frame';
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

// regression: pong-reconnecting-instructions — while reconnecting, the
// stage's line told the player to drag or use the arrow keys though the
// court said "Reconnecting…" and the paddle could not move. While play is
// held up the line says what is happening and when play goes on; the
// instructions return once input is back.
test("Pong's line says why play is held up, and the instructions return after", () => {
  const position = pongPositionCodec.encode(
    initialPongState(pongConfig(), () => 0)
  );
  const controls = {
    paused: false,
    stale: false,
    sides: ['white'] as const,
    onInput: () => {},
    onRelease: () => {},
  };
  expect(pongHeldLine(position, { ...controls, stale: true })).toBe(
    'Reconnecting. Your paddle moves again when the game returns.'
  );
  expect(pongHeldLine(position, { ...controls, paused: true })).toBe(
    'Paused while a player returns.'
  );
  expect(pongHeldLine(position, controls)).toBeNull();
  expect(pongHeldLine(position, undefined)).toBeNull();
});

// regression: pong-shared-device-says-your-paddle — one device playing both
// paddles was told to move "your paddle". Its line names each player's own
// paddle, with each one's keys on a wide screen.
test("Pong's line on a shared device speaks to each player", () => {
  const position = pongPositionCodec.encode(
    initialPongState(pongConfig(), () => 0)
  );
  const shared = {
    paused: false,
    stale: false,
    sides: ['white', 'black'] as const,
    onInput: () => {},
    onRelease: () => {},
  };
  expect(pongSharedLine(position, shared, true)).toBe(
    'Each player moves their own paddle: W and S the left, the arrow keys the right.'
  );
  expect(pongSharedLine(position, shared, false)).toBe(
    'Each player drags their own paddle up and down.'
  );
  expect(
    pongSharedLine(position, { ...shared, sides: ['white'] as const }, true)
  ).toBeNull();
  expect(pongHeldLine(position, { ...shared, stale: true })).toBe(
    'Reconnecting. The paddles move again when the game returns.'
  );
});
