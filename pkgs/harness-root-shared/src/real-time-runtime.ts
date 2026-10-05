// @io-wall-ok — realTimeRuntime composition root
import type { Clock } from '@pkgs/clock-shared/types';
import { createSeededCreateId } from '@pkgs/uuid-shared/seeded-create-id';
import { createRuntime } from './create-runtime';
import { createNetwork } from './network';
import type { Network, NetworkFaults } from './network-state';
import { RELIABLE_NETWORK } from './network-state';
import { createWallScheduler } from './real-time-scheduler';
import { createRngInternal } from './rng';
import type {
  Capability,
  Endpoint,
  Ports,
  RealTimeRuntimeOptions,
  Runtime,
  Session,
} from './runtime-types';
import { CapabilityError } from './runtime-types';
import { createTimers } from './timers';
import { NOOP_TRACE_RECORDER } from './trace';

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
  return {
    register() {},
    unregister() {},
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

export function realTimeRuntime(opts: RealTimeRuntimeOptions): Runtime<Ports> {
  const caps = new Set<Capability>(
    opts.network === 'model' ? ['partition'] : []
  );
  const faults: NetworkFaults = opts.networkFaults ?? RELIABLE_NETWORK;
  const waitForIdleOverride = opts.waitForIdle;

  return createRuntime({
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
      const disposeHooks: (() => void | Promise<void>)[] = [];
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
          async waitForIdle() {
            if (waitForIdleOverride !== undefined) {
              await waitForIdleOverride(session);
              return;
            }
            await scheduler.waitForIdle();
          },
          async advanceTime(ms) {
            await scheduler.advance(ms);
          },
          onDispose(fn) {
            disposeHooks.push(fn);
          },
          async dispose() {
            if (disposed) return;
            disposed = true;
            for (const fn of disposeHooks) await fn();
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
