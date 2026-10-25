import type { ForgeryKind } from '@libs/light-cycles-harness-ts/light-cycles-network-forgery';
import {
  LIGHT_CYCLES_NETWORK_ACTIONS,
  lightCyclesNetworkSystem,
  readLightCyclesNetwork,
  readLightCyclesTimeline,
} from '@libs/light-cycles-harness-ts/light-cycles-network-system';
import type { LightCyclesPeerId } from '@libs/light-cycles-harness-ts/light-cycles-network-world';
import {
  RECORDING_VERSION,
  type Recording,
  type Step,
  stringifyRecording,
} from '@pkgs/harness-root-shared-ts/recording';
import fc from 'fast-check';

const SEATS = ['white', 'black', 'red', 'blue'] as const;
const PEERS: readonly LightCyclesPeerId[] = [
  'alice',
  'bob',
  'carol',
  'dave',
  'erin',
];
const FORGERIES: readonly ForgeryKind[] = [
  'spectator',
  'other-seat',
  'intruder',
  'unauthenticated',
  'stale-round',
  'stale-basis',
  'future-basis',
  'stale-epoch',
  'retry',
];

const step = (action: string, ...args: unknown[]): Step => ({ action, args });
const peer = fc.constantFrom(...PEERS);

/** One scenario step over the system's actions; every argument is JSON. */
export const lightCyclesStep: fc.Arbitrary<Step> = fc.oneof(
  {
    weight: 5,
    arbitrary: fc
      .tuple(
        fc.constantFrom(...SEATS),
        fc.constantFrom('valid', 'reversed', 'burst')
      )
      .map(([seat, style]) => step('steerRider', seat, style)),
  },
  {
    weight: 3,
    arbitrary: fc
      .constantFrom(...FORGERIES)
      .map((kind) => step('forgeCommand', kind)),
  },
  {
    weight: 3,
    arbitrary: fc
      .integer({ min: 100, max: 4000 })
      .map((ms) => step('advanceArena', ms)),
  },
  { weight: 2, arbitrary: peer.map((id) => step('dropConnection', id)) },
  { weight: 1, arbitrary: peer.map((id) => step('restoreConnection', id)) },
  { weight: 1, arbitrary: peer.map((id) => step('replaceConnection', id)) },
  {
    weight: 1,
    arbitrary: fc
      .tuple(
        peer,
        fc.integer({ min: 0, max: 150 }),
        fc.integer({ min: 0, max: 60 })
      )
      .map(([id, latency, jitter]) => step('impairLink', id, latency, jitter)),
  },
  {
    weight: 1,
    arbitrary: fc
      .tuple(peer, fc.constantFrom(300, 1200))
      .map(([id, ms]) => step('holdSnapshots', id, ms)),
  },
  {
    weight: 1,
    arbitrary: fc
      .constantFrom(150, 400, 1000)
      .map((ms) => step('stallAuthority', ms)),
  },
  { weight: 1, arbitrary: fc.constant(step('joinLateSpectator')) }
);

/** The recording a failure replays from: seed, then every step, then settling. */
export function lightCyclesRecording(
  seed: number,
  steps: readonly Step[]
): Recording {
  return {
    version: RECORDING_VERSION,
    seed,
    args: null,
    steps: [...steps, step('settleArena')],
    meta: { system: lightCyclesNetworkSystem.name, runtime: 'virtual' },
  };
}

/**
 * Replays a recording through the system, whose properties check every
 * checkpoint. A failure carries the recording, so it replays exactly with
 * `lightCyclesNetworkSystem.replay(recording)`.
 */
export async function verifyLightCyclesRecording(
  recording: Recording
): Promise<void> {
  const report = await lightCyclesNetworkSystem.replay(recording);
  const failure = report.failures[0];
  if (failure !== undefined)
    throw new Error(
      `${failure.error}\nreplay: ${stringifyRecording(failure.repro)}`
    );
}

/** Applies a recording by hand to read what it observed. */
export async function observeLightCyclesRecording(recording: Recording) {
  const actions = new Map(
    LIGHT_CYCLES_NETWORK_ACTIONS.map((action) => [action.name, action])
  );
  await using run = await lightCyclesNetworkSystem.run({
    seed: recording.seed,
  });
  for (const item of recording.steps)
    await run.apply(
      actions.get(item.action) as never,
      ...(item.args as never[])
    );
  return {
    outcome: await run.read(readLightCyclesNetwork),
    timeline: await run.read(readLightCyclesTimeline),
  };
}
