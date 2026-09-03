import type { Clock } from '@pkgs/clock';
import { createSeededCreateId } from '@pkgs/uuid';
import { createVirtualClock } from '../kernel/clock';
import { createRngInternal } from '../kernel/rng';
import { createVirtualScheduler } from '../kernel/scheduler-api';
import { createTimers } from '../kernel/timers';
import { createTraceRecorder, type TraceRecorder } from '../kernel/trace';
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
  type VirtualHostOptions,
} from './types';

const VIRTUAL_CAPS: readonly Capability[] = [
  'virtualTime',
  'partition',
  'trace',
];

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

export function virtualHost(opts?: VirtualHostOptions): Host<Ports> {
  const faults: NetworkFaults = opts?.network ?? RELIABLE_NETWORK;
  const startTime = opts?.startTime ?? 0;
  const caps = new Set<Capability>(VIRTUAL_CAPS);
  const settleOverride = opts?.settle;
  const elapseOverride = opts?.elapse;

  return defineHost({
    caps,
    async open(seed) {
      const rootRng = createRngInternal(seed);
      const clock = createVirtualClock(startTime);
      const trace: TraceRecorder = createTraceRecorder();
      const scheduler = createVirtualScheduler({
        clock,
        choiceRng: rootRng._seeded.fork('sched'),
        trace,
      });
      const timers = createTimers(scheduler.underlying);
      const network = wrapNetworkCaps(
        createNetwork({
          scheduler: scheduler.underlying,
          rng: rootRng._seeded.fork('net'),
          faults,
          trace,
        }),
        caps
      );

      let disposed = false;
      const disposeHooks: (() => void | Promise<void>)[] = [];
      const forks = new Map<string, Session<Ports>>();

      const makeSession = (name: string, rng: RngInternal): Session<Ports> => {
        const ports: Ports = {
          clock: clock as Clock,
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
          trace,
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
            if (settleOverride !== undefined) {
              await settleOverride(session);
              return;
            }
            await scheduler.settle();
          },
          async elapse(ms) {
            if (elapseOverride !== undefined) {
              await elapseOverride(session, ms);
              return;
            }
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
            scheduler.underlying.reset(startTime);
          },
        };
        return session;
      };

      return makeSession('root', rootRng);
    },
  });
}
