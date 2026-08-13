import type { EventLog } from '../events';
import type {
  FailWithSpec,
  PartitionOpts,
  ReleaseOpts,
  SimMesh,
} from '../network';
import type { LiveEdgeSnapshot } from '../topology';

export type SimEdgeHandle = {
  readonly from: string;
  readonly to: string;
  snapshot(): LiveEdgeSnapshot | null;
  partition(opts?: PartitionOpts): void;
  heal(opts?: PartitionOpts): void;
  hold(opts?: PartitionOpts): void;
  release(opts?: ReleaseOpts): Promise<void>;
  latency(ms: number): void;
  jitter(ms: number): void;
  drop(rate: number): void;
  duplicate(rate: number): void;
  failWith(
    statusOrError: FailWithSpec | number | string,
    opts: { readonly times: number }
  ): void;
};

export function createEdgeHandle(args: {
  readonly from: string;
  readonly to: string;
  readonly mesh: SimMesh;
  readonly events: EventLog;
}): SimEdgeHandle {
  void args.events;
  const { from, to, mesh } = args;
  return {
    from,
    to,
    snapshot: () => mesh.edgeSnapshot(from, to),
    partition: (opts) => mesh.partition(from, to, opts),
    heal: (opts) => mesh.heal(from, to, opts),
    hold: (opts) => mesh.hold(from, to, opts),
    release: (opts) => mesh.release(from, to, opts),
    latency: (ms) => mesh.latency(from, to, ms),
    jitter: (ms) => mesh.jitter(from, to, ms),
    drop: (rate) => mesh.drop(from, to, rate),
    duplicate: (rate) => mesh.duplicate(from, to, rate),
    failWith: (spec, opts) => mesh.failWith(from, to, spec, opts),
  };
}
