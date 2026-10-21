/**
 * The framing of the PostgreSQL wire protocol, and nothing else: enough to see
 * where one message ends, what kind it is, and what a statement says. The
 * database link forwards every byte untouched.
 */

export type Frame = { readonly tag: number | null; readonly bytes: Buffer };

export const SSL_REQUEST = 80_877_103;
export const GSS_REQUEST = 80_877_104;
export const CANCEL_REQUEST = 80_877_102;
export const TAG = {
  query: 0x51, // Q
  parse: 0x50, // P
  sync: 0x53, // S
  terminate: 0x58, // X
  readyForQuery: 0x5a, // Z
} as const;
/** ReadyForQuery's status byte for a connection outside any transaction. */
export const IDLE = 0x49; // I
/** The server's one-byte answer to an SSLRequest that agrees to encrypt. */
export const SSL_ACCEPTED = 0x53; // S

export type FrameReader = {
  /** The next `count` bytes are not framed (the server's answer to SSLRequest). */
  expectRaw(count: number): void;
  push(chunk: Buffer): Frame[];
};

/** Reassembles protocol frames from a byte stream. */
export function createFrameReader(clientSide: boolean): FrameReader {
  let buffer: Buffer = Buffer.alloc(0);
  /** The client's first messages carry no tag byte. */
  let untagged = clientSide;
  let rawBytes = 0;

  const takeRaw = (): Frame => {
    const take = Math.min(rawBytes, buffer.length);
    const bytes = buffer.subarray(0, take);
    buffer = buffer.subarray(take);
    rawBytes -= take;
    return { tag: null, bytes };
  };

  const takeFrame = (): Frame | null => {
    const headerLength = untagged ? 4 : 5;
    if (buffer.length < headerLength) return null;
    const length = buffer.readInt32BE(untagged ? 0 : 1);
    const total = untagged ? length : length + 1;
    if (buffer.length < total) return null;
    const bytes = buffer.subarray(0, total);
    buffer = buffer.subarray(total);
    if (!untagged) return { tag: bytes[0] ?? null, bytes };
    const code = bytes.length >= 8 ? bytes.readInt32BE(4) : 0;
    // An SSL or GSS request is followed by the real startup message.
    if (code !== SSL_REQUEST && code !== GSS_REQUEST) untagged = false;
    return { tag: null, bytes };
  };

  return {
    expectRaw(count) {
      rawBytes = count;
    },
    push(chunk) {
      buffer = Buffer.concat([buffer, chunk]);
      const frames: Frame[] = [];
      for (;;) {
        if (rawBytes > 0 && buffer.length === 0) break;
        const frame = rawBytes > 0 ? takeRaw() : takeFrame();
        if (frame === null) break;
        frames.push(frame);
      }
      return frames;
    },
  };
}

function cString(buffer: Buffer, from: number): { text: string; end: number } {
  const end = buffer.indexOf(0, from);
  const stop = end < 0 ? buffer.length : end;
  return { text: buffer.toString('utf8', from, stop), end: stop + 1 };
}

/** The statement text of a Query or Parse message. */
export function statementOf(frame: Frame): string | null {
  if (frame.tag === TAG.query) return cString(frame.bytes, 5).text;
  if (frame.tag === TAG.parse) {
    const name = cString(frame.bytes, 5);
    return cString(frame.bytes, name.end).text;
  }
  return null;
}

/** A FATAL ErrorResponse with SQLSTATE 58000, as Hyperdrive answers a full pool. */
export function fatalPoolError(message: string): Buffer {
  const field = (code: string, text: string) =>
    Buffer.concat([Buffer.from(code + text), Buffer.from([0])]);
  const body = Buffer.concat([
    field('S', 'FATAL'),
    field('V', 'FATAL'),
    field('C', '58000'),
    field('M', message),
    Buffer.from([0]),
  ]);
  const head = Buffer.alloc(5);
  head[0] = 0x45; // E
  head.writeInt32BE(body.length + 4, 1);
  return Buffer.concat([head, body]);
}
