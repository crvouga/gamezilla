import type { SimFaultOptions } from './faults';
import { sampleDelayMs } from './faults';
import type { SeededRng } from './rng';
import type { SimScheduler } from './scheduler';
import {
  type ClientTraffic,
  clientForHop,
  matchesTraffic,
  type SimTraffic,
} from './traffic';

export type SimEndpointId = string;
export type SimDeliver = (payload: unknown) => void | Promise<void>;

export type HeldPacket = {
  readonly from: SimEndpointId;
  readonly to: SimEndpointId;
  readonly payload: unknown;
};

export type SimNetworkState = {
  readonly endpoints: Map<SimEndpointId, SimDeliver>;
  readonly partitioned: Set<string>;
  readonly nodeFaults: Map<string, SimFaultOptions>;
  readonly heldKeys: Set<string>;
  readonly holdQueues: Map<string, HeldPacket[]>;
  readonly scheduler: SimScheduler;
  readonly rng: SeededRng;
  defaultFaults: SimFaultOptions;
};

export function edgeKey(a: SimEndpointId, b: SimEndpointId): string {
  return `${a}\0${b}`;
}

export function faultKey(nodeId: string, traffic: SimTraffic): string {
  return `${nodeId}\0${traffic}`;
}

export function holdKey(nodeId: string, traffic: SimTraffic): string {
  return `${nodeId}\0${traffic}`;
}

export function heldSummary(state: SimNetworkState): readonly string[] {
  return [...state.heldKeys].map((k) => k.replace('\0', ':'));
}

export function networkIsHeld(
  state: SimNetworkState,
  nodeId: string,
  traffic: SimTraffic
): boolean {
  if (traffic === 'all') {
    return (
      state.heldKeys.has(holdKey(nodeId, 'all')) ||
      state.heldKeys.has(holdKey(nodeId, 'live')) ||
      state.heldKeys.has(holdKey(nodeId, 'sync'))
    );
  }
  return isHeld(state, nodeId, traffic);
}

export function getNodeFaults(
  state: SimNetworkState,
  nodeId: string,
  traffic: SimTraffic
): SimFaultOptions | undefined {
  return state.nodeFaults.get(faultKey(nodeId, traffic));
}

export function clearNodeFaultsForTraffic(
  state: SimNetworkState,
  nodeId: string,
  traffic: SimTraffic
): void {
  state.nodeFaults.delete(faultKey(nodeId, traffic));
}

export function isPartitioned(
  state: SimNetworkState,
  from: string,
  to: string
): boolean {
  return (
    state.partitioned.has(edgeKey(from, to)) ||
    state.partitioned.has(edgeKey(to, from))
  );
}

export function resolveFaults(
  state: SimNetworkState,
  nodeId: string,
  traffic: ClientTraffic
): SimFaultOptions {
  const specific = state.nodeFaults.get(faultKey(nodeId, traffic));
  if (specific !== undefined) return specific;
  const all = state.nodeFaults.get(faultKey(nodeId, 'all'));
  if (all !== undefined) return all;
  return state.defaultFaults;
}

function isHeld(
  state: SimNetworkState,
  nodeId: string,
  traffic: ClientTraffic
): boolean {
  return (
    state.heldKeys.has(holdKey(nodeId, traffic)) ||
    state.heldKeys.has(holdKey(nodeId, 'all'))
  );
}

function enqueueHeld(
  state: SimNetworkState,
  nodeId: string,
  traffic: ClientTraffic,
  packet: HeldPacket
): void {
  const key = state.heldKeys.has(holdKey(nodeId, traffic))
    ? holdKey(nodeId, traffic)
    : holdKey(nodeId, 'all');
  const q = state.holdQueues.get(key) ?? [];
  q.push(packet);
  state.holdQueues.set(key, q);
}

export function deliverNow(state: SimNetworkState, packet: HeldPacket): void {
  const { from, to, payload } = packet;
  state.scheduler.scheduleAt(state.scheduler.clock.now(), async () => {
    if (isPartitioned(state, from, to)) return;
    const dest = state.endpoints.get(to);
    if (dest === undefined) return;
    await dest(payload);
  });
}

