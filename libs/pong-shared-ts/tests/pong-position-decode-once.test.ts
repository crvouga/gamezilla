import { expect, test } from 'bun:test';
import { pongConfig } from '@libs/pong-shared-ts/pong-config';
import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import { initialPongState } from '@libs/pong-shared-ts/pong-state';

// regression: pong-position-decoded-per-reader — every tick the court, the
// frame's status and its standings each parsed and validated the same
// position again.
test('one position is decoded once for every reader of the same tick', () => {
  const start = initialPongState(pongConfig(), () => 0);
  const position = pongPositionCodec.encode(start);
  const first = pongPositionCodec.decode(position);
  expect(first).toEqual(start);
  expect(pongPositionCodec.decode(`${position}`)).toBe(first);
  const next = pongPositionCodec.encode({
    ...start,
    countdown: start.countdown - 1,
  });
  expect(pongPositionCodec.decode(next)).not.toBe(first);
  expect(pongPositionCodec.decode(next)?.countdown).toBe(start.countdown - 1);
  expect(pongPositionCodec.decode('pong:not-a-position')).toBeNull();
  expect(pongPositionCodec.decode(position)).toEqual(start);
});
