/**
 * The pooled encoding of a report's data, for reports too big to inline as
 * one JSON document (every snapshot of hundreds of tests).
 *
 * A snapshot is a whole HTML document, and consecutive frames of a scenario
 * repeat most of their panels, so the same body recurs thousands of times:
 * the encoding keeps each distinct body once (the pool) and points at it
 * (`ref`), then gzips the pool in chunks. The browser inflates one chunk at a
 * time and hands the viewer the same data the plain encoding would have, so a
 * chunk never has to fit in one huge JSON string.
 */
import { gzipSync } from 'node:zlib';
import type { HtmlReportBlob } from '@pkgs/harness';
import type { ReportData } from './types';

/** A blob that points into the pool instead of holding its body. */
type PooledBlob = {
  readonly contentType: string;
  readonly ref: number;
  /** The pool entry is base64 (binary media) rather than text. */
  readonly base64: boolean;
};

export type Pooled = {
  /** The report data with every blob body replaced by a pool reference. */
  readonly meta: unknown;
  /** Gzipped, base64-encoded JSON arrays of pool entries, in pool order. */
  readonly chunks: readonly string[];
};

/** Raw bytes of pool entries per gzip chunk. */
const CHUNK_BYTES = 4_000_000;

function bodyOf(blob: HtmlReportBlob): { body: string; base64: boolean } {
  return blob.text !== undefined
    ? { body: blob.text, base64: false }
    : { body: blob.base64 ?? '', base64: true };
}

export function poolReport(data: ReportData): Pooled {
  const refs = new Map<string, number>();
  const pool: string[] = [];
  const tests = data.tests.map((test) => ({
    ...test,
    blobs: Object.fromEntries(
      Object.entries(test.blobs).map(([file, blob]): [string, PooledBlob] => {
        const { body, base64 } = bodyOf(blob);
        let ref = refs.get(body);
        if (ref === undefined) {
          ref = pool.length;
          refs.set(body, ref);
          pool.push(body);
        }
        return [file, { contentType: blob.contentType, ref, base64 }];
      })
    ),
  }));
  return { meta: { ...data, tests }, chunks: gzipChunks(pool) };
}

function gzipChunks(pool: readonly string[]): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  let bytes = 0;
  const flush = (): void => {
    if (current.length === 0) return;
    chunks.push(gzipSync(JSON.stringify(current)).toString('base64'));
    current = [];
    bytes = 0;
  };
  for (const body of pool) {
    current.push(body);
    bytes += body.length;
    if (bytes >= CHUNK_BYTES) flush();
  }
  flush();
  return chunks;
}

/**
 * Runs in the page after the viewer bundle has defined `<harness-report>`:
 * inflates the pool chunk by chunk, puts every body back where a blob points,
 * and mounts the element with the data set (the element reads `data` before
 * it looks for a `report-data` script).
 */
export const POOLED_BOOTSTRAP = `
(async () => {
  const status = document.getElementById('report-loading');
  try {
    const meta = JSON.parse(document.getElementById('report-data').textContent);
    const pool = [];
    for (const chunk of document.querySelectorAll('script.report-chunk')) {
      const text = atob(chunk.textContent);
      const bytes = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
      const inflated = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      for (const body of await new Response(inflated).json()) pool.push(body);
      chunk.remove();
    }
    for (const test of meta.tests) {
      for (const [file, blob] of Object.entries(test.blobs)) {
        const body = pool[blob.ref];
        test.blobs[file] = blob.base64
          ? { contentType: blob.contentType, base64: body }
          : { contentType: blob.contentType, text: body };
      }
    }
    const element = document.createElement('harness-report');
    element.data = meta;
    status?.remove();
    document.body.append(element);
  } catch (error) {
    if (status) status.textContent = 'harness-report: cannot open this report: ' + String(error);
    throw error;
  }
})();
`;
