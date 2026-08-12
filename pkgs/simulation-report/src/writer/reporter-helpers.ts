import type {
  SimulationFrame,
  SimulationReportData,
  SimulationStep,
  SimulationStepKind,
} from '../types';

export type FrameCaptureState = {
  frames: SimulationFrame[];
  lastHash: string;
};

export function shouldPollKind(kind: SimulationStepKind): boolean {
  return kind === 'waitFor' || kind === 'step';
}

export function assignFrameDurations(
  steps: readonly SimulationStep[]
): SimulationStep[] {
  return steps.map((step) => {
    const frames = step.frames ?? [];
    if (frames.length === 0) return step;
    const withDurations = frames.map((frame, i) => {
      const next = frames[i + 1];
      const end = next?.capturedAtMs ?? step.endedAtMs;
      return {
        ...frame,
        durationMs: Math.max(0, end - frame.capturedAtMs),
      };
    });
    return { ...step, frames: withDurations };
  });
}

export function padFrame(index: number): string {
  return String(index).padStart(5, '0');
}

/** Fast non-crypto content hash for change-gating identical frames. */
export function hashString(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function stripSnapshots(data: SimulationReportData): unknown {
  return {
    meta: data.meta,
    steps: data.steps.map((step) => {
      const { snapshotHtml: _html, ...rest } = step;
      return rest;
    }),
  };
}
