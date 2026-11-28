import { expect, test } from 'bun:test';
import type { JourneyHost } from '@libs/runtime-harness-ts/journey-types';
import { observePongRematch } from '@libs/runtime-harness-ts/pong-rematch-journey';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { journeyDiagnosticDriver } from './journey-diagnostic-driver';

function wideCourt(
  side: 'white' | 'black',
  alreadyServing: boolean
): JourneyHost['act'] {
  let active = alreadyServing;
  const board = 'multiplayer-board';
  const status = `${board}-status`;
  const base = journeyDiagnosticDriver({
    html: null,
    visible: [board, status, 'multiplayer-seat-near'],
    captions: {},
    texts: {
      [status]: 'Serve in 2',
      [`${board}-score-left`]: 'Left 0',
      [`${board}-score-right`]: 'Right 0',
      [`${board}-target`]: 'First to 11',
    },
  }).ui;
  function attribute(id: string, name: string): string | null {
    const attributes: Record<string, Record<string, string>> = {
      [board]: { 'data-interactive': String(active) },
      'multiplayer-game': {
        'data-game-id': active ? 'new-match' : 'previous-match',
      },
      'multiplayer-seat-near': { 'data-side': side },
      [status]: { 'data-stage': active ? 'countdown' : 'finished' },
      [`${board}-drawing`]: { viewBox: '0 0 1200 800' },
    };
    return attributes[id]?.[name] ?? null;
  }
  const ui: Driver = {
    ...base,
    get: (id) => ({
      ...base.get(id),
      wait: async (condition) => {
        expect(id).toBe(status);
        expect(condition).toEqual({ text: 'Serve in', exact: false });
        active = true;
      },
      attribute: async (name) => attribute(id, name),
    }),
  };
  return (_name, gestures) => gestures(ui);
}

// regression: pong-wide-rematch-awaited-phone-slider
test('both wide courts reveal the same scoreless rematch with the assigned paddles swapped', async () => {
  await observePongRematch(
    { act: wideCourt('white', false), actAsGuest: wideCourt('black', true) },
    {
      gameId: 'previous-match',
      side: 'black',
      targetScore: 11,
      courtHeight: 800,
      score: { left: 0, right: 0 },
    }
  );
});
