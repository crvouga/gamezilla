/**
 * NDJSON framing helpers for the streaming `/patches/read` wire format.
 *
 * Each request returns one of three frame kinds, one per line, terminated
 * by `\n`:
 *
 * ```
 * {"frame":"result","index":0,"result":{...}}\n
 * {"frame":"result","index":2,"result":{...}}\n
 * {"frame":"error","index":1,"status":500,"message":"..."}\n
 * {"frame":"end"}\n
 * ```
 *
 * The handler emits results in completion order (not request order); the
 * client uses `index` to put each slice back in its original position. The
 * stream MUST always finish with a single `end` frame so the consumer can
 * differentiate a graceful close from a truncated transport (network
 * blip, edge cancellation, etc.). Missing-`end` is treated as an error by
 * the client decoder.
 *
 * Per-query errors are emitted inline as `error` frames so that one slow /
 * forbidden query does not poison faster siblings; the consumer surfaces
 * each error in the same slot as its `result` would have occupied.
 */

export const NDJSON_CONTENT_TYPE = 'application/x-ndjson';

export type NdjsonReadResultFrame = {
  readonly frame: 'result';
  readonly index: number;
  readonly result: unknown;
};

export type NdjsonReadErrorFrame = {
  readonly frame: 'error';
  readonly index: number;
  readonly status: number;
  readonly message: string;
};

export type NdjsonReadEndFrame = {
  readonly frame: 'end';
};

export type NdjsonReadFrame =
  | NdjsonReadResultFrame
  | NdjsonReadErrorFrame
  | NdjsonReadEndFrame;

export function encodeNdjsonFrame(frame: NdjsonReadFrame): string {
  return `${JSON.stringify(frame)}\n`;
}

function parseNdjsonLine(line: string): NdjsonReadFrame | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;
  const parsed: unknown = JSON.parse(trimmed);
  if (!isNdjsonFrame(parsed)) {
    throw new Error(
      `patch-db ndjson: unrecognized frame shape: ${trimmed.slice(0, 120)}`
    );
  }
  return parsed;
}

function isResultFrame(o: Record<string, unknown>): o is NdjsonReadResultFrame {
  return (
    o['frame'] === 'result' &&
    typeof o['index'] === 'number' &&
    'result' in o
  );
}

function isErrorFrame(o: Record<string, unknown>): o is NdjsonReadErrorFrame {
  return (
    o['frame'] === 'error' &&
    typeof o['index'] === 'number' &&
    typeof o['status'] === 'number' &&
    typeof o['message'] === 'string'
  );
}

function isEndFrame(o: Record<string, unknown>): o is NdjsonReadEndFrame {
  return o['frame'] === 'end';
}

export function isNdjsonFrame(raw: unknown): raw is NdjsonReadFrame {
  if (raw === null || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  return isResultFrame(o) || isErrorFrame(o) || isEndFrame(o);
}

/**
 * Streaming line decoder. Buffers partial chunks across `push` calls and
 * yields complete frames as soon as a newline arrives.
 */
export class NdjsonStreamDecoder {
  private buffer = '';
  private readonly decoder = new TextDecoder('utf-8');

  /**
   * Feed one binary chunk and return any complete frames it produced.
   * `final=true` flushes any trailing line without a newline (the server
   * always terminates lines, but a partial final line is still valid JSON
   * we should accept).
   */
  push(chunk: Uint8Array, final = false): NdjsonReadFrame[] {
    this.buffer += this.decoder.decode(chunk, { stream: !final });
    const frames: NdjsonReadFrame[] = [];
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
