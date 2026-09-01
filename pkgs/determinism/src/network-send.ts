import type {
  SimEndpointId,
  SimNetFaultProfile,
  SimNetKey,
  SimNetworkState,
} from './network-state';
import {
  allocPacketId,
  effectiveFaults,
  isPartitioned,
  sampleDelayMs,
  setPartition,
} from './network-state';

function deliverCallback(
  state: SimNetworkState,
  args: {
    readonly from: SimEndpointId;
    readonly to: SimEndpointId;
    readonly payload: unknown;
    readonly packetId: number;
  }
): () => Promise<void> {
  const { from, to, payload, packetId } = args;
  return async () => {
    try {
      if (isPartitioned(state, from, to)) {
        state.trace?.record({
          now: state.scheduler.clock.now(),
          type: 'net_drop',
          reason: 'partition',
          from,
          to,
          packetId,
        });
        return;
      }
      const dest = state.endpoints.get(to);
      if (dest === undefined) {
        state.trace?.record({
          now: state.scheduler.clock.now(),
          type: 'net_drop',
          reason: 'unregistered',
          from,
          to,
          packetId,
        });
        return;
      }
      await dest(payload);
      state.trace?.record({
        now: state.scheduler.clock.now(),
        type: 'net_deliver',
        from,
        to,
        packetId,
      });
    } finally {
      state.inFlight = Math.max(0, state.inFlight - 1);
    }
  };
}

export function deliverNow(
  state: SimNetworkState,
  args: {
    readonly from: SimEndpointId;
    readonly to: SimEndpointId;
    readonly payload: unknown;
    readonly packetId: number;
  }
): void {
  state.inFlight += 1;
  state.scheduler.scheduleAt(
    state.scheduler.clock.now(),
    deliverCallback(state, args)
  );
}

function scheduleDeliver(
  state: SimNetworkState,
  args: {
    readonly from: SimEndpointId;
    readonly to: SimEndpointId;
    readonly payload: unknown;
    readonly packetId: number;
    readonly faults: SimNetFaultProfile;
  }
): void {
  const delay = sampleDelayMs(args.faults, state.rng);
  const extra =
    args.faults.reorderWindowMs > 0
      ? state.rng.int(args.faults.reorderWindowMs + 1)
      : 0;
  const at = state.scheduler.clock.now() + delay + extra;
  state.inFlight += 1;
  state.scheduler.scheduleAt(
    at,
    deliverCallback(state, {
      from: args.from,
      to: args.to,
      payload: args.payload,
      packetId: args.packetId,
    })
  );
}

function dropPartition(
  state: SimNetworkState,
  from: SimEndpointId,
  to: SimEndpointId
): void {
  state.trace?.record({
    now: state.scheduler.clock.now(),
    type: 'net_drop',
    reason: 'partition',
    from,
    to,
  });
}

/** Heal-before-drop: returns false if the send must abort (still partitioned). */
function maybeHealOrKeepPartition(
  state: SimNetworkState,
  from: SimEndpointId,
  to: SimEndpointId,
  faults: SimNetFaultProfile
): boolean {
  if (!isPartitioned(state, from, to)) return true;
  if (faults.unpartitionProbability > 0) {
    if (state.rng.bool(faults.unpartitionProbability)) {
      setPartition(state, from, to, false);
      return true;
    }
  }
  dropPartition(state, from, to);
  return false;
}

function sendLocal(
  state: SimNetworkState,
  to: SimEndpointId,
  payload: unknown
): void {
  if (!state.endpoints.has(to)) return;
  const packetId = allocPacketId(state);
  state.trace?.record({
    now: state.scheduler.clock.now(),
    type: 'net_send',
    from: to,
    to,
    packetId,
  });
  deliverNow(state, { from: to, to, payload, packetId });
}

function enqueueHeld(
  state: SimNetworkState,
  args: {
    readonly from: SimEndpointId;
    readonly to: SimEndpointId;
    readonly payload: unknown;
    readonly key: SimNetKey;
  }
): void {
  const packetId = allocPacketId(state);
  const q = state.holdQueues.get(args.key) ?? [];
  q.push({
    from: args.from,
    to: args.to,
    payload: args.payload,
    packetId,
  });
  state.holdQueues.set(args.key, q);
  const now = state.scheduler.clock.now();
  state.trace?.record({
    now,
    type: 'net_send',
    from: args.from,
    to: args.to,
    key: args.key,
    packetId,
  });
  state.trace?.record({
    now,
    type: 'net_hold',
    key: args.key,
    op: 'enqueue',
    packetId,
  });
}

function trySpontaneousPartition(
  state: SimNetworkState,
  from: SimEndpointId,
  to: SimEndpointId,
  faults: SimNetFaultProfile
): boolean {
  if (
    faults.partitionProbability > 0 &&
    state.rng.bool(faults.partitionProbability)
  ) {
    setPartition(state, from, to, true);
    dropPartition(state, from, to);
    return true;
  }
  return false;
}

function tryLoss(
  state: SimNetworkState,
  from: SimEndpointId,
  to: SimEndpointId,
  faults: SimNetFaultProfile
): boolean {
  const loss =
    faults.packetLossProbability > 0
      ? state.rng.bool(faults.packetLossProbability)
      : false;
  if (!loss) return false;
  state.trace?.record({
    now: state.scheduler.clock.now(),
    type: 'net_drop',
    reason: 'loss',
    from,
    to,
  });
  return true;
}

export function networkSend(args: {
  readonly state: SimNetworkState;
  readonly from: SimEndpointId;
  readonly to: SimEndpointId;
  readonly payload: unknown;
  readonly opts?: { readonly key?: SimNetKey };
}): void {
  const { state, from, to, payload, opts } = args;
  const key = opts?.key;
  const faults = effectiveFaults(state, key);

  if (from === to) {
    sendLocal(state, to, payload);
    return;
  }
  if (key !== undefined && state.heldKeys.has(key)) {
    enqueueHeld(state, { from, to, payload, key });
    return;
  }
  if (!maybeHealOrKeepPartition(state, from, to, faults)) return;
  if (trySpontaneousPartition(state, from, to, faults)) return;
  if (tryLoss(state, from, to, faults)) return;

  const packetId = allocPacketId(state);
  state.trace?.record({
    now: state.scheduler.clock.now(),
    type: 'net_send',
    from,
    to,
    ...(key !== undefined ? { key } : {}),
    packetId,
  });
  scheduleDeliver(state, { from, to, payload, packetId, faults });
  if (
    faults.duplicateProbability > 0 &&
    state.rng.bool(faults.duplicateProbability)
  ) {
    scheduleDeliver(state, { from, to, payload, packetId, faults });
  }
}

export function releaseHeldKey(state: SimNetworkState, key: SimNetKey): void {
  state.heldKeys.delete(key);
  const q = state.holdQueues.get(key);
  state.holdQueues.delete(key);
  if (q === undefined) return;
  for (const packet of q) {
    state.trace?.record({
      now: state.scheduler.clock.now(),
      type: 'net_hold',
      key,
      op: 'release_flush',
      packetId: packet.packetId,
    });
    deliverNow(state, {
      from: packet.from,
      to: packet.to,
      payload: packet.payload,
      packetId: packet.packetId,
    });
  }
}
