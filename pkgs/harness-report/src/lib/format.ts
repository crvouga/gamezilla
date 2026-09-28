import type { HtmlReportTest, ReportSnapshotBlob } from '@pkgs/harness';

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
