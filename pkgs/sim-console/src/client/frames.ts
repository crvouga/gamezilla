import type {
  ReportFrame,
  ReportSnapshotBlob,
  ReportStep,
  SnapshotMedia,
} from '../types';

export type FlatFrame = {
  readonly capturedAtMs: number;
  readonly durationMs: number;
  readonly stepIndex: number;
  readonly step: ReportStep;
  readonly globalIndex: number;
  readonly snapshots: readonly ReportSnapshotBlob[];
  /** Primary html/png file for the acting actor (back-compat scrubber). */
  readonly file: string | null;
};

export function flattenFrames(steps: readonly ReportStep[]): FlatFrame[] {
  const frames: FlatFrame[] = [];
  steps.forEach((step, stepIndex) => {
    for (const frame of step.frames) {
      frames.push(toFlatFrame(frame, step, stepIndex, frames.length));
    }
  });
  return frames;
}

function toFlatFrame(
  frame: ReportFrame,
  step: ReportStep,
  stepIndex: number,
  globalIndex: number
): FlatFrame {
  return {
    capturedAtMs: frame.capturedAtMs,
    durationMs: frame.durationMs ?? 0,
    stepIndex,
    step,
    globalIndex,
    snapshots: frame.snapshots,
    file: primaryUiFile(frame.snapshots, step.actorId),
  };
}

function primaryUiFile(
  snapshots: readonly ReportSnapshotBlob[],
  actorId: string | undefined
): string | null {
  const ui = snapshots.filter((s) => s.media === 'html' || s.media === 'png');
  if (ui.length === 0) return null;
  if (actorId !== undefined) {
    const match = ui.find((s) => s.nodeId === actorId);
    if (match) return match.file;
  }
  return ui[0]?.file ?? null;
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

export function formatRunUpdatedAt(
  ms: number | null | undefined
): string | null {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return null;
  try {
    return new Date(ms)
      .toISOString()
      .replace('T', ' ')
      .replace(/\.\d+Z$/, 'Z');
  } catch {
    return null;
  }
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
  _steps: readonly ReportStep[],
  nav: { readonly frame: number | null }
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

export function frameOwnedByNode(frame: FlatFrame, nodeId: string): boolean {
  if (
    frame.snapshots.some(
      (s) =>
        s.nodeId === nodeId &&
        (s.media === 'html' || s.media === 'png' || s.media === 'bytes')
    )
  ) {
    return true;
  }
  return frame.step.actorId === nodeId;
}

/**
 * Latest frame at or before `playheadIdx` owned by `nodeId`.
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

export function resolveSnapshotFile(
  frame: FlatFrame | null,
  args: {
    readonly name?: string;
    readonly media?: SnapshotMedia;
    readonly nodeId?: string | null;
  }
): string | null {
  if (frame == null) return null;
  const match = frame.snapshots.find((s) => {
    if (args.name !== undefined && s.name !== args.name) return false;
    if (args.media !== undefined && s.media !== args.media) return false;
    if (
      args.nodeId != null &&
      s.nodeId !== undefined &&
      s.nodeId !== args.nodeId
    ) {
      return false;
    }
    if (args.nodeId != null && s.nodeId === undefined) return false;
    return true;
  });
  return match?.file ?? null;
}
