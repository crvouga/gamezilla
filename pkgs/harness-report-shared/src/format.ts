import type { HtmlReportTest } from '@pkgs/harness-shared/bundle';
import type { ReportSnapshotBlob } from '@pkgs/harness-shared/report-types';

import { blobDataUrl, blobText } from './frames';

export function fmtMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export function fmtDate(ms: number): string {
  if (!ms) return '';
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

export function fileName(path: string | undefined): string {
  return path ? (path.split('/').pop() ?? '') : '';
}

export function fileLabel(sourceFile: string | undefined): string {
  return sourceFile ? fileName(sourceFile) : 'Other';
}

function formatArg(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  try {
    const text = JSON.stringify(value);
    if (text === undefined) return '?';
    return text.length > 72 ? `${text.slice(0, 69)}…` : text;
  } catch {
    return '?';
  }
}

/** Compact `arg, arg` for an action line. Empty when the step recorded none. */
export function formatArgs(args: readonly unknown[] | undefined): string {
  if (args === undefined || args.length === 0) return '';
  return args.map(formatArg).join(', ');
}

/** `action(args)`, or the step title when the step is not an action. */
export function actionLabel(step: {
  readonly action?: string | undefined;
  readonly args?: readonly unknown[] | undefined;
  readonly title: string;
}): string {
  if (step.action === undefined || step.action === '') return step.title;
  return `${step.action}(${formatArgs(step.args)})`;
}

export function formatBlobBody(
  test: HtmlReportTest,
  blob: ReportSnapshotBlob
): string {
  if (blob.media === 'bytes') {
    const bin = test.blobs[blob.file];
    const n = bin?.base64 ? Math.floor(bin.base64.length * 0.75) : 0;
    return `(binary ${fileName(blob.file)}${n ? `, ~${n} bytes` : ''})`;
  }
  const text = blobText(test, blob);
  if (text === null) return '(missing)';
  if (blob.media === 'json') {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }
  return text;
}

export function blobHeading(blob: ReportSnapshotBlob): string {
  return `${blob.name}${blob.nodeId ? ` · ${blob.nodeId}` : ''} · ${blob.media}`;
}

export function downloadUrl(
  test: HtmlReportTest,
  blob: ReportSnapshotBlob
): string | null {
  return blobDataUrl(test, blob);
}
