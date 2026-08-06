import type { SimFaultOptions } from './faults';
import { RELIABLE_FAULTS, sampleDelayMs } from './faults';
import type { SeededRng } from './rng';
import type { SimScheduler } from './scheduler';

export type SimEndpointId = string;

export type SimDeliver = (payload: unknown) => void | Promise<void>;

/**
 * Lossy point-to-point mesh. `send` schedules delivery and returns immediately
 * so the discrete-event drain loop is never blocked waiting on itself.
 */
export type SimNetwork = {
  readonly register: (id: SimEndpointId, deliver: SimDeliver) => void;
  readonly unregister: (id: SimEndpointId) => void;
  /** Schedule delivery (fire-and-forget). Drops when partitioned / lost. */
  readonly send: (
    from: SimEndpointId,
    to: SimEndpointId,
    payload: unknown
  ) => void;
  readonly partition: (a: SimEndpointId, b: SimEndpointId) => void;
  readonly heal: (a: SimEndpointId, b: SimEndpointId) => void;
  readonly healAll: () => void;
  readonly setFaults: (faults: SimFaultOptions) => void;
  readonly faults: () => SimFaultOptions;
};

function edgeKey(a: SimEndpointId, b: SimEndpointId): string {
  return `${a}\0${b}`;
}

export function createSimNetwork(args: {
  readonly scheduler: SimScheduler;
  readonly rng: SeededRng;
  readonly faults?: SimFaultOptions;
}): SimNetwork {
  const endpoints = new Map<SimEndpointId, SimDeliver>();
  const partitioned = new Set<string>();
  let faults = args.faults ?? RELIABLE_FAULTS;

  const isPartitioned = (from: string, to: string): boolean =>
    partitioned.has(edgeKey(from, to)) || partitioned.has(edgeKey(to, from));

  const scheduleDeliver = (
    from: SimEndpointId,
    to: SimEndpointId,
    payload: unknown
  ): void => {
    const delay = sampleDelayMs(faults, args.rng);
    const reorderExtra =
      faults.reorderWindow > 0 ? args.rng.int(faults.reorderWindow + 1) : 0;
    const deliverAt = args.scheduler.clock.now() + delay + reorderExtra;
    args.scheduler.scheduleAt(deliverAt, async () => {
      if (isPartitioned(from, to)) return;
      const dest = endpoints.get(to);
      if (dest === undefined) return;
      await dest(payload);
    });
  };

  return {
    register(id, deliver) {
      endpoints.set(id, deliver);
    },
    unregister(id) {
      endpoints.delete(id);
    },
    send(from, to, payload) {
      if (from === to) {
        const local = endpoints.get(to);
        if (local !== undefined) {
          args.scheduler.scheduleAt(args.scheduler.clock.now(), async () => {
            await local(payload);
          });
        }
        return;
      }
      if (isPartitioned(from, to)) return;
      if (args.rng.bool(faults.packetLossProbability)) return;
      scheduleDeliver(from, to, payload);
      if (args.rng.bool(faults.packetReplayProbability)) {
        scheduleDeliver(from, to, payload);
      }
    },
    partition(a, b) {
      partitioned.add(edgeKey(a, b));
      partitioned.add(edgeKey(b, a));
    },
    heal(a, b) {
      partitioned.delete(edgeKey(a, b));
      partitioned.delete(edgeKey(b, a));
    },
    healAll() {
      partitioned.clear();
    },
    setFaults(next) {
      faults = next;
    },
    faults: () => faults,
  };
}
