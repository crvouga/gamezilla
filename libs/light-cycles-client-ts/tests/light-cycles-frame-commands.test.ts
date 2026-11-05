import { expect, test } from 'bun:test';
import { lightCyclesFrame } from '@libs/light-cycles-client-ts/light-cycles-frame';

// regression: frame-commands-one-size — a Light Cycles race showed the turn
// games' "Offer draw" beside Resign; a race is drawn only by its rounds.
test('Light Cycles offers no draw by agreement at any table size', () => {
  for (const riders of [2, 3, 4] as const)
    expect(lightCyclesFrame(riders).drawOffers).toBe(false);
});

// regression: light-cycles-marker-unmatched — the person's marker beside
// their name was the generic player blue while their trail in the arena was
// cyan. Each rider's seat takes its trail's own paint, rider by rider.
test("each rider's seat is painted with its own trail's paint", () => {
  const frame = lightCyclesFrame(4);
  expect(
    (['white', 'black', 'red', 'blue'] as const).map(
      (side) => frame.seats.look(side).color
    )
  ).toEqual(['trail-one', 'trail-two', 'trail-three', 'trail-four']);
});
