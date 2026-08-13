import type { SeededRng } from '@pkgs/io';

import type { EventLog } from '../events';
import type {
  EdgeDirection,
  EdgeKind,
  EdgeLinkState,
  LiveEdgeSnapshot,
} from '../topology';

export type MeshDeliver = () => void | Promise<void>;

export type QueuedMeshMessage = {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly deliver: MeshDeliver;
  readonly kind: 'http' | 'pubsub' | 'generic';
  readonly meta?: Readonly<Record<string, unknown>>;
};

export type FailWithSpec =
  | { readonly type: 'status'; readonly status: number }
  | { readonly type: 'error'; readonly error: string };

export type EdgeRuntime = {
  readonly from: string;
  readonly to: string;
  readonly kind: EdgeKind;
  stateFrom: EdgeLinkState;
  stateTo: EdgeLinkState;
  latencyMs: number;
  jitterMs: number;
  dropRate: number;
  duplicateRate: number;
  failWith: FailWithSpec | null;
  failWithRemaining: number;
  holdQueue: QueuedMeshMessage[];
};

export type CreateSimMeshArgs = {
  readonly rng: SeededRng;
  readonly events: EventLog;
  readonly now: () => number;
  /** Schedule delayed delivery (defaults to setTimeout via timers). */
  readonly schedule: (fn: () => void, delayMs: number) => void;
};

export type ReleaseOpts = {
  readonly reorder?: boolean;
};

export type PartitionOpts = {
  readonly direction?: EdgeDirection;
};

export type SimMesh = {
  registerEdge(from: string, to: string, kind: EdgeKind): void;
  unregisterNode(nodeId: string): void;
  edgeSnapshot(from: string, to: string): LiveEdgeSnapshot | null;
  listEdges(): readonly LiveEdgeSnapshot[];
  partition(from: string, to: string, opts?: PartitionOpts): void;
  heal(from: string, to: string, opts?: PartitionOpts): void;
  hold(from: string, to: string, opts?: PartitionOpts): void;
  release(from: string, to: string, opts?: ReleaseOpts): Promise<void>;
  latency(from: string, to: string, ms: number): void;
  jitter(from: string, to: string, ms: number): void;
  drop(from: string, to: string, rate: number): void;
  duplicate(from: string, to: string, rate: number): void;
  failWith(
    from: string,
    to: string,
    spec: FailWithSpec | number | string,
    opts: { readonly times: number }
  ): void;
  setNodePaused(nodeId: string, paused: boolean): void;
  isNodePaused(nodeId: string): boolean;
  /**
   * Route a message through the mesh. Resolves when delivered (or rejects /
   * resolves false when dropped / partitioned).
   */
  send(args: {
    readonly from: string;
    readonly to: string;
    readonly kind: 'http' | 'pubsub' | 'generic';
    readonly deliver: MeshDeliver;
    readonly meta?: Readonly<Record<string, unknown>>;
    /** Direction of this hop relative to the registered undirected edge. */
    readonly hop: 'forward' | 'reverse';
  }): Promise<'delivered' | 'dropped' | 'held' | 'partitioned'>;
  /** Consume one failWith if armed; returns the failure or null. */
  takeFailWith(from: string, to: string): FailWithSpec | null;
  getEdge(from: string, to: string): EdgeRuntime | null;
};
