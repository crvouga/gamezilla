import type {
  NdjsonEndFrame,
  NdjsonErrorFrame,
  NdjsonFrame,
  NdjsonResultFrame,
} from './frames';

function isResultFrame(o: Record<string, unknown>): o is NdjsonResultFrame {
  return (
    o['frame'] === 'result' && typeof o['index'] === 'number' && 'result' in o
  );
}

function isErrorFrame(o: Record<string, unknown>): o is NdjsonErrorFrame {
  return (
    o['frame'] === 'error' &&
    typeof o['index'] === 'number' &&
    typeof o['status'] === 'number' &&
    typeof o['message'] === 'string'
  );
}

function isEndFrame(o: Record<string, unknown>): o is NdjsonEndFrame {
  return o['frame'] === 'end';
}

/**
 * Structural type guard for any NDJSON frame shape. Generic in the
 * `result` payload — callers narrow further with their own validators.
 */
export function isNdjsonFrame(raw: unknown): raw is NdjsonFrame {
  if (raw === null || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  return isResultFrame(o) || isErrorFrame(o) || isEndFrame(o);
}

function parseNdjsonLine(line: string): NdjsonFrame | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;
  const parsed: unknown = JSON.parse(trimmed);
  if (!isNdjsonFrame(parsed)) {
    throw new Error(
      `ndjson: unrecognized frame shape: ${trimmed.slice(0, 120)}`
    );
  }
  return parsed;
}

/**
 * Streaming line decoder. Buffers partial chunks across {@link push}
 * calls and yields complete frames as soon as a newline arrives.
 */
export class NdjsonStreamDecoder {
  private buffer = '';
  private readonly decoder = new TextDecoder('utf-8');

  /**
   * Feed one binary chunk and return any complete frames it produced.
   * `final=true` flushes a trailing line without a newline (the producer
   * always terminates lines, but a partial final line is still valid
   * JSON we should accept).
   */
  push(chunk: Uint8Array, final = false): NdjsonFrame[] {
    this.buffer += this.decoder.decode(chunk, { stream: !final });
    const frames: NdjsonFrame[] = [];
    let nl = this.buffer.indexOf('\n');
    while (nl >= 0) {
      const line = this.buffer.slice(0, nl);
      this.buffer = this.buffer.slice(nl + 1);
      const f = parseNdjsonLine(line);
      if (f !== null) frames.push(f);
      nl = this.buffer.indexOf('\n');
    }
    if (final && this.buffer.length > 0) {
      const f = parseNdjsonLine(this.buffer);
      this.buffer = '';
      if (f !== null) frames.push(f);
    }
    return frames;
  }
}
