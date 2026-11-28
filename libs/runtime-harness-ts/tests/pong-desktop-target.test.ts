import { expect, test } from 'bun:test';
import { guidePongJourney } from '@libs/runtime-harness-ts/pong-journey-court';
import type {
  Driver,
  TapPosition,
} from '@pkgs/ui-testing-root-shared-ts/driver';
import { journeyDiagnosticDriver } from './journey-diagnostic-driver';

// regression: pong-wide-journey-awaits-hidden-slider
test('on a wide Pong court the assigned player follows the ball without a phone slider', async () => {
  const board = 'multiplayer-board';
  const status = `${board}-status`;
  const base = journeyDiagnosticDriver({
    html: null,
    visible: [status, board],
    texts: {},
    captions: {},
  }).ui;
  const touches: TapPosition[] = [];
  const ui: Driver = {
    ...base,
    get: (id) => ({
      ...base.get(id),
      attribute: async (name) =>
        id === status && name === 'data-stage'
          ? 'rally'
          : id === `${board}-ball` && name === 'data-ball-y'
            ? '90'
            : null,
      tapAt: async (point) => {
        expect(id).toBe(board);
        touches.push(point);
      },
    }),
  };
  expect(await guidePongJourney(ui, 'white', true, 360)).toBe(false);
  expect(await guidePongJourney(ui, 'black', false, 360)).toBe(false);
  expect(touches).toEqual([
    { xRatio: 0.25, yRatio: 0.25 },
    { xRatio: 0.75, yRatio: 0.999 },
  ]);
});
