import type { SeededRng } from '@pkgs/io';

import type { EventLog } from '../events';
import { hopState } from './mesh-edge-ops';
import type { EdgeRuntime, QueuedMeshMessage } from './mesh-types';

export type MeshSendDeps = {
  readonly rng: SeededRng;
  readonly events: EventLog;
  readonly schedule: (fn: () => void, delayMs: number) => void;
  readonly paused: Set<string>;
  readonly nextMsgId: () => string;
};

export async function meshSend(
  deps: MeshSendDeps,
  edge: EdgeRuntime,
  sendArgs: {
    readonly from: string;
    readonly to: string;
    readonly kind: 'http' | 'pubsub' | 'generic';
    readonly deliver: () => void | Promise<void>;
    readonly meta?: Readonly<Record<string, unknown>>;
  }
): Promise<'delivered' | 'dropped' | 'held' | 'partitioned'> {
  const state = hopState(edge, sendArgs.from, sendArgs.to);
  if (state === 'down') return 'partitioned';
  if (deps.paused.has(sendArgs.to) || state === 'hold') {
    return enqueueHeld(deps, edge, sendArgs);
  }
  if (edge.dropRate > 0 && deps.rng.bool(edge.dropRate)) {
    deps.events.append({
      kind: 'edge.drop',
      from: sendArgs.from,
      to: sendArgs.to,
      status: 'dropped',
      ...(sendArgs.meta !== undefined ? { meta: sendArgs.meta } : {}),
    });
    return 'dropped';
  }
  const delay = sampleDelay(deps.rng, edge);
  if (delay > 0) {
    deps.events.append({
      kind: 'edge.delay',
      from: sendArgs.from,
      to: sendArgs.to,
      detail: `ms=${delay}`,
    });
    await delayMs(deps.schedule, delay);
  }
  await Promise.resolve(sendArgs.deliver());
  if (edge.duplicateRate > 0 && deps.rng.bool(edge.duplicateRate)) {
    deps.events.append({
      kind: 'edge.duplicate',
      from: sendArgs.from,
      to: sendArgs.to,
      ...(sendArgs.meta !== undefined ? { meta: sendArgs.meta } : {}),
    });
    await Promise.resolve(sendArgs.deliver());
  }
  return 'delivered';
}

function enqueueHeld(
  deps: MeshSendDeps,
  edge: EdgeRuntime,
  sendArgs: {
    readonly from: string;
    readonly to: string;
    readonly kind: 'http' | 'pubsub' | 'generic';
    readonly deliver: () => void | Promise<void>;
    readonly meta?: Readonly<Record<string, unknown>>;
  }
): 'held' {
  const msg: QueuedMeshMessage = {
    id: deps.nextMsgId(),
    from: sendArgs.from,
    to: sendArgs.to,
    deliver: sendArgs.deliver,
    kind: sendArgs.kind,
    ...(sendArgs.meta !== undefined ? { meta: sendArgs.meta } : {}),
  };
  edge.holdQueue.push(msg);
  return 'held';
}

function sampleDelay(rng: SeededRng, edge: EdgeRuntime): number {
  if (edge.latencyMs === 0 && edge.jitterMs === 0) return 0;
  const delta =
    edge.jitterMs === 0
      ? 0
      : Math.floor((rng.random() * 2 - 1) * edge.jitterMs);
  return Math.max(0, edge.latencyMs + delta);
}

function delayMs(
  schedule: (fn: () => void, delayMs: number) => void,
  ms: number
): Promise<void> {
  return new Promise((resolve) => {
    schedule(resolve, ms);
  });
}
