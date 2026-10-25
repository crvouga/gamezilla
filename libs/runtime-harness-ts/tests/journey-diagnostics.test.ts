import { expect, test } from 'bun:test';
import { battleshipFleetsSeenBeyondShots } from '@libs/runtime-harness-ts/battleship-journey';
import { acceptBlack } from '@libs/runtime-harness-ts/custom-game-journey';
import { journeyDiagnosticDriver } from './journey-diagnostic-driver';

// regression: native-journey-failures-omit-public-context
test('journey diagnostics report Battleship counts without exposing fleet cells', async () => {
  const { ui } = journeyDiagnosticDriver({
    html: '<button data-testid="multiplayer-board-own-c3" data-tone="occupied" aria-label="C3: your carrier">■</button><div data-private="fleet:carrier@c3h"></div>',
    visible: ['multiplayer-board'],
    captions: { 'multiplayer-board-own-grid': 'Your fleet' },
    texts: { 'multiplayer-board-status': 'You sank the whole fleet. You win.' },
  });
  const failure = await battleshipFleetsSeenBeyondShots({
    act: async (_name, action) => action(ui),
    actAsGuest: async () => {
      throw new Error('A missing own fleet cannot be compared');
    },
  }).catch(String);
  const message = String(failure);
  expect(message).toContain('"boardPresent":true');
  expect(message).toContain('"snapshotPresent":true');
  expect(message).toContain('"ownCells":1');
  expect(message).toContain('"ownShips":1');
  expect(message).toContain('"ownShipCells":1');
  expect(message).toContain('"caption":"Your fleet"');
  expect(message).toContain('You sank the whole fleet. You win.');
  expect(message).not.toContain('c3');
  expect(message).not.toContain('C3');
  expect(message).not.toContain('carrier');
  expect(message).not.toContain('data-private');
});

test('journey diagnostics distinguish an unavailable snapshot from an absent fleet', async () => {
  const { ui } = journeyDiagnosticDriver({
    html: null,
    visible: ['multiplayer-board'],
    captions: {},
    texts: {},
  });
  const message = String(
    await battleshipFleetsSeenBeyondShots({
      act: async (_name, action) => action(ui),
      actAsGuest: async () => {},
    }).catch(String)
  );
  expect(message).toContain('"boardPresent":true');
  expect(message).toContain('"snapshotPresent":false');
  expect(message).toContain('"ownCells":0');
});

// regression: native-journey-failures-omit-public-context
test('journey diagnostics keep the failed readiness control and public refusal', async () => {
  const { ui, taps } = journeyDiagnosticDriver({
    html: null,
    visible: ['custom-game-black-invitation'],
    refusedVisible: 'custom-game-black-release',
    captions: {},
    texts: {
      'custom-game-error': 'The choice could not be confirmed. Try again.',
      'custom-game-status': 'Waiting for participants and readiness.',
    },
  });
  const message = String(await acceptBlack(ui).catch(String));
  expect(message).toContain('custom-game-black-release expect.visible');
  expect(message).toContain('Timed out after 20000ms waiting for visible');
  expect(message).toContain('The choice could not be confirmed. Try again.');
  expect(message).toContain('"role":"invited to black"');
  expect(message).toContain('"connectionNeeded":false');
  expect(message).toContain('Waiting for participants and readiness.');
  // A choice that did not take is chosen again, a bounded number of times.
  expect(taps).toEqual([
    'custom-game-black-accept',
    'custom-game-black-accept',
    'custom-game-black-accept',
  ]);
});
