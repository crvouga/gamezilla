import type {
  SimulationFrame,
  SimulationFrameAttribute,
  SimulationFrameCheckpoint,
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
  readonly checkpoint?: SimulationFrameCheckpoint;
};

export function flattenFrames(steps: readonly SimulationStep[]): FlatFrame[] {
  const frames: FlatFrame[] = [];
  steps.forEach((step, stepIndex) => {
    for (const frame of framesForStep(step)) {
      frames.push(toFlatFrame(frame, step, stepIndex, frames.length));
    }
  });
  return frames;
}

function framesForStep(step: SimulationStep): SimulationFrame[] {
  if (step.frames && step.frames.length > 0) return [...step.frames];
  if (step.snapshotFile) {
    return [
      {
        file: step.snapshotFile,
        capturedAtMs: step.endedAtMs || step.startedAtMs || 0,
        durationMs: step.durationMs || 0,
      },
    ];
  }
  return [];
}

function toFlatFrame(
  frame: SimulationFrame,
  step: SimulationStep,
  stepIndex: number,
  globalIndex: number
): FlatFrame {
  return {
    file: frame.file,
    capturedAtMs: frame.capturedAtMs,
    durationMs: frame.durationMs ?? 0,
    stepIndex,
    step,
    globalIndex,
    ...(frame.databases !== undefined ? { databases: frame.databases } : {}),
    ...(frame.views !== undefined ? { views: frame.views } : {}),
    ...(frame.attributes !== undefined ? { attributes: frame.attributes } : {}),
    ...(frame.checkpoint !== undefined ? { checkpoint: frame.checkpoint } : {}),
  };
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
  _steps: readonly SimulationStep[],
  nav: { frame: number | null }
): number | null {
  if (nav.frame != null && nav.frame >= 1 && nav.frame <= frames.length) {
    return nav.frame - 1;
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

/**
 * Whether this frame carries content for `nodeId` (views / attributes /
 * databases) or was captured under that actor (legacy single-file dumps).
 */
export function frameOwnedByNode(frame: FlatFrame, nodeId: string): boolean {
  if (frame.views?.some((v) => v.nodeId === nodeId)) return true;
  if (
    frame.attributes?.some(
      (a) => a.nodeId === nodeId && (a.kind === 'html' || a.kind === 'sqlite')
    )
  ) {
    return true;
  }
  if (frame.databases?.some((d) => d.nodeId === nodeId)) return true;
  return frame.step.actorId === nodeId;
}

/**
 * Latest frame at or before `playheadIdx` owned by `nodeId`.
 * Used so parked clients keep their last snapshot while the playhead
 * advances through another actor's frames.
 */
export function resolveFrameForNode(
  frames: readonly FlatFrame[],
  playheadIdx: number,
  nodeId: string
): FlatFrame | null {
  if (frames.length === 0 || playheadIdx < 0) return null;
  const end = Math.min(playheadIdx, frames.length - 1);
  for (let i = end; i >= 0; i--) {
    const frame = frames[i]!;
    if (frameOwnedByNode(frame, nodeId)) return frame;
  }
  return null;
}
