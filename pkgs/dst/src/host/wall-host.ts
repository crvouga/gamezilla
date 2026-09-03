// @io-wall-ok — wallHost composition root
import type { Clock } from '@pkgs/clock';
import { createSeededCreateId } from '@pkgs/uuid';
import { createRngInternal } from '../kernel/rng';
import { createTimers } from '../kernel/timers';
import { NOOP_TRACE_RECORDER } from '../kernel/trace';
import { createWallScheduler } from '../kernel/wall-scheduler';
import {
  createNetwork,
  type Network,
  type NetworkFaults,
  RELIABLE_NETWORK,
} from '../models/network';
import { defineHost } from './define-host';
import {
  type Capability,
  CapabilityError,
  type Endpoint,
  type Host,
  type Ports,
  type Session,
  type WallHostOptions,
} from './types';

function makeEndpoint(network: Network, id: string): Endpoint {
  return {
    id,
    send(to, payload) {
      network.send(id, to, payload);
    },
    listen(deliver) {
      network.register(id, deliver);
    },
    unlisten() {
      network.unregister(id);
    },
  };
}

function noopNetwork(): Network {
  const endpoints = new Map<string, (p: unknown) => void | Promise<void>>();
  return {
    register(id, deliver) {
      endpoints.set(id, deliver);
    },
    unregister(id) {
      endpoints.delete(id);
    },
    send() {},
    partition() {
      throw new CapabilityError('partition');
    },
    heal() {
      throw new CapabilityError('partition');
    },
    healAll() {
      throw new CapabilityError('partition');
    },
    isPartitioned: () => false,
    hold() {},
    release() {},
    releaseAll() {},
    isHeld: () => false,
    held: () => [],
    faults: () => RELIABLE_NETWORK,
    setFaults() {},
    clearFaults() {},
    inFlight: () => 0,
    partitions: () => [],
  };
}

function wrapNetworkCaps(
  network: Network,
  caps: ReadonlySet<Capability>
): Network {
  const guard = () => {
    if (!caps.has('partition')) throw new CapabilityError('partition');
  };
  return {
    ...network,
    partition(a, b) {
      guard();
      network.partition(a, b);
    },
    heal(a, b) {
      guard();
      network.heal(a, b);
    },
    healAll() {
      guard();
      network.healAll();
    },
  };
}

type RngInternal = ReturnType<typeof createRngInternal>;

export function wallHost(opts: WallHostOptions): Host<Ports> {
  const caps = new Set<Capability>(
    opts.network === 'model' ? ['partition'] : []
  );
  const faults: NetworkFaults = opts.networkFaults ?? RELIABLE_NETWORK;

  return defineHost({
    caps,
    async open(seed) {
      const rootRng = createRngInternal(seed);
      const scheduler = createWallScheduler(
        opts.settleMs !== undefined ? { settleMs: opts.settleMs } : undefined
      );
      const timers = createTimers(scheduler.underlying);
      const network =
        opts.network === 'model'
          ? wrapNetworkCaps(
              createNetwork({
                scheduler: scheduler.underlying,
                rng: rootRng._seeded.fork('net'),
                faults,
              }),
              caps
            )
          : noopNetwork();

      let disposed = false;
      const forks = new Map<string, Session<Ports>>();

      const makeSession = (name: string, rng: RngInternal): Session<Ports> => {
        const ports: Ports = {
          clock: scheduler.clock as Clock,
          timers,
          rng,
          createId: createSeededCreateId(rng._seeded.fork('ids').random),
          random: rng._seeded.fork('io').random,
          network: makeEndpoint(network, name),
        };
        const session: Session<Ports> = {
          ports,
          scheduler,
          network,
          trace: NOOP_TRACE_RECORDER,
          caps,
          fork(childName) {
            const existing = forks.get(childName);
            if (existing !== undefined) return existing;
            const childRng = {
              ...rng.fork(childName),
              _seeded: rng._seeded.fork(childName),
            } as RngInternal;
            const child = makeSession(childName, childRng);
            forks.set(childName, child);
            return child;
          },
          async settle() {
            await scheduler.settle();
          },
          async dispose() {
            if (disposed) return;
            disposed = true;
            for (const s of forks.values()) s.ports.network.unlisten();
            scheduler.underlying.reset(0);
          },
        };
        return session;
      };

      return makeSession('root', rootRng);
    },
  });
}
