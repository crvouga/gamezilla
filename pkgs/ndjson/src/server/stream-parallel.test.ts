import { describe, expect, test } from 'bun:test';
import type { NdjsonErrorFrame, NdjsonFrame } from '../shared/frames';
import { streamParallelIndexed } from './stream-parallel';

const genericMapError = (index: number, error: unknown): NdjsonErrorFrame => ({
  frame: 'error',
  index,
  status: 500,
  message: error instanceof Error ? error.message : String(error),
});

async function collect<T>(
  iter: AsyncIterable<NdjsonFrame<T>>
): Promise<NdjsonFrame<T>[]> {
  const out: NdjsonFrame<T>[] = [];
  for await (const frame of iter) out.push(frame);
  return out;
}

describe('streamParallelIndexed', () => {
  test('emits results in completion order, then a single end frame', async () => {
    const delays = [80, 0, 20];
    const frames = await collect(
      streamParallelIndexed(
        delays.length,
        async (i) => {
          await new Promise<void>((r) => setTimeout(r, delays[i]));
          return `r${i}`;
        },
        genericMapError
      )
    );
    expect(frames).toHaveLength(4);
    expect(frames[3]).toEqual({ frame: 'end' });
    const completed = frames
      .slice(0, 3)
      .filter((f) => f.frame === 'result')
      .map((f) => (f as { index: number }).index);
    expect(completed).toEqual([1, 2, 0]);
  });

  test('inlines per-item failures without aborting siblings', async () => {
    const frames = await collect(
      streamParallelIndexed(
        2,
        async (i) => {
          if (i === 1) throw new Error('boom');
          return 'ok';
        },
        genericMapError
      )
    );
    const errorFrame = frames.find((f) => f.frame === 'error') as
      | NdjsonErrorFrame
      | undefined;
    expect(errorFrame?.message).toBe('boom');
    expect(errorFrame?.index).toBe(1);
    expect(frames[frames.length - 1]).toEqual({ frame: 'end' });
  });

  test('mapError can attach kind + context for domain mapping', async () => {
    const frames = await collect(
      streamParallelIndexed<string>(
        1,
        () => Promise.reject(new Error('forbidden')),
        (index, error) => ({
          frame: 'error',
          index,
          status: 403,
          message: error instanceof Error ? error.message : String(error),
          kind: 'forbidden',
          context: { reason: 'auth' },
        })
      )
    );
    const err = frames[0] as NdjsonErrorFrame;
    expect(err.frame).toBe('error');
    expect(err.status).toBe(403);
    expect(err.kind).toBe('forbidden');
    expect(err.context).toEqual({ reason: 'auth' });
  });

  test('still emits an end frame when every item fails', async () => {
    const frames = await collect(
      streamParallelIndexed(
        3,
        () => Promise.reject(new Error('x')),
        genericMapError
      )
    );
    expect(frames.filter((f) => f.frame === 'error')).toHaveLength(3);
    expect(frames[frames.length - 1]).toEqual({ frame: 'end' });
  });

  test('handles count=0 by yielding only end', async () => {
    const frames = await collect(
      streamParallelIndexed(0, () => Promise.resolve('x'), genericMapError)
    );
    expect(frames).toEqual([{ frame: 'end' }]);
  });
});
