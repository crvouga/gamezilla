import { describe, expect, test } from 'bun:test';
import {
  isNdjsonFrame,
  NdjsonStreamDecoder,
} from '@pkgs/ndjson-shared-ts/decode';
import { encodeNdjsonFrame } from '@pkgs/ndjson-shared-ts/encode';
import type { NdjsonFrame } from '@pkgs/ndjson-shared-ts/frames';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { arbNdjsonFrame, splitBytes } from './ndjson-frame-arbitraries';

function decodeChunks(chunks: Uint8Array[]): NdjsonFrame[] {
  const decoder = new NdjsonStreamDecoder();
  const out: NdjsonFrame[] = [];
  chunks.forEach((chunk, i) => {
    out.push(...decoder.push(chunk, i === chunks.length - 1));
  });
  out.push(...decoder.push(new Uint8Array(0), true));
  return out;
}

function decodeText(text: string, cuts: number[] = []): NdjsonFrame[] {
  return decodeChunks(splitBytes(new TextEncoder().encode(text), cuts));
}

const arbFrames = fc.array(arbNdjsonFrame(), { maxLength: 6 });
const arbCuts = fc.array(fc.nat({ max: 400 }), { maxLength: 8 });

describe('encodeNdjsonFrame', () => {
  test('every encoded frame is one SSE data event holding a recognised frame', () => {
    assertProperty(
      'encode emits `data: <json>\\n\\n` and the json is a frame',
      fc.property(arbNdjsonFrame(), (frame) => {
        const event = encodeNdjsonFrame(frame);
        expect(event.startsWith('data: ')).toBe(true);
        expect(event.endsWith('\n\n')).toBe(true);
        expect(event.slice(0, -2).includes('\n')).toBe(false);
        const parsed: unknown = JSON.parse(event.slice('data: '.length));
        expect(isNdjsonFrame(parsed)).toBe(true);
        expect(parsed).toEqual(frame);
      })
    );
  });
});

describe('NdjsonStreamDecoder', () => {
  test('decode ∘ encode = id under any chunking (incl. mid-codepoint cuts)', () => {
    assertProperty(
      'round-trip under chunk splits',
      fc.property(arbFrames, arbCuts, (frames, cuts) => {
        const text = frames.map((f) => encodeNdjsonFrame(f)).join('');
        expect(decodeText(text, cuts)).toEqual(frames);
      })
    );
  });

  test('CRLF line endings, comments and blank lines do not change the frames', () => {
    assertProperty(
      'SSE framing noise is ignored',
      fc.property(
        arbFrames,
        fc.array(fc.constantFrom('', ': keep-alive', ':', '   '), {
          maxLength: 6,
        }),
        fc.boolean(),
        arbCuts,
        (frames, noise, crlf, cuts) => {
          const lines: string[] = [];
          frames.forEach((frame, i) => {
            lines.push(noise[i % Math.max(1, noise.length)] ?? '');
            lines.push(`data: ${JSON.stringify(frame)}`, '');
          });
          const text = lines.join(crlf ? '\r\n' : '\n');
          expect(decodeText(text, cuts)).toEqual(frames);
        }
      )
    );
  });

  test('bare JSON lines (no `data:` prefix) and an unterminated last line decode', () => {
    assertProperty(
      'NDJSON lines decode like SSE events',
      fc.property(arbFrames, (frames) => {
        const text = frames.map((f) => JSON.stringify(f)).join('\n');
        expect(decodeText(text)).toEqual(frames);
      })
    );
  });

  test('a JSON value that is not a frame is refused', () => {
    assertProperty(
      'non-frame payload ⇒ throws',
      fc.property(
        fc.oneof(
          fc.jsonValue().filter((v) => !isNdjsonFrame(v)),
          fc.record({
            frame: fc.constantFrom('result', 'error', 'other'),
            index: fc.string(),
          })
        ),
        (value) => {
          expect(() => decodeText(`data: ${JSON.stringify(value)}\n`)).toThrow(
            /unrecognized frame shape/
          );
        }
      )
    );
  });
});
