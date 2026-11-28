import { expect, test } from 'bun:test';
import { guidePongJourney } from '@libs/runtime-harness-ts/pong-journey-court';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { journeyDiagnosticDriver } from './journey-diagnostic-driver';

// regression: pong-wide-journey-awaits-hidden-slider
// regression: pong-wide-court-releases-input-before-the-simulation-tick
test('wide-court arrows stay held while the paddle follows the ball, then release at its target', async () => {
  const board = 'multiplayer-board';
  const status = `${board}-status`;
  const base = journeyDiagnosticDriver({
    html: null,
    visible: [status, board],
    texts: {},
    captions: {},
  }).ui;
  const held = new Set<string>();
  let ballY = 90;
  const ui: Driver = {
    ...base,
    get: (id) => ({
      ...base.get(id),
      attribute: async (name) => {
        if (id === status && name === 'data-stage') return 'playing';
        if (id === `${board}-ball` && name === 'data-ball-y')
          return String(ballY);
        if (id.endsWith('-paddle') && name === 'y') return '150';
        if (id.endsWith('-paddle') && name === 'height') return '60';
        return null;
      },
      key: async (key, phase) => {
        expect(id).toBe(board);
        if (phase === 'keydown') held.add(key);
        if (phase === 'keyup') held.delete(key);
      },
    }),
  };
  expect(await guidePongJourney(ui, 'black', true, 360)).toBe(false);
  expect([...held]).toEqual(['arrowUp']);
  ballY = 270;
  await guidePongJourney(ui, 'black', true, 360);
  expect([...held]).toEqual(['arrowDown']);
  ballY = 180;
  await guidePongJourney(ui, 'black', true, 360);
  expect(held.size).toBe(0);
  await guidePongJourney(ui, 'white', false, 360);
  expect([...held]).toEqual(['arrowUp']);
});
