import { test } from 'bun:test';
import {
  lightCyclesRecording,
  verifyLightCyclesRecording,
} from './light-cycles-network-checks';

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
