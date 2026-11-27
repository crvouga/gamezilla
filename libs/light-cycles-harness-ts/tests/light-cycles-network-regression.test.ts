import { expect, test } from 'bun:test';
import {
  lightCyclesRecording,
  observeLightCyclesRecording,
  verifyLightCyclesRecording,
} from './light-cycles-network-checks';

test('the Quad arena converges after Carol reconnects and Alice receives delayed snapshots', async () => {
  // regression: light-cycles-quad-trail-validation-timeout
  // First recording in the 200-case Nightly sweep (fast-check seed 424242).
  await verifyLightCyclesRecording(
    lightCyclesRecording(12, [
      { action: 'forgeCommand', args: ['stale-basis'] },
      { action: 'steerRider', args: ['white', 'valid'] },
      { action: 'forgeCommand', args: ['spectator'] },
      { action: 'steerRider', args: ['red', 'reversed'] },
      { action: 'steerRider', args: ['black', 'burst'] },
      { action: 'forgeCommand', args: ['stale-round'] },
      { action: 'steerRider', args: ['black', 'reversed'] },
      { action: 'advanceArena', args: [1942] },
      { action: 'replaceConnection', args: ['carol'] },
      { action: 'steerRider', args: ['red', 'burst'] },
      { action: 'impairLink', args: ['alice', 58, 22] },
      { action: 'holdSnapshots', args: ['alice', 1200] },
      { action: 'forgeCommand', args: ['stale-round'] },
      { action: 'forgeCommand', args: ['future-basis'] },
      { action: 'advanceArena', args: [895] },
      { action: 'impairLink', args: ['dave', 93, 10] },
    ])
  );
});

test('seed 1: Ember, whose person is away, sits out the second round from its first tick', async () => {
  // regression: simulation-retirement-away-seat-rides-at-round-start
  await verifyLightCyclesRecording(
    lightCyclesRecording(1, [
      { action: 'dropConnection', args: ['bob'] },
      { action: 'advanceArena', args: [500] },
      { action: 'stallAuthority', args: [400] },
      { action: 'advanceArena', args: [3500] },
    ])
  );
});

test('the scenario that found it: three riders away across a stalled authority and held snapshots', async () => {
  // regression: simulation-retirement-away-seat-rides-at-round-start
  await verifyLightCyclesRecording(
    lightCyclesRecording(1, [
      { action: 'steerRider', args: ['red', 'burst'] },
      { action: 'joinLateSpectator', args: [] },
      { action: 'dropConnection', args: ['bob'] },
      { action: 'advanceArena', args: [2193] },
      { action: 'dropConnection', args: ['dave'] },
      { action: 'impairLink', args: ['dave', 1, 44] },
      { action: 'forgeCommand', args: ['stale-basis'] },
      { action: 'stallAuthority', args: [1000] },
      { action: 'dropConnection', args: ['carol'] },
      { action: 'holdSnapshots', args: ['erin', 1200] },
      { action: 'joinLateSpectator', args: [] },
      { action: 'forgeCommand', args: ['future-basis'] },
      { action: 'steerRider', args: ['black', 'burst'] },
      { action: 'stallAuthority', args: [400] },
      { action: 'advanceArena', args: [2116] },
      { action: 'holdSnapshots', args: ['dave', 300] },
      { action: 'steerRider', args: ['blue', 'burst'] },
      { action: 'advanceArena', args: [452] },
    ])
  );
});

test('the five devices converge when the win arrives during reconnection', async () => {
  // regression: light-cycles-completed-arena-reported-stale
  // Fast-check seed 714418046, case 159, after shrinking.
  const { outcome } = await observeLightCyclesRecording(
    lightCyclesRecording(1, [
      { action: 'advanceArena', args: [3518] },
      { action: 'dropConnection', args: ['bob'] },
      { action: 'dropConnection', args: ['alice'] },
      { action: 'dropConnection', args: ['carol'] },
      { action: 'advanceArena', args: [3708] },
      { action: 'restoreConnection', args: ['erin'] },
      { action: 'advanceArena', args: [2991] },
      { action: 'impairLink', args: ['alice', 0, 0] },
      { action: 'forgeCommand', args: ['spectator'] },
      { action: 'holdSnapshots', args: ['alice', 300] },
      { action: 'advanceArena', args: [3595] },
      { action: 'restoreConnection', args: ['alice'] },
      { action: 'forgeCommand', args: ['spectator'] },
      { action: 'dropConnection', args: ['alice'] },
      { action: 'advanceArena', args: [2322] },
      { action: 'forgeCommand', args: ['spectator'] },
    ])
  );
  expect(outcome).toMatchObject({
    tick: 522,
    result: 'blue wins by target score',
    scores: [0, 0, 0, 3],
    convergence: [],
  });
});
