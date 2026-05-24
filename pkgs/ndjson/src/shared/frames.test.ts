import { describe, expect, test } from 'bun:test';
import { encodeNdjsonFrame } from './encode';
import { NdjsonStreamDecoder, isNdjsonFrame } from './decode';
import type { NdjsonFrame } from './frames';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

describe('encodeNdjsonFrame', () => {
  test('terminates each frame as one SSE event', () => {
    const line = encodeNdjsonFrame({
      frame: 'result',
      index: 0,
      result: { foo: 'bar' },
    });
    expect(line.startsWith('data: ')).toBe(true);
    expect(line.endsWith('\n\n')).toBe(true);
  });

  test('emits valid JSON in the data field', () => {
    const line = encodeNdjsonFrame({ frame: 'end' });
    const body = line.slice('data: '.length, -2);
    expect(() => JSON.parse(body)).not.toThrow();
  });
});

describe('isNdjsonFrame', () => {
  test('accepts the three frame kinds', () => {
    expect(isNdjsonFrame({ frame: 'result', index: 0, result: {} })).toBe(true);
    expect(
      isNdjsonFrame({
        frame: 'error',
        index: 1,
        status: 500,
        message: 'x',
      })
    ).toBe(true);
    expect(isNdjsonFrame({ frame: 'end' })).toBe(true);
  });

  test('rejects unknown shapes', () => {
    expect(isNdjsonFrame(null)).toBe(false);
    expect(isNdjsonFrame({ frame: 'unknown' })).toBe(false);
    expect(isNdjsonFrame({ frame: 'result' })).toBe(false);
    expect(isNdjsonFrame({ frame: 'result', index: 'no' })).toBe(false);
    expect(isNdjsonFrame({ frame: 'error', index: 0, status: 500 })).toBe(
      false
    );
  });
});

describe('NdjsonStreamDecoder', () => {
  test('decodes a single frame in one chunk', () => {
    const d = new NdjsonStreamDecoder();
    const frames = d.push(
      enc('data: {"frame":"result","index":0,"result":{"k":1}}\n\n')
    );
    expect(frames.length).toBe(1);
    expect(frames[0]?.frame).toBe('result');
  });

  test('decodes multiple frames in one chunk', () => {
    const d = new NdjsonStreamDecoder();
    const payload =
      'data: {"frame":"result","index":0,"result":{}}\n\n' +
      'data: {"frame":"result","index":1,"result":{}}\n\n' +
      'data: {"frame":"end"}\n\n';
    const frames = d.push(enc(payload));
    expect(frames.length).toBe(3);
    expect((frames[2] as NdjsonFrame).frame).toBe('end');
  });

  test('buffers partial chunks across pushes', () => {
    const d = new NdjsonStreamDecoder();
    const first = d.push(enc('data: {"frame":"result","index":0,'));
    expect(first.length).toBe(0);
    const second = d.push(
      enc('"result":{"a":1}}\n\ndata: {"frame":"end"}\n\n')
    );
    expect(second.length).toBe(2);
    expect((second[0] as NdjsonFrame).frame).toBe('result');
    expect((second[1] as NdjsonFrame).frame).toBe('end');
  });

  test('flushes trailing line without newline when final=true', () => {
    const d = new NdjsonStreamDecoder();
    const first = d.push(enc('data: {"frame":"end"}'));
    expect(first.length).toBe(0);
    const flushed = d.push(new Uint8Array(0), true);
    expect(flushed.length).toBe(1);
    expect(flushed[0]?.frame).toBe('end');
  });

  test('ignores blank lines and SSE comments', () => {
    const d = new NdjsonStreamDecoder();
    const frames = d.push(enc(': keep-alive\n\ndata: {"frame":"end"}\n\n\n'));
    expect(frames.length).toBe(1);
  });

  test('throws on malformed JSON', () => {
    const d = new NdjsonStreamDecoder();
    expect(() => d.push(enc('data: {not json}\n\n'))).toThrow();
  });

  test('throws on unrecognized frame shape', () => {
    const d = new NdjsonStreamDecoder();
    expect(() => d.push(enc('data: {"frame":"unknown"}\n\n'))).toThrow(
      /unrecognized frame/
    );
  });
});
