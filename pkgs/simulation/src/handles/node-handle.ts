import type { Driver } from '@pkgs/ui-testing';

import type { EventLog, EventMatcher } from '../events';
import type { SimMesh } from '../network';
import type { LiveNodeAdapter } from '../system-port';
import type {
  AttributeKind,
  AttributeSnapshot,
  LiveNodeSnapshot,
  NodeStatus,
} from '../topology';

export type SkewEffect = Disposable & { readonly restore: () => void };

export type SimNodeHandle = {
  readonly id: string;
  readonly kind: string;
  /** UI driver when this node has an html session. */
  readonly ui?: Driver;
  snapshot(): LiveNodeSnapshot;
  snapshotAttr(attr: AttributeKind): Promise<AttributeSnapshot | null>;
  crash(): Promise<void>;
  restart(): Promise<void>;
  corrupt(attr?: 'sqlite'): Promise<void>;
  wipe(attr?: 'sqlite'): Promise<void>;
  pause(): void;
  resume(): void;
  skewClock(ms: number): SkewEffect;
  crashOn(matcher: EventMatcher): Disposable;
  silentDropSubscription?(peerNodeId: string): void;
  clearSilentDrop?(peerNodeId: string): void;
  redeliver?(toNodeId: string): Promise<void>;
};

export type CreateNodeHandleArgs = {
  readonly id: string;
  readonly kind: string;
  readonly attributes: readonly AttributeKind[];
  readonly adapter: LiveNodeAdapter;
  readonly mesh: SimMesh;
  readonly events: EventLog;
  readonly getStatus: () => NodeStatus;
  readonly setStatus: (status: NodeStatus) => void;
  readonly getClockSkewMs: () => number;
  readonly setClockSkewMs: (ms: number) => void;
  readonly ui?: Driver;
};

export function createNodeHandle(args: CreateNodeHandleArgs): SimNodeHandle {
  const handle: SimNodeHandle = {
    id: args.id,
    kind: args.kind,
    ...(args.ui !== undefined ? { ui: args.ui } : {}),
    snapshot: () => ({
      id: args.id,
      kind: args.kind,
      status: args.getStatus(),
      attributes: args.attributes,
      clockSkewMs: args.getClockSkewMs(),
    }),
    snapshotAttr: (attr) => args.adapter.snapshot(attr),
    crash: () => crashNode(args),
    restart: () => restartNode(args),
    corrupt: (attr = 'sqlite') => corruptNode(args, attr),
    wipe: (attr = 'sqlite') => wipeNode(args, attr),
    pause: () => pauseNode(args),
    resume: () => resumeNode(args),
    skewClock: (ms) => skewNode(args, ms),
    crashOn: (matcher) => armCrashOn(args, matcher),
  };
  if (args.adapter.silentDropSubscription) {
    handle.silentDropSubscription = (peer) => {
      args.adapter.silentDropSubscription?.(peer);
    };
  }
  if (args.adapter.clearSilentDrop) {
    handle.clearSilentDrop = (peer) => {
      args.adapter.clearSilentDrop?.(peer);
    };
  }
  if (args.adapter.redeliver) {
    handle.redeliver = (to) =>
      args.adapter.redeliver?.(to) ?? Promise.resolve();
  }
  return handle;
}

async function crashNode(args: CreateNodeHandleArgs): Promise<void> {
  args.setStatus('crashed');
  args.events.append({ kind: 'node.crash', nodeId: args.id });
  await args.adapter.crash();
}

async function restartNode(args: CreateNodeHandleArgs): Promise<void> {
  await args.adapter.restart();
  args.setStatus('ok');
  args.events.append({ kind: 'node.restart', nodeId: args.id });
}

async function corruptNode(
  args: CreateNodeHandleArgs,
  attr: 'sqlite'
): Promise<void> {
  if (!args.adapter.corrupt) {
    throw new Error(`SimNode(${args.id}): corrupt not supported`);
  }
  await args.adapter.corrupt(attr);
  args.events.append({
    kind: 'node.corrupt',
    nodeId: args.id,
    detail: attr,
  });
}

async function wipeNode(
  args: CreateNodeHandleArgs,
  attr: 'sqlite'
): Promise<void> {
  if (!args.adapter.wipe) {
    throw new Error(`SimNode(${args.id}): wipe not supported`);
  }
  await args.adapter.wipe(attr);
  args.events.append({ kind: 'node.wipe', nodeId: args.id, detail: attr });
}

function pauseNode(args: CreateNodeHandleArgs): void {
  args.mesh.setNodePaused(args.id, true);
  args.setStatus('paused');
  args.events.append({ kind: 'node.pause', nodeId: args.id });
}

function resumeNode(args: CreateNodeHandleArgs): void {
  args.mesh.setNodePaused(args.id, false);
  args.setStatus(args.getStatus() === 'crashed' ? 'crashed' : 'ok');
  args.events.append({ kind: 'node.resume', nodeId: args.id });
}

function skewNode(args: CreateNodeHandleArgs, ms: number): SkewEffect {
  const prior = args.getClockSkewMs();
  args.setClockSkewMs(ms);
  args.adapter.setClockSkewMs?.(ms);
  args.events.append({
    kind: 'node.skewClock',
    nodeId: args.id,
    detail: `ms=${ms}`,
  });
  let done = false;
  const restore = () => {
    if (done) return;
    done = true;
    args.setClockSkewMs(prior);
    args.adapter.setClockSkewMs?.(prior);
  };
  return { restore, [Symbol.dispose]: restore };
}

function armCrashOn(
  args: CreateNodeHandleArgs,
  matcher: EventMatcher
): Disposable {
  args.events.append({
    kind: 'node.crashOn',
    nodeId: args.id,
    detail: JSON.stringify(matcher),
  });
  let armed = true;
  const unsub = args.events.subscribe((event) => {
    if (!armed) return;
    if (!args.events.matches(event, matcher)) return;
    armed = false;
    unsub();
    void crashNode(args);
  });
  return {
    [Symbol.dispose]: () => {
      armed = false;
      unsub();
    },
  };
}
