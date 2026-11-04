import { expect, test } from 'bun:test';
import { connectFourPresentation } from '@libs/connect-four-client-ts/connect-four-presentation';

// regression: connect-four-seat-swatch-mismatch
test("each seat is painted with its own disc's paint, so the legend matches the board", () => {
  const look = connectFourPresentation.frame.seats.look;
  expect(look('white')).toEqual({ color: 'disc-one', mark: '●' });
  expect(look('black')).toEqual({ color: 'disc-two', mark: '◆' });
});
