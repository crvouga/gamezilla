/**
 * A deployed Synthetic Population Worker, as far as the scenario needs one
 * beside the Synthetic Users it runs itself: it heartbeats (which keeps the
 * Synthetic Population as large as desired) and, once asked to, claims
 * Synthetic Users whose day has begun and holds them online, letting go of
 * each once its renewal says its day is over or it is above the desired
 * synthetic population.
 */
import { GAME_AUTOMATIONS } from '@libs/game-catalog-shared-ts/game-automations';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { reconcileCheckpoint } from '@libs/synthetic-population-shared-ts/config';
import { fixtureWorkerRpc } from './fixture-worker-rpc';

const BEAT_MS = 5_000;

type Lease = { userId: string; workerId: string; generation: number };
type Worker = {
  readonly id: string;
  claiming: boolean;
  readonly held: Map<string, Lease>;
  /** Held Synthetic Users in an ongoing game: they finish it before leaving. */
  readonly playing: Set<string>;
  /** Synthetic Users whose devices have no connection: claims pass them over. */
  readonly unreachable: Set<string>;
};
const workers = new WeakMap<ProductHarness, Worker>();

function games(): string[] {
  return GAME_AUTOMATIONS.map((game) => game.rules.id);
}

/** One heartbeat of the deployed worker (or one of its replicas), now, through the worker control plane. */
export async function deployedWorkerHeartbeat(
  s: ProductHarness,
  workerId = workerOf(s).id
) {
  const rpc = await fixtureWorkerRpc(s);
  const response = await rpc.heartbeat.$post({
    json: {
      workerId,
      version: 'spec',
      capacity: 1,
      draining: false,
      memoryBytes: 1000,
      cpuMilliseconds: 0,
      leaseFailures: 0,
      games: games(),
    },
  });
  if (!response.ok)
    throw new Error(`The worker heartbeat was refused (${response.status})`);
}

/**
 * Claim every Synthetic User the Synthetic Population lets the deployment
 * hold now: each on a replica of its own, as many replicas as it takes.
 */
export async function claimSyntheticUsers(s: ProductHarness, most = 32) {
  const worker = workerOf(s);
  const rpc = await fixtureWorkerRpc(s);
  for (let claimed = 0; claimed < most; claimed += 1) {
    const replica = s.session.ports.createId();
    await deployedWorkerHeartbeat(s, replica);
    const response = await rpc.claim.$post({
      json: {
        workerId: replica,
        games: games(),
        unreachable: [...worker.unreachable],
      },
    });
    const { assignment } = await response.json();
    if (assignment === null) return;
    const { userId, workerId, generation } = assignment.lease;
    worker.held.set(userId, { userId, workerId, generation });
  }
}

/** The deployed worker lets go of every Synthetic User it holds: each closes its app. */
export async function releaseHeldSyntheticUsers(s: ProductHarness) {
  const worker = workerOf(s);
  const rpc = await fixtureWorkerRpc(s);
  for (const [userId, lease] of worker.held) {
    await rpc.release.$post({ json: lease });
    worker.held.delete(userId);
  }
}

async function beat(s: ProductHarness, worker: Worker) {
  await deployedWorkerHeartbeat(s);
  const rpc = await fixtureWorkerRpc(s);
  for (const [userId, lease] of worker.held) {
    await deployedWorkerHeartbeat(s, lease.workerId);
    const response = await rpc.renew.$post({ json: lease });
    if (response.status !== 200) {
      worker.held.delete(userId);
      continue;
    }
    const { renewal } = await response.json();
    if (!renewal.draining || worker.playing.has(userId)) continue;
    // Nothing to finish: the Synthetic User closes the app and is let go.
    await rpc.release.$post({ json: lease });
    worker.held.delete(userId);
  }
  if (worker.claiming) await claimSyntheticUsers(s);
}
function workerOf(s: ProductHarness): Worker {
  const known = workers.get(s);
  if (known !== undefined) return known;
  const worker: Worker = {
    id: s.session.ports.createId(),
    claiming: false,
    held: new Map(),
    playing: new Set(),
    unreachable: new Set(),
  };
  workers.set(s, worker);
  const timers = s.harness.server.timers;
  let beating = false;
  const interval = timers.setInterval(() => {
    if (beating) return;
    beating = true;
    void beat(s, worker)
      .catch(() => undefined)
      .finally(() => {
        beating = false;
      });
  }, BEAT_MS);
  const dispose = s.runtime.disposeResources.bind(s.runtime);
  s.runtime.disposeResources = async () => {
    timers.clearInterval(interval);
    await dispose();
  };
  return worker;
}

/** The deployed worker runs from now on; `claiming`, it also brings Synthetic Users online. */
export function runDeployedWorker(s: ProductHarness, claiming: boolean): void {
  workerOf(s).claiming ||= claiming;
}

/** Report a held Synthetic User's activity, as its worker checkpoints it. */
async function report(
  s: ProductHarness,
  lease: Lease,
  activity: 'playing' | 'browsing'
) {
  const rpc = await fixtureWorkerRpc(s);
  await rpc.checkpoint.$post({
    json: {
      ...lease,
      checkpoint: {
        ...reconcileCheckpoint(null, s.harness.clock.now(), lease.userId),
        activity,
      },
      version: 'spec',
      action: null,
      error: null,
    },
  });
}

/** A held Synthetic User starts a game, or its game reaches its result. */
export async function setHeldPlaying(
  s: ProductHarness,
  userId: string,
  playing: boolean
): Promise<void> {
  const worker = workerOf(s);
  const lease = worker.held.get(userId);
  if (lease === undefined)
    throw new Error('That Synthetic User is not online now');
  if (playing) worker.playing.add(userId);
  else worker.playing.delete(userId);
  await report(s, lease, playing ? 'playing' : 'browsing');
}

/** Whether the deployed worker holds the Synthetic User in an ongoing game. */
export function heldPlaying(s: ProductHarness, userId: string): boolean {
  return workerOf(s).playing.has(userId);
}

/** The Synthetic User's device loses its connection, or has it again. */
export function setDeviceConnected(
  s: ProductHarness,
  userId: string,
  connected: boolean
): void {
  if (connected) workerOf(s).unreachable.delete(userId);
  else workerOf(s).unreachable.add(userId);
}
