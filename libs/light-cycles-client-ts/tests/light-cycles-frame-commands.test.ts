import { expect, test } from 'bun:test';
import { lightCyclesFrame } from '@libs/light-cycles-client-ts/light-cycles-frame';

// regression: frame-commands-one-size — a Light Cycles race showed the turn
// games' "Offer draw" beside Resign; a race is drawn only by its rounds.
test('Light Cycles offers no draw by agreement at any table size', () => {
  for (const riders of [2, 3, 4] as const)
    expect(lightCyclesFrame(riders).drawOffers).toBe(false);
});