export function scheduleDeliver(
  state: SimNetworkState,
  packet: HeldPacket,
  faults: SimFaultOptions
): void {
  const delay = sampleDelayMs(faults, state.rng);
  const reorderExtra =
    faults.reorderWindow > 0 ? state.rng.int(faults.reorderWindow + 1) : 0;
  const deliverAt = state.scheduler.clock.now() + delay + reorderExtra;
  const { from, to, payload } = packet;
  state.scheduler.scheduleAt(deliverAt, async () => {
    if (isPartitioned(state, from, to)) return;
    const dest = state.endpoints.get(to);
    if (dest === undefined) return;
    await dest(payload);
  });
}

export function drainHoldKey(state: SimNetworkState, key: string): void {
  const q = state.holdQueues.get(key);
  state.holdQueues.delete(key);
  if (q === undefined) return;
  for (const packet of q) {
    deliverNow(state, packet);
  }
}

function sendLocal(
  state: SimNetworkState,
  to: SimEndpointId,
  payload: unknown
): void {
  const local = state.endpoints.get(to);
  if (local === undefined) return;
  state.scheduler.scheduleAt(state.scheduler.clock.now(), async () => {
    await local(payload);
  });
}

/** Fire-and-forget send with partition / hold / loss / replay. */
export function networkSend(
  state: SimNetworkState,
  from: SimEndpointId,
  to: SimEndpointId,
  payload: unknown
): void {
  if (from === to) {
    sendLocal(state, to, payload);
    return;
  }
  if (isPartitioned(state, from, to)) return;

  const client = clientForHop(from, to);
  if (client !== null && isHeld(state, client.nodeId, client.traffic)) {
    enqueueHeld(state, client.nodeId, client.traffic, { from, to, payload });
    return;
  }

  const faults =
    client !== null
      ? resolveFaults(state, client.nodeId, client.traffic)
      : state.defaultFaults;
  if (state.rng.bool(faults.packetLossProbability)) return;
  const packet = { from, to, payload };
  scheduleDeliver(state, packet, faults);
  if (state.rng.bool(faults.packetReplayProbability)) {
    scheduleDeliver(state, packet, faults);
  }
}

function drainMatchingAllQueue(
  state: SimNetworkState,
  nodeId: string,
  traffic: ClientTraffic
): void {
  const allKey = holdKey(nodeId, 'all');
  const allQ = state.holdQueues.get(allKey);
  if (allQ === undefined || state.heldKeys.has(allKey)) return;
  const keep: HeldPacket[] = [];
  for (const packet of allQ) {
    const c = clientForHop(packet.from, packet.to);
    if (c !== null && matchesTraffic(traffic, c.traffic)) {
      deliverNow(state, packet);
    } else {
      keep.push(packet);
    }
  }
  if (keep.length === 0) state.holdQueues.delete(allKey);
  else state.holdQueues.set(allKey, keep);
}

/** Release a hold and drain queued packets for that traffic. */
export function networkRelease(
  state: SimNetworkState,
  nodeId: string,
  traffic: SimTraffic
): void {
  if (traffic === 'all') {
    state.heldKeys.delete(holdKey(nodeId, 'all'));
    state.heldKeys.delete(holdKey(nodeId, 'live'));
    state.heldKeys.delete(holdKey(nodeId, 'sync'));
    drainHoldKey(state, holdKey(nodeId, 'all'));
    drainHoldKey(state, holdKey(nodeId, 'live'));
    drainHoldKey(state, holdKey(nodeId, 'sync'));
    return;
  }
  state.heldKeys.delete(holdKey(nodeId, traffic));
  drainHoldKey(state, holdKey(nodeId, traffic));
  drainMatchingAllQueue(state, nodeId, traffic);
}

export function networkReleaseAll(state: SimNetworkState): void {
  const keys = [...state.heldKeys];
  state.heldKeys.clear();
  for (const key of keys) drainHoldKey(state, key);
  for (const key of [...state.holdQueues.keys()]) drainHoldKey(state, key);
}

export function clearNodeFaults(state: SimNetworkState, nodeId?: string): void {
  if (nodeId === undefined) {
    state.nodeFaults.clear();
    return;
  }
  for (const key of [...state.nodeFaults.keys()]) {
    if (key.startsWith(`${nodeId}\0`)) state.nodeFaults.delete(key);
  }
}
