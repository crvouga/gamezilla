// @io-wall-ok — bounded benchmark entry; wall time measures execution, virtual time drives gameplay.
import { join } from 'node:path';

import { withSimulationBots } from '@libs/game-session-shared-ts/simulation-bots';
import { FixedStepSimulation } from '@libs/game-session-shared-ts/simulation-engine';
import {
  pongRoomProfile,
  primePongProfile,
  readPongRoomProfile,
  samplePongRoom,
} from '@libs/pong-harness-ts/pong-room-profile';
import { pongGameShared } from '@libs/pong-shared-ts/pong-game';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import { writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import { processLifecycle } from '@pkgs/os-server-ts/process-lifecycle';

const processPorts = processLifecycle();
const simulation = pongGameShared.registration.simulation!;

function botTicks() {
  const step = withSimulationBots(
    simulation.step,
    (['white', 'black'] as const).map((side) => ({
      playerId: side,
      input: (
        state: unknown,
        context: Parameters<NonNullable<typeof simulation.bots>['input']>[3]
      ) => simulation.bots!.input(state, side, 'medium', context),
    })),
    simulation.parseInput
  );
  const engine = new FixedStepSimulation(
    simulation.initialize('profile-bots'),
    step,
    { ...simulation.timing, seed: 'profile-bots' }
  );
  for (let tick = 0; tick < simulation.timing.tickRate * 3; tick++)
    engine.advanceTicks(1);
  const opening = engine.snapshot();
  return () => {
    if (simulation.result(engine.snapshot().state) !== null)
      engine.restore(opening);
    engine.advanceTicks(1);
  };
}

function mailboxBurst() {
  const engine = new FixedStepSimulation(
    simulation.initialize('profile-burst'),
    simulation.step,
    { ...simulation.timing, seed: 'profile-burst' }
  );
  for (let tick = 0; tick < simulation.timing.tickRate * 3; tick++)
    engine.advanceTicks(1);
  const opening = engine.snapshot();
  return () => {
    engine.restore(opening);
    for (let i = 0; i < simulation.timing.maxQueuedInputs; i++) {
      const accepted = engine.enqueue({
        playerId: i % 2 === 0 ? 'white' : 'black',
        tick: opening.tick + 1,
        sequence: i + 1,
        value: { kind: 'target', target: (i % 100) / 100 },
      });
      if (!accepted.accepted)
        throw new Error('Profile mailbox refused a bounded input');
    }
    engine.advanceTicks(1);
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
  await using run = await pongRoomProfile.run({
    seed: 7331,
    args: { spectators },
  });
  await run.apply(primePongProfile);
  const cpu = processPorts.resources().cpuMilliseconds;
  const start = Bun.nanoseconds();
  await run.apply(samplePongRoom, 10_000);
  const elapsedMs = (Bun.nanoseconds() - start) / 1_000_000;
  const cpuMs = processPorts.resources().cpuMilliseconds - cpu;
  const sample = await run.read(readPongRoomProfile);
  if (sample === null || sample.endingState === null)
    throw new Error('Profile produced no valid room sample');
  if (sample.endingState.winner !== null)
    throw new Error('Profile ended before its measurement window completed');
  const seconds = sample.virtualMs / 1000;
  return {
    spectators,
    peers: sample.peers,
    virtualMs: sample.virtualMs,
    integratedWallMs: Number(elapsedMs.toFixed(3)),
    integratedProcessCpuMs: cpuMs,
    publishedTickDelta: sample.publishedTickDelta,
    jsonBytesPerVirtualSecond: {
      uplink: Math.round(sample.traffic.uplink.bytes / seconds),
      downlink: Math.round(sample.traffic.downlink.bytes / seconds),
      snapshotsPerPeer: Math.round(
        sample.traffic.snapshots.bytes / seconds / sample.peers
      ),
    },
    snapshotFramesPerPeerPerVirtualSecond:
      sample.traffic.snapshots.frames / seconds / sample.peers,
    inputFramesPerPlayerPerVirtualSecond:
      sample.traffic.inputs.frames / seconds / 2,
    traffic: sample.traffic,
    durableEventsAdded: sample.durableEventsAdded,
    liveCheckpointBytes: sample.liveCheckpointBytes,
    score: sample.endingState.score,
    acknowledgments: sample.acknowledgments,
  };
}

const report = {
  format: 'pong-profile.v1',
  runtime: `bun ${Bun.version}`,
  platform: process.platform,
  architecture: process.arch,
  timing:
    'elapsed wall time; percentiles of per-operation means in batches, not individual-tick tail latency',
  roomScope:
    'in-process real sessions/rooms with seeded virtual delivery and JSON wire accounting; excludes sockets, TLS, remote storage and rendering',
  simulation: [
    measure(
      'fixed-step engine + two medium bots + result check',
      botTicks(),
      64
    ),
    measure(
      `restore + ${simulation.timing.maxQueuedInputs} enqueues + one engine tick`,
      mailboxBurst(),
      8
    ),
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
await writeUtf8(output, 'pong-profile.json', encoded, 'application/json');
processPorts.writeOutput(encoded);
