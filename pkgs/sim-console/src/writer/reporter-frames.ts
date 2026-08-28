import type { ObjectStore } from '@pkgs/object-store/interface';

import type {
  SimulationFrame,
  SimulationFrameView,
  SimulationReportData,
  SimulationReportEvent,
  SimulationReportMeta,
  SimulationReportTopology,
  SimulationStep,
  SimulationStepKind,
  SimulationStepStatus,
} from '../types';
import { buildFrameAttributes } from './frame-attributes';
import {
  type SnapshotCheckpointMeta,
  writeFrameCheckpoint,
} from './frame-checkpoint';
import {
  type SnapshotDatabaseNode,
  writeFrameDatabaseBlobs,
} from './frame-databases';
import {
  pickPrimaryViewFile,
  type SnapshotViewNode,
  writeFrameViewBlobs,
} from './frame-views';
import { testFrameKey } from './keys';
import { padFrame } from './reporter-helpers';
import { storePutText } from './store-io';
import {
  freezeUiAttribution,
  type MutableUiAttribution,
  mergeFrameHtmlAttribution,
} from './ui-attribution';

export async function writeReporterFrame(args: {
  readonly store: ObjectStore;
  readonly runId: string;
  readonly testId: string;
  readonly frameSeq: number;
  readonly html: string;
  readonly currentActorId: string | undefined;
  readonly now: () => number;
  readonly attribution: MutableUiAttribution;
  readonly writtenDbBlobs: Map<string, string>;
  /** nodeId → last non-blank HTML (parked clients carry forward). */
  readonly lastGoodHtml: Map<string, string>;
  readonly snapshotViews?: () => Promise<readonly SnapshotViewNode[]>;
  readonly snapshotDatabases?: () => Promise<readonly SnapshotDatabaseNode[]>;
  readonly snapshotCheckpoint?: () =>
    | SnapshotCheckpointMeta
    | Promise<SnapshotCheckpointMeta>;
  readonly snapshotEvents?: () => readonly SimulationReportEvent[];
}): Promise<SimulationFrame> {
  const views = await writeFrameViewBlobs({
    store: args.store,
    runId: args.runId,
    testId: args.testId,
    frameSeq: args.frameSeq,
    padFrame,
    lastGoodHtml: args.lastGoodHtml,
    ...(args.snapshotViews !== undefined
      ? { snapshotViews: args.snapshotViews }
      : {}),
    onHtml: (viewHtml) => mergeFrameHtmlAttribution(args.attribution, viewHtml),
  });
  const primaryFromViews = pickPrimaryViewFile(
    views as SimulationFrameView[] | undefined,
    args.currentActorId
  );
  const file = primaryFromViews ?? `frames/f-${padFrame(args.frameSeq)}.html`;
  if (primaryFromViews === undefined) {
    const key = testFrameKey(args.runId, args.testId, file);
    await storePutText(args.store, key, args.html, 'text/html; charset=utf-8');
    mergeFrameHtmlAttribution(args.attribution, args.html);
  }
  const databases = await writeFrameDatabaseBlobs({
    store: args.store,
    runId: args.runId,
    testId: args.testId,
    writtenDbBlobs: args.writtenDbBlobs,
    ...(args.snapshotDatabases !== undefined
      ? { snapshotDatabases: args.snapshotDatabases }
      : {}),
  });
  const checkpoint = await writeFrameCheckpoint({
    store: args.store,
    runId: args.runId,
    testId: args.testId,
    frameSeq: args.frameSeq,
    ...(args.snapshotCheckpoint !== undefined
      ? { snapshotCheckpoint: args.snapshotCheckpoint }
      : {}),
  });
  const attributes = buildFrameAttributes({
    views,
    databases,
    events: args.snapshotEvents?.() ?? [],
    capturedAtMs: args.now(),
  });
  return {
    file,
    capturedAtMs: args.now(),
    ...(databases !== undefined ? { databases } : {}),
    ...(views !== undefined ? { views } : {}),
    ...(attributes.length > 0 ? { attributes } : {}),
    ...(checkpoint !== undefined ? { checkpoint } : {}),
  };
}

export function buildReporterStep(args: {
  readonly index: number;
  readonly actorId: string;
  readonly kind: SimulationStepKind;
  readonly title: string;
  readonly selector?: string;
  readonly detail?: string;
  readonly status: SimulationStepStatus;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly error?: string;
  readonly snapshotFile?: string;
  readonly frames: readonly SimulationFrame[];
}): SimulationStep {
  return {
    index: args.index,
    actorId: args.actorId,
    kind: args.kind,
    title: args.title,
    ...(args.selector !== undefined ? { selector: args.selector } : {}),
    ...(args.detail !== undefined ? { detail: args.detail } : {}),
    status: args.status,
    startedAtMs: args.startedAtMs,
    endedAtMs: args.endedAtMs,
    durationMs: Math.max(0, args.endedAtMs - args.startedAtMs),
    ...(args.error !== undefined ? { error: args.error } : {}),
    ...(args.snapshotFile !== undefined
      ? { snapshotFile: args.snapshotFile }
      : {}),
    frames: args.frames,
  };
}

export function buildReporterData(args: {
  readonly seed: string;
  readonly ui: string;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly actorIds: ReadonlySet<string>;
  readonly runId: string;
  readonly testId: string;
  readonly sourceFile: string | undefined;
  readonly attribution: MutableUiAttribution;
  readonly snapshotTopology?: () => SimulationReportTopology;
  readonly steps: readonly SimulationStep[];
}): SimulationReportData {
  const status: SimulationStepStatus = args.steps.some(
    (s) => s.status === 'failed'
  )
    ? 'failed'
    : 'passed';
  const attribution = freezeUiAttribution(args.attribution);
  const topology = args.snapshotTopology?.();
  const meta: SimulationReportMeta = {
    seed: args.seed,
    ui: args.ui,
    startedAtMs: args.startedAtMs,
    endedAtMs: args.endedAtMs,
    durationMs: Math.max(0, args.endedAtMs - args.startedAtMs),
    status,
    actorIds: [...args.actorIds],
    runId: args.runId,
    testId: args.testId,
    ...(args.sourceFile !== undefined ? { sourceFile: args.sourceFile } : {}),
    ...(Object.keys(attribution.components).length > 0 ||
    Object.keys(attribution.sources).length > 0
      ? { uiAttribution: attribution }
      : {}),
    ...(topology?.fuzz !== undefined ? { fuzz: topology.fuzz } : {}),
  };
  return { meta, steps: [...args.steps] };
}
