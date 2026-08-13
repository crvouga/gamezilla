import type {
  SimulationFrameAttribute,
  SimulationFrameView,
  SimulationReportEvent,
} from '../types';

export function buildFrameAttributes(args: {
  readonly views: readonly SimulationFrameView[] | undefined;
  readonly databases:
    | readonly {
        readonly nodeId: string;
        readonly file: string;
        readonly sha256: string;
        readonly byteLength: number;
      }[]
    | undefined;
  readonly events: readonly SimulationReportEvent[];
  readonly capturedAtMs: number;
}): SimulationFrameAttribute[] {
  const out: SimulationFrameAttribute[] = [];
  for (const view of args.views ?? []) {
    out.push({ nodeId: view.nodeId, kind: 'html', file: view.file });
  }
  for (const db of args.databases ?? []) {
    out.push({
      nodeId: db.nodeId,
      kind: 'sqlite',
      file: db.file,
      sha256: db.sha256,
      byteLength: db.byteLength,
    });
  }
  const byNode = new Map<string, { in: string[]; out: string[] }>();
  for (const event of args.events) {
    if (event.atMs > args.capturedAtMs) continue;
    if (event.to) {
      const bucket = byNode.get(event.to) ?? { in: [], out: [] };
      bucket.in.push(event.id);
      byNode.set(event.to, bucket);
    }
    if (event.from) {
      const bucket = byNode.get(event.from) ?? { in: [], out: [] };
      bucket.out.push(event.id);
      byNode.set(event.from, bucket);
    }
  }
  for (const [nodeId, bag] of byNode) {
    if (bag.in.length > 0) {
      out.push({ nodeId, kind: 'ingress', eventIds: bag.in });
    }
    if (bag.out.length > 0) {
      out.push({ nodeId, kind: 'egress', eventIds: bag.out });
    }
  }
  return out;
}
