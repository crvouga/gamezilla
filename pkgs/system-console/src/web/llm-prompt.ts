import type {
  SimulationReportData,
  SimulationStep,
  UiAttribution,
} from '../types';
import { testStepsKey } from '../writer/keys';
import { testFrameUrl } from './api-client';
import { type FlatFrame, flattenFrames, formatMs } from './frames';

export type LlmPromptInput = {
  readonly data: SimulationReportData;
  readonly bucketId: string;
  readonly runId: string;
  readonly selectedFrameIdx: number | null;
  readonly playheadIdx: number;
  readonly previewIdx: number;
  readonly viewerOrigin: string;
};

/** Build a compact markdown LLM debug prompt (paths only — no frame HTML). */
export function buildLlmPrompt(input: LlmPromptInput): string {
  const frames = flattenFrames(input.data.steps);
  const preview = frames[input.previewIdx] ?? null;
  return [
    roleSection(),
    testSourceSection(input.data),
    selectionSection({
      selectedFrameIdx: input.selectedFrameIdx,
      playheadIdx: input.playheadIdx,
      previewIdx: input.previewIdx,
      preview,
      bucketId: input.bucketId,
      runId: input.runId,
      testId: input.data.meta.testId,
    }),
    slowStepsSection(input.data.steps),
    attributionSection(input.data.meta.uiAttribution),
    frameCatalogSection({
      frames,
      bucketId: input.bucketId,
      runId: input.runId,
      testId: input.data.meta.testId,
    }),
    artifactMapSection({
      data: input.data,
      bucketId: input.bucketId,
      runId: input.runId,
      previewIdx: input.previewIdx,
      preview,
      viewerOrigin: input.viewerOrigin,
    }),
  ].join('\n\n');
}

function roleSection(): string {
  return [
    '# Simulation report debug context',
    '',
    'You are helping fix failing tests, bugs, or slow steps in a Gamezilla UI simulation.',
    'Open the listed frame HTML path(s) for `data-component` / `data-src` context.',
    'Prefer editing the listed source files.',
  ].join('\n');
}

function testSourceSection(data: SimulationReportData): string {
  const { meta } = data;
  return [
    '## Test source',
    '',
    `- sourceFile: ${meta.sourceFile ?? '(unknown — re-run sim after sourceFile wiring)'}`,
    `- testId: ${meta.testId}`,
    `- runId: ${meta.runId}`,
    `- seed: ${meta.seed}`,
    `- ui: ${meta.ui}`,
    `- status: ${meta.status}`,
    `- duration: ${formatMs(meta.durationMs)}`,
    `- actors: ${meta.actorIds.join(', ') || '(none)'}`,
  ].join('\n');
}

function selectionSection(args: {
  readonly selectedFrameIdx: number | null;
  readonly playheadIdx: number;
  readonly previewIdx: number;
  readonly preview: FlatFrame | null;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
}): string {
  const {
    selectedFrameIdx,
    playheadIdx,
    previewIdx,
    preview,
    bucketId,
    runId,
    testId,
  } = args;
  const step = preview?.step;
  const lines = [
    '## Selection',
    '',
    selectedFrameIdx == null
      ? `- selected frame: (none — playhead at #${playheadIdx + 1})`
      : `- selected frame: #${selectedFrameIdx + 1}`,
    `- preview / playhead frame: #${previewIdx + 1}`,
  ];
  if (preview) {
    const frameKey = `runs/${runId}/tests/${testId}/${preview.file}`;
    lines.push(
      `- frame file: ${preview.file}`,
      `- frame disk: \`system-console-data/${frameKey}\``,
      `- frame HTTP: \`${testFrameUrl(bucketId, runId, testId, preview.file)}\``,
      `- frame duration: ${formatMs(preview.durationMs)}`
    );
  }
  if (step) {
    lines.push(
      `- step: #${step.index} ${step.kind} — ${step.title}`,
      `- step status: ${step.status}`,
      `- step duration: ${formatMs(step.durationMs)}`,
      `- actor: ${step.actorId}`
    );
    if (step.selector) lines.push(`- selector: ${step.selector}`);
    if (step.detail) lines.push(`- detail: ${step.detail}`);
    if (step.error) lines.push(`- error: ${step.error}`);
  }
  return lines.join('\n');
}

function slowStepsSection(steps: readonly SimulationStep[]): string {
  const ranked = [...steps]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 8);
  const lines = ['## Slow steps (by duration)', ''];
  if (ranked.length === 0) {
    lines.push('(no steps)');
    return lines.join('\n');
  }
  for (const step of ranked) {
    lines.push(
      `- #${step.index} ${step.kind} ${formatMs(step.durationMs)} — ${step.title} [${step.status}]`
    );
  }
  return lines.join('\n');
}

function attributionSection(attr: UiAttribution | undefined): string {
  const lines = ['## UI attribution', ''];
  if (!attr) {
    lines.push(
      '(none yet — re-run the simulation after data-src / attribution wiring)'
    );
    return lines.join('\n');
  }
  lines.push('### data-component counts');
  const components = Object.entries(attr.components).sort(
    (a, b) => b[1] - a[1]
  );
  if (components.length === 0) lines.push('(none)');
  else {
    for (const [name, count] of components.slice(0, 40)) {
      lines.push(`- ${name}: ${count}`);
    }
  }
  lines.push('', '### data-src locations');
  const sources = Object.entries(attr.sources).sort(
    (a, b) => b[1].count - a[1].count
  );
  if (sources.length === 0) lines.push('(none)');
  else {
    for (const [src, info] of sources.slice(0, 60)) {
      const comps =
        info.components.length > 0 ? ` (${info.components.join(', ')})` : '';
      lines.push(`- ${src}: ${info.count}${comps}`);
    }
  }
  return lines.join('\n');
}

function frameCatalogSection(args: {
  readonly frames: readonly FlatFrame[];
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
}): string {
  const { frames, runId, testId } = args;
  const lines = ['## Frame catalog', ''];
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]!;
    const disk = `system-console-data/runs/${runId}/tests/${testId}/${frame.file}`;
    lines.push(
      `- #${i + 1} s${frame.step.index} ${frame.step.kind} ${formatMs(frame.durationMs)} — \`${disk}\``
    );
  }
  return lines.join('\n');
}

function artifactMapSection(args: {
  readonly data: SimulationReportData;
  readonly bucketId: string;
  readonly runId: string;
  readonly previewIdx: number;
  readonly preview: FlatFrame | null;
  readonly viewerOrigin: string;
}): string {
  const { data, bucketId, runId, previewIdx, preview, viewerOrigin } = args;
  const testId = data.meta.testId;
  const stepsKey = testStepsKey(runId, testId);
  const frameQuery =
    previewIdx >= 0
      ? `?frame=${previewIdx + 1}&step=${preview?.step.index ?? ''}`
      : '';
  const viewerPath = `/b/${encodeURIComponent(bucketId)}/r/${encodeURIComponent(runId)}/t/${encodeURIComponent(testId)}${frameQuery}`;
  return [
    '## Artifact map',
    '',
    `- steps.json: \`system-console-data/${stepsKey}\``,
    `- viewer URL: ${viewerOrigin.replace(/\/$/, '')}${viewerPath}`,
    '',
    'Read the selected frame HTML from disk (path above) — do not expect HTML inline in this prompt.',
  ].join('\n');
}
