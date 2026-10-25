// @io-wall-ok — bounded benchmark entry; wall time measures execution, virtual time drives gameplay.
import { join } from 'node:path';

import { withSimulationBots } from '@libs/game-session-shared-ts/simulation-bots';
import { FixedStepSimulation } from '@libs/game-session-shared-ts/simulation-engine';
import { LIGHT_CYCLES_QUAD_SIMULATION } from '@libs/light-cycles-harness-ts/light-cycles-quad';
import {
  LIGHT_CYCLES_PROFILE_WORKLOAD,
  lightCyclesRoomProfile,
  primeLightCyclesProfile,
  readLightCyclesRoomProfile,
  sampleLightCyclesRoom,
} from '@libs/light-cycles-harness-ts/light-cycles-room-profile';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import { writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import { processLifecycle } from '@pkgs/os-server-ts/process-lifecycle';

const processPorts = processLifecycle();
const simulation = LIGHT_CYCLES_QUAD_SIMULATION;
const WINDOW_MS = 10_000;

/** A Quad arena two seconds into riding, with every rider a hard bot. */
function botArena() {
  const step = withSimulationBots(
    simulation.step,
    (['white', 'black', 'red', 'blue'] as const).map((side) => ({
      playerId: side,
      input: (
        state: unknown,
        context: Parameters<NonNullable<typeof simulation.bots>['input']>[3]
      ) => simulation.bots!.input(state, side, 'hard', context),
    })),
    simulation.parseInput
  );
  const engine = new FixedStepSimulation(
    simulation.initialize('profile-bots'),
    step,
    { ...simulation.timing, seed: 'profile-bots' }
  );
  for (let tick = 0; tick < simulation.timing.tickRate * 5; tick++)
    engine.advanceTicks(1);
  return engine;
}

function botTicks() {
  const engine = botArena();
  const opening = engine.snapshot();
  return () => {
    if (simulation.result(engine.snapshot().state) !== null)
      engine.restore(opening);
    engine.advanceTicks(1);
  };
}

function codecRoundTrip() {
  const state = botArena().snapshot().state;
  return () => {
    const encoded = simulation.codec.encode(state);
    if (simulation.codec.decode(encoded) === null)
      throw new Error('Profile arena did not round-trip');
  };
}

function measure(
  name: string,
  operation: () => void,
  operationsPerBatch: number
) {
  const batch = () => {
    for (let i = 0; i < operationsPerBatch; i++) operation();
  };
  for (let i = 0; i < 20; i++) batch();
  Bun.gc(true);
  const samples: number[] = [];
  for (let i = 0; i < 200; i++) {
    const start = Bun.nanoseconds();
    batch();
    samples.push((Bun.nanoseconds() - start) / operationsPerBatch / 1000);
  }
  samples.sort((a, b) => a - b);
  const percentile = (fraction: number) =>
    Number(samples[Math.ceil(samples.length * fraction) - 1]!.toFixed(3));
  return {
    name,
    samples: samples.length,
    operationsPerBatch,
    batchMeanOperationUs: {
      median: percentile(0.5),
      p95: percentile(0.95),
      p99: percentile(0.99),
    },
  };
}

async function profileRoom(spectators: number) {
  await using run = await lightCyclesRoomProfile.run({
    seed: 7331,
    args: { spectators },
  });
  await run.apply(primeLightCyclesProfile);
  const cpu = processPorts.resources().cpuMilliseconds;
  const start = Bun.nanoseconds();
  await run.apply(sampleLightCyclesRoom, WINDOW_MS);
  const elapsedMs = (Bun.nanoseconds() - start) / 1_000_000;
  const cpuMs = processPorts.resources().cpuMilliseconds - cpu;
  const sample = await run.read(readLightCyclesRoomProfile);
  if (sample === null || sample.phase === null)
    throw new Error('Profile produced no valid room sample');
  if (sample.phase === 'completed')
    throw new Error('Profile ended before its measurement window completed');
  return {
    ...sample,
    integratedWallMs: Number(elapsedMs.toFixed(3)),
    integratedProcessCpuMs: cpuMs,
    integratedWallMsPerVirtualSecond: Number(
      (elapsedMs / (sample.virtualMs / 1000)).toFixed(3)
    ),
  };
}

const report = {
  format: 'light-cycles-profile.v1',
  runtime: `bun ${Bun.version}`,
  platform: process.platform,
  architecture: process.arch,
  timing:
    'elapsed wall time; percentiles of per-operation means in batches, not individual-tick tail latency',
  roomScope:
    'in-process real room server, clients, session and authority on virtual time, ordered links and JSON wire accounting; excludes sockets, TLS, remote storage and rendering',
  workload: {
    ...LIGHT_CYCLES_PROFILE_WORKLOAD,
    windowMs: WINDOW_MS,
    seed: 7331,
  },
  arenaBytes: simulation.codec.encode(botArena().snapshot().state).length,
  simulation: [
    measure(
      'fixed-step Quad tick + four hard bots + result check',
      botTicks(),
      16
    ),
    measure('Quad arena encode + decode', codecRoundTrip(), 16),
  ],
  rooms: [] as Awaited<ReturnType<typeof profileRoom>>[],
};
for (const spectators of [0, 2, 20])
  report.rooms.push(await profileRoom(spectators));
const encoded = `${JSON.stringify(report, null, 2)}\n`;
const output = createNodeFsObjectStore({
  rootDir: join(import.meta.dirname, '..', '.cache', 'performance'),
  fs: wallNodeFs(),
  layout: 'tree',
});
await writeUtf8(
  output,
  'light-cycles-profile.json',
  encoded,
  'application/json'
);
processPorts.writeOutput(encoded);
