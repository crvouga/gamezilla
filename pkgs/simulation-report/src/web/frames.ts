import type { SimulationFrame, SimulationStep } from '../types';

export type FlatFrame = {
  readonly file: string;
  readonly capturedAtMs: number;
  readonly durationMs: number;
  readonly stepIndex: number;
  readonly step: SimulationStep;
  readonly globalIndex: number;
};

export function flattenFrames(steps: readonly SimulationStep[]): FlatFrame[] {
  const frames: FlatFrame[] = [];
  steps.forEach((step, stepIndex) => {
    const list: SimulationFrame[] =
      step.frames && step.frames.length > 0
        ? [...step.frames]
        : step.snapshotFile
          ? [
              {
                file: step.snapshotFile,
                capturedAtMs: step.endedAtMs || step.startedAtMs || 0,
                durationMs: step.durationMs || 0,
              },
            ]
          : [];
    for (const frame of list) {
      frames.push({
        file: frame.file,
        capturedAtMs: frame.capturedAtMs,
        durationMs: frame.durationMs ?? 0,
        stepIndex,
        step,
        globalIndex: frames.length,
      });
    }
  });
  return frames;
}

export function formatMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function firstFrameForStep(
  frames: readonly FlatFrame[],
  stepIndex: number
): number {
  for (let i = 0; i < frames.length; i++) {
    if (frames[i]!.stepIndex === stepIndex) return i;
  }
  return -1;
}

export function resolveFrameIndex(
  frames: readonly FlatFrame[],
  steps: readonly SimulationStep[],
  nav: { step: number | null; frame: number | null }
): number {
  if (nav.frame != null && nav.frame >= 1 && nav.frame <= frames.length) {
    return nav.frame - 1;
  }
  if (nav.step != null) {
    const stepIdx = steps.findIndex((s) => s.index === nav.step);
    if (stepIdx >= 0) {
      const fi = firstFrameForStep(frames, stepIdx);
      if (fi >= 0) return fi;
    }
  }
  const failed = steps.findIndex((s) => s.status === 'failed');
  if (failed >= 0) {
    const fi = firstFrameForStep(frames, failed);
    if (fi >= 0) return fi;
  }
  return frames.length > 0 ? 0 : -1;
}
