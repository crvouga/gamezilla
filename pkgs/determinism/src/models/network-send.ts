import type {
  EndpointId,
  FlowKey,
  NetworkFaults,
  NetworkState,
} from './network-state';
import {
  allocMessageId,
  effectiveFaults,
  isPartitioned,
  sampleLatencyMs,
  setPartition,
} from './network-state';

type MessageArgs = {
  readonly from: EndpointId;
  readonly to: EndpointId;
  readonly payload: unknown;
  readonly messageId: number;
};

function deliverCallback(
  state: NetworkState,
  args: MessageArgs
): () => Promise<void> {
  const { from, to, payload, messageId } = args;
  return async () => {
    try {
      if (isPartitioned(state, from, to)) {
        state.trace?.record({
          type: 'network',
          op: 'drop.partition',
          from,
          to,
          detail: messageId,
        });
        return;
      }
      const dest = state.endpoints.get(to);
      if (dest === undefined) {
        state.trace?.record({
          type: 'network',
          op: 'drop.unregistered',
          from,
          to,
          detail: messageId,
        });
        return;
      }
      await dest(payload);
      state.trace?.record({
        type: 'network',
        op: 'deliver',
        from,
        to,
        detail: messageId,
      });
    } finally {
      state.inFlight = Math.max(0, state.inFlight - 1);
    }
  };
}

export function deliverNow(state: NetworkState, args: MessageArgs): void {
  state.inFlight += 1;
  state.scheduler.scheduleAt(
    state.scheduler.clock.now(),
    deliverCallback(state, args),
    'network.deliver'
  );
}

function scheduleDeliver(
  state: NetworkState,
  args: MessageArgs & { readonly faults: NetworkFaults }
): void {
  const delay = sampleLatencyMs(args.faults, state.rng);
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
      messageId: args.messageId,
    }),
    'network.deliver'
  );
}

function dropPartition(
  state: NetworkState,
  from: EndpointId,
  to: EndpointId
): void {
  state.trace?.record({
    type: 'network',
    op: 'drop.partition',
    from,
    to,
  });
}

/** Heal-before-drop: returns false if the send must abort (still partitioned). */
function maybeHealOrKeepPartition(
  state: NetworkState,
  from: EndpointId,
  to: EndpointId,
  faults: NetworkFaults
): boolean {
  if (!isPartitioned(state, from, to)) return true;
  if (faults.healProbability > 0) {
    if (state.rng.bool(faults.healProbability)) {
      setPartition(state, from, to, false);
      return true;
    }
  }
  dropPartition(state, from, to);
  return false;
}

function sendLocal(
  state: NetworkState,
  to: EndpointId,
  payload: unknown
): void {
  if (!state.endpoints.has(to)) return;
  const messageId = allocMessageId(state);
  state.trace?.record({
    type: 'network',
    op: 'send',
    from: to,
    to,
    detail: messageId,
  });
  deliverNow(state, { from: to, to, payload, messageId });
}

function enqueueHeld(
  state: NetworkState,
  args: {
    readonly from: EndpointId;
    readonly to: EndpointId;
    readonly payload: unknown;
    readonly key: FlowKey;
  }
): void {
  const messageId = allocMessageId(state);
  const q = state.holdQueues.get(args.key) ?? [];
  q.push({
    from: args.from,
    to: args.to,
    payload: args.payload,
    messageId,
  });
  state.holdQueues.set(args.key, q);
  state.trace?.record({
    type: 'network',
    op: 'send',
    from: args.from,
    to: args.to,
    detail: { key: args.key, messageId },
  });
  state.trace?.record({
    type: 'network',
    op: 'hold.enqueue',
    from: args.from,
    to: args.to,
    detail: { key: args.key, messageId },
  });
}

function trySpontaneousPartition(
  state: NetworkState,
  from: EndpointId,
  to: EndpointId,
  faults: NetworkFaults
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

function tryDrop(
  state: NetworkState,
  from: EndpointId,
  to: EndpointId,
  faults: NetworkFaults
): boolean {
  const drop =
    faults.dropProbability > 0 ? state.rng.bool(faults.dropProbability) : false;
  if (!drop) return false;
  state.trace?.record({
    type: 'network',
    op: 'drop.loss',
    from,
    to,
  });
  return true;
}

export function networkSend(args: {
  readonly state: NetworkState;
  readonly from: EndpointId;
  readonly to: EndpointId;
  readonly payload: unknown;
  readonly opts?: { readonly key?: FlowKey };
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
  if (tryDrop(state, from, to, faults)) return;

  const messageId = allocMessageId(state);
  state.trace?.record({
    type: 'network',
    op: 'send',
    from,
    to,
    detail: key !== undefined ? { key, messageId } : messageId,
  });
  scheduleDeliver(state, { from, to, payload, messageId, faults });
  if (
    faults.duplicateProbability > 0 &&
    state.rng.bool(faults.duplicateProbability)
  ) {
    scheduleDeliver(state, { from, to, payload, messageId, faults });
  }
}

export function releaseHeldKey(state: NetworkState, key: FlowKey): void {
  state.heldKeys.delete(key);
  const q = state.holdQueues.get(key);
  state.holdQueues.delete(key);
  if (q === undefined) return;
  for (const message of q) {
    state.trace?.record({
      type: 'network',
      op: 'hold.release',
      from: message.from,
      to: message.to,
      detail: { key, messageId: message.messageId },
    });
    deliverNow(state, {
      from: message.from,
      to: message.to,
      payload: message.payload,
      messageId: message.messageId,
    });
  }
}
