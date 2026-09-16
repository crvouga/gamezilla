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
  const frames = flattenFrames(test.report.steps, [], 0);
  frames.sort((a, b) => a.frame.capturedAtMs - b.frame.capturedAtMs);
  frames.forEach((f, i) => {
    f.index = i;
  });
  return frames;
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
