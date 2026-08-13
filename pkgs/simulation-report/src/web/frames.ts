import type {
  SimulationFrame,
  SimulationFrameAttribute,
  SimulationFrameDatabase,
  SimulationFrameView,
  SimulationStep,
} from '../types';

export type FlatFrame = {
  readonly file: string;
  readonly capturedAtMs: number;
  readonly durationMs: number;
  readonly stepIndex: number;
  readonly step: SimulationStep;
  readonly globalIndex: number;
  readonly databases?: readonly SimulationFrameDatabase[];
  readonly views?: readonly SimulationFrameView[];
  readonly attributes?: readonly SimulationFrameAttribute[];
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
        ...(frame.databases !== undefined
          ? { databases: frame.databases }
          : {}),
        ...(frame.views !== undefined ? { views: frame.views } : {}),
        ...(frame.attributes !== undefined
          ? { attributes: frame.attributes }
          : {}),
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

/**
 * Fixed-width duration for transport / rail so "6ms" and "13.35s" don't
 * shift layout. Uses tabular figures; pad to the longest common form.
 */
export function formatMsStable(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—.——s';
  if (ms < 1000) return `${Math.round(ms)}ms`.padStart(6, '\u2007');
  return `${(ms / 1000).toFixed(2)}s`.padStart(6, '\u2007');
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

/** Explicit selection from URL only; null when nothing is selected. */
export function resolveSelectedFrameIndex(
  frames: readonly FlatFrame[],
  steps: readonly SimulationStep[],
  nav: { step: number | null; frame: number | null }
): number | null {
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
  return null;
}

/** Playhead when nothing is selected: start of timeline (0). */
export function playheadFrameIndex(
  selectedIdx: number | null,
  frameCount: number
): number {
  if (frameCount <= 0) return -1;
  if (selectedIdx != null && selectedIdx >= 0 && selectedIdx < frameCount) {
    return selectedIdx;
  }
  return 0;
}
