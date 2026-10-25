import type {
  Deliver,
  EndpointId,
  FlowKey,
  Network,
  NetworkFaults,
} from '@pkgs/harness-root-shared-ts/network-state';
import { RELIABLE_NETWORK } from '@pkgs/harness-root-shared-ts/network-state';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';

type Frame = {
  readonly from: EndpointId;
  readonly to: EndpointId;
  readonly payload: unknown;
  readonly at: number;
};
type Flow = { readonly frames: Frame[]; pumping: boolean; lastAt: number };

/** Observes each frame once, as its sender hands it to the link. */
export type OrderedNetworkTap = (
  from: EndpointId,
  to: EndpointId,
  payload: unknown
) => void;

/**
 * A room link that behaves like one WebSocket per connection direction: frames
 * on a flow arrive in the order they were sent, exactly once, unless the
 * connection is interrupted (a partition loses what was in flight). Latency
 * and jitter delay a flow without ever overtaking an earlier frame. Loss,
 * duplication and reordering are refused: a single connection cannot do them,
 * so a scenario must interrupt the connection instead.
 */
export type OrderedNetwork = Network & {
  /** Frames queued, held or being delivered across every flow. */
  readonly queued: () => number;
};

function edge(a: EndpointId, b: EndpointId): string {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

function refuseUnorderedFaults(faults: Partial<NetworkFaults>): void {
  for (const name of [
    'dropProbability',
    'duplicateProbability',
    'reorderWindowMs',
    'partitionProbability',
    'healProbability',
  ] as const)
    if ((faults[name] ?? 0) !== 0)
      throw new Error(
        `an ordered connection cannot apply ${name}; interrupt the connection instead`
      );
}

export function orderedNetwork(
  session: Session,
  tap: OrderedNetworkTap = () => {}
): OrderedNetwork {
  const scheduler = session.scheduler.underlying;
  const random = session.ports.rng.fork('ordered-links');
  const endpoints = new Map<EndpointId, Deliver>();
  const partitioned = new Set<string>();
  const held = new Set<FlowKey>();
  const flows = new Map<FlowKey, Flow>();
  const overrides = new Map<FlowKey, Partial<NetworkFaults>>();
  let defaults: NetworkFaults = RELIABLE_NETWORK;
  let delivering = 0;

  const faults = (key?: FlowKey): NetworkFaults => ({
    ...defaults,
    ...(key === undefined ? {} : overrides.get(key)),
  });
  const delay = (key: FlowKey): number => {
    const { latencyMeanMs, latencyJitterMs } = faults(key);
    const jitter = Math.floor((random.next() * 2 - 1) * latencyJitterMs);
    return Math.max(0, latencyMeanMs + jitter);
  };

  async function deliverHead(key: FlowKey, flow: Flow): Promise<void> {
    const frame = flow.frames.shift();
    if (frame === undefined) return;
    delivering += 1;
    try {
      const deliver = endpoints.get(frame.to);
      if (deliver !== undefined && !partitioned.has(edge(frame.from, frame.to)))
        await deliver(frame.payload);
    } finally {
      delivering -= 1;
    }
    pump(key, flow);
  }

  /**
   * Like the kernel, only work that is due counts as in flight: a drain
   * settles what has arrived and never waits out a link's latency.
   */
  function due(): number {
    const now = scheduler.clock.now();
    let count = delivering;
    for (const [key, flow] of flows)
      if (!held.has(key))
        for (const frame of flow.frames) {
          if (frame.at > now) break;
          count += 1;
        }
    return count;
  }

  function pump(key: FlowKey, flow: Flow): void {
    const head = flow.frames[0];
    flow.pumping = head !== undefined && !held.has(key);
    if (!flow.pumping || head === undefined) return;
    scheduler.scheduleAt(
      Math.max(head.at, scheduler.clock.now()),
      () => deliverHead(key, flow),
      'network.ordered'
    );
  }

  function flowOf(key: FlowKey): Flow {
    const existing = flows.get(key);
    if (existing !== undefined) return existing;
    const flow: Flow = { frames: [], pumping: false, lastAt: 0 };
    flows.set(key, flow);
    return flow;
  }

  function release(key: FlowKey): void {
    held.delete(key);
    const flow = flows.get(key);
    if (flow !== undefined && !flow.pumping) pump(key, flow);
  }

  return {
    register: (id, deliver) => {
      endpoints.set(id, deliver);
    },
    unregister: (id) => {
      endpoints.delete(id);
    },
    send(from, to, payload, opts) {
      tap(from, to, payload);
      if (partitioned.has(edge(from, to))) return;
      const key = opts?.key ?? edge(from, to);
      const flow = flowOf(key);
      const at = Math.max(scheduler.clock.now() + delay(key), flow.lastAt);
      flow.lastAt = at;
      flow.frames.push({ from, to, payload, at });
      if (!flow.pumping) pump(key, flow);
    },
    partition: (a, b) => {
      partitioned.add(edge(a, b));
    },
    heal: (a, b) => {
      partitioned.delete(edge(a, b));
    },
    healAll: () => partitioned.clear(),
    isPartitioned: (a, b) => partitioned.has(edge(a, b)),
    hold: (key) => {
      held.add(key);
    },
    release,
    releaseAll: () => {
      for (const key of [...held]) release(key);
    },
    isHeld: (key) => held.has(key),
    held: () => [...held].sort(),
    faults,
    setFaults(partial, key) {
      refuseUnorderedFaults(partial);
      if (key === undefined) defaults = { ...defaults, ...partial };
      else overrides.set(key, { ...overrides.get(key), ...partial });
    },
    clearFaults(key) {
      if (key === undefined) overrides.clear();
      else overrides.delete(key);
    },
    inFlight: due,
    queued: () =>
      delivering +
      [...flows.values()].reduce(
        (total, flow) => total + flow.frames.length,
        0
      ),
    partitions: () =>
      [...partitioned].sort().map((pair) => {
        const [a = '', b = ''] = pair.split('\0');
        return [a, b] as const;
      }),
  };
}
