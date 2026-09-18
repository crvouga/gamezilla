import type {
  HtmlReportTest,
  ReportFrame,
  ReportSnapshotBlob,
  ReportStep,
} from '@pkgs/sim';

import type { Route } from './hash';

export type FlatFrame = {
  step: ReportStep;
  frame: ReportFrame;
  depth: number;
  index: number;
};

export type OrderedUiBlob = {
  readonly nodeId: string;
  readonly blob: ReportSnapshotBlob | null;
};

const frameCache = new WeakMap<object, FlatFrame[]>();
const actorOrderCache = new WeakMap<object, string[]>();

export type FlatStep = {
  step: ReportStep;
  depth: number;
  parent: FlatStep | null;
  index: number;
};

export function flattenFrames(
  steps: readonly ReportStep[],
  out: FlatFrame[] = [],
  depth = 0
): FlatFrame[] {
  for (const step of steps) {
    for (const frame of step.frames) {
      out.push({ step, frame, depth, index: out.length });
    }
    flattenFrames(step.steps, out, depth + 1);
  }
  return out;
}

export function flattenSteps(
  steps: readonly ReportStep[],
  out: FlatStep[] = [],
  depth = 0,
  parent: FlatStep | null = null
): FlatStep[] {
  for (const step of steps) {
    const row: FlatStep = { step, depth, parent, index: out.length };
    out.push(row);
    flattenSteps(step.steps, out, depth + 1, row);
  }
  return out;
}

export function firstFrameFor(
  step: ReportStep,
  frames: readonly FlatFrame[]
): FlatFrame | null {
  for (const f of frames) {
    if (f.step === step) return f;
  }
  for (const kid of step.steps) {
    const f = firstFrameFor(kid, frames);
    if (f) return f;
  }
  return null;
}

export function lastFrameBefore(
  step: ReportStep,
  frames: readonly FlatFrame[]
): FlatFrame | null {
  let best: FlatFrame | null = null;
  for (const f of frames) {
    if (f.frame.capturedAtMs <= step.endedAtMs) best = f;
  }
  return best;
}

export function testFrames(test: HtmlReportTest): FlatFrame[] {
  const cached = frameCache.get(test);
  if (cached) return cached;

  const flattened = flattenFrames(test.report.steps, [], 0).map(
    (frame, order) => ({ frame, order })
  );
  flattened.sort(
    (a, b) =>
      a.frame.frame.capturedAtMs - b.frame.frame.capturedAtMs ||
      a.order - b.order
  );
  const frames = flattened.map(({ frame }, index) => ({
    ...frame,
    index,
  }));
  frameCache.set(test, frames);
  return frames;
}

function allUiActorIds(test: HtmlReportTest): string[] {
  const cached = actorOrderCache.get(test);
  if (cached) return cached;
  const observed: string[] = [];
  const seen = new Set<string>();
  for (const frame of testFrames(test)) {
    for (const blob of uiBlobs(frame)) {
      const id = blob.nodeId;
      if (id && !seen.has(id)) {
        seen.add(id);
        observed.push(id);
      }
    }
  }
  if (observed.length === 0) {
    actorOrderCache.set(test, []);
    return [];
  }

  const ordered = test.report.meta.actorIds.filter((id) => seen.has(id));
  for (const id of observed) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  actorOrderCache.set(test, ordered);
  return ordered;
}

/** Return UI snapshots in one stable actor order, including empty slots. */
export function orderedUiBlobs(
  frame: FlatFrame | null,
  test: HtmlReportTest
): OrderedUiBlob[] {
  const blobs = uiBlobs(frame);
  const byNode = new Map<string, ReportSnapshotBlob>();
  const unassigned: ReportSnapshotBlob[] = [];
  for (const blob of blobs) {
    const nodeId = blob.nodeId || '';
    if (nodeId && !byNode.has(nodeId)) byNode.set(nodeId, blob);
    else if (!nodeId) unassigned.push(blob);
  }

  const ordered = allUiActorIds(test).map((nodeId) => ({
    nodeId,
    blob: byNode.get(nodeId) ?? null,
  }));
  for (const blob of unassigned) {
    ordered.push({ nodeId: `snapshot-${ordered.length + 1}`, blob });
  }
  return ordered;
}

export function selectedFrame(
  frames: readonly FlatFrame[],
  route: Route
): FlatFrame | null {
  const n = Number.parseInt(route.params['frame'] || '', 10);
  if (Number.isFinite(n) && n >= 1 && n <= frames.length) {
    return frames[n - 1] ?? null;
  }
  for (const f of frames) {
    if (f.step.status === 'failed') return f;
  }
  return frames[frames.length - 1] ?? null;
}

export function isUi(b: ReportSnapshotBlob): boolean {
  return b.media === 'html' || b.media === 'png';
}

export function uiBlobs(frame: FlatFrame | null): ReportSnapshotBlob[] {
  return frame ? frame.frame.snapshots.filter(isUi) : [];
}

export function stageBlobs(frame: FlatFrame | null): ReportSnapshotBlob[] {
  return frame ? [...frame.frame.snapshots] : [];
}

export function frameHasUi(frame: FlatFrame | null): boolean {
  return uiBlobs(frame).length > 0;
}

export function actorIds(
  frame: FlatFrame | null,
  test: HtmlReportTest
): string[] {
  const ids: string[] = [];
  const seen: Record<string, true> = {};
  const add = (id: string) => {
    if (!id || seen[id]) return;
    seen[id] = true;
    ids.push(id);
  };
  for (const b of uiBlobs(frame)) add(b.nodeId || '');
  if (ids.length === 0) {
    for (const b of stageBlobs(frame)) add(b.nodeId || '');
  }
  if (ids.length === 0) {
    for (const id of test.report.meta.actorIds) add(id);
  }
  return ids;
}

export function selectedNode(
  frame: FlatFrame | null,
  route: Route,
  test: HtmlReportTest
): string | null {
  const ids = actorIds(frame, test);
  const param = route.params['node'];
  if (param && ids.includes(param)) return param;
  if (frame?.step.actorId && ids.includes(frame.step.actorId)) {
    return frame.step.actorId;
  }
  return ids[0] ?? null;
}

export function blobText(
  test: HtmlReportTest,
  blob: ReportSnapshotBlob
): string | null {
  const b = test.blobs[blob.file];
  return b && typeof b.text === 'string' ? b.text : null;
}

export function blobDataUrl(
  test: HtmlReportTest,
  blob: ReportSnapshotBlob
): string | null {
  const b = test.blobs[blob.file];
  if (!b?.base64) return null;
  return `data:${b.contentType};base64,${b.base64}`;
}
