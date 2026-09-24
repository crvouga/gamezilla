import { describe, expect, test } from 'bun:test';
import {
  collectIndexedNdjsonStream,
  IndexedNdjsonCollector,
  IndexedNdjsonStreamError,
} from '@pkgs/ndjson/client';
import {
  encodeNdjsonFrame,
  type NdjsonErrorFrame,
  type NdjsonFrame,
} from '@pkgs/ndjson/shared';
import { arbJsonValue, assertProperty, fc } from '@pkgs/property';
import {
  arbNdjsonFrame,
  splitBytes,
  streamOf,
} from './support/ndjson-frame-arbitraries';

/** What a collector fed `frames` for an `expected`-slot batch must do. */
type Outcome =
  | { readonly kind: 'push-throws'; readonly at: number }
  | { readonly kind: 'stream-error'; readonly first: NdjsonErrorFrame }
  | { readonly kind: 'truncated' }
  | { readonly kind: 'omitted'; readonly index: number }
  | { readonly kind: 'ok'; readonly results: unknown[] };

/**
 * Reference model of the wire contract, stated over the whole sequence:
 * a frame after `end` or a result outside [0, expected) is a protocol
 * violation at that frame; otherwise the first error wins, then a missing
 * `end`, then the lowest empty slot; a later result for a slot replaces an
 * earlier one.
 */
function model(expected: number, frames: NdjsonFrame[]): Outcome {
  const firstEnd = frames.findIndex((f) => f.frame === 'end');
  const violation = frames.findIndex(
    (f, i) =>
      (firstEnd >= 0 && i > firstEnd) ||
      (f.frame === 'result' && (f.index < 0 || f.index >= expected))
  );
  if (violation >= 0) return { kind: 'push-throws', at: violation };
  const first = frames.find((f) => f.frame === 'error');
  if (first !== undefined) return { kind: 'stream-error', first };
  if (firstEnd < 0) return { kind: 'truncated' };
  const slots = new Map<number, unknown>();
  for (const f of frames)
    if (f.frame === 'result') slots.set(f.index, f.result);
  for (let i = 0; i < expected; i += 1) {
    if (!slots.has(i)) return { kind: 'omitted', index: i };
  }
  return {
    kind: 'ok',
    results: Array.from({ length: expected }, (_, i) => slots.get(i)),
  };
}

function errorFields(e: IndexedNdjsonStreamError): Record<string, unknown> {
  return {
    status: e.status,
    index: e.index,
    message: e.message,
    kind: e.kind,
    context: e.context,
  };
}

function expectOutcome(run: () => unknown[], outcome: Outcome): void {
  if (outcome.kind === 'ok') {
    expect(run()).toEqual(outcome.results);
    return;
  }
  let thrown: unknown = null;
  try {
    run();
  } catch (e: unknown) {
    thrown = e;
  }
  if (outcome.kind === 'stream-error') {
    expect(thrown).toBeInstanceOf(IndexedNdjsonStreamError);
    const f = outcome.first;
    expect(errorFields(thrown as IndexedNdjsonStreamError)).toEqual({
      status: f.status,
      index: f.index,
      message: f.message,
      kind: f.kind,
      context: f.context,
    });
    return;
  }
  expect(thrown).toBeInstanceOf(Error);
  expect(thrown).not.toBeInstanceOf(IndexedNdjsonStreamError);
  if (outcome.kind === 'truncated') {
    expect((thrown as Error).message).toMatch(/truncated transport/);
  }
  if (outcome.kind === 'omitted') {
    expect((thrown as Error).message).toContain(`index=${outcome.index}`);
  }
}

/** Batch sizes under test; arbitraries are built once, outside `chain`. */
const MAX_EXPECTED = 5;
const arbValue = arbJsonValue(2);
const arbAnyFrame = arbNdjsonFrame(MAX_EXPECTED);

/**
 * A well-formed batch: every slot once in a shuffled order (plus a couple of
 * earlier results a later frame overwrites), then `end`.
 */
const arbCompleteBatch = fc
  .integer({ min: 0, max: MAX_EXPECTED })
  .chain((expected) =>
    fc.tuple(
      fc.constant(expected),
      fc.shuffledSubarray(
        Array.from({ length: expected }, (_, i) => i),
        { minLength: expected, maxLength: expected }
      ),
      fc.array(arbValue, { minLength: expected, maxLength: expected }),
      fc.array(arbAnyFrame, { maxLength: 3 })
    )
  )
  .map(([expected, order, values, extra]): [number, NdjsonFrame[]] => [
    expected,
    [
      ...extra.filter(
        (f) => f.frame === 'result' && f.index >= 0 && f.index < expected
      ),
      ...order.map(
        (index): NdjsonFrame => ({
          frame: 'result',
          index,
          result: values[index] ?? null,
        })
      ),
      { frame: 'end' },
    ],
  ]);

/**
 * Anything a producer might send, including protocol violations: indices run
 * to {@link MAX_EXPECTED}, so they fall on both sides of a smaller batch.
 */
const arbAnyBatch = fc.tuple(
  fc.integer({ min: 0, max: MAX_EXPECTED - 1 }),
  fc.array(arbAnyFrame, { maxLength: 8 })
);

const arbBatch = fc.oneof(arbCompleteBatch, arbAnyBatch);

function runCollector(expected: number, frames: NdjsonFrame[]): unknown[] {
  const collector = new IndexedNdjsonCollector<unknown>(expected);
  for (const frame of frames) collector.push(frame);
  return collector.finalize();
}

describe('IndexedNdjsonCollector matches the wire-contract model', () => {
  test('push + finalize ≡ model', () => {
    assertProperty(
      'collector ≡ model',
      fc.property(arbBatch, ([expected, frames]) => {
        const outcome = model(expected, frames);
        if (outcome.kind === 'push-throws') {
          const collector = new IndexedNdjsonCollector<unknown>(expected);
          frames.slice(0, outcome.at).forEach((f) => {
            collector.push(f);
          });
          expect(() =>
            collector.push(frames[outcome.at] as NdjsonFrame)
          ).toThrow(/ndjson:/);
          return;
        }
        expectOutcome(() => runCollector(expected, frames), outcome);
      })
    );
  });

  test('onErrorFrame fires once per error frame, in order', () => {
    assertProperty(
      'onErrorFrame sees every error frame',
      fc.property(arbAnyBatch, ([expected, frames]) => {
        const seen: NdjsonErrorFrame[] = [];
        const collector = new IndexedNdjsonCollector<unknown>(expected, {
          onErrorFrame: (f) => seen.push(f),
        });
        const accepted: NdjsonFrame[] = [];
        for (const frame of frames) {
          try {
            collector.push(frame);
            accepted.push(frame);
          } catch {
            break;
          }
        }
        expect(seen).toEqual(accepted.filter((f) => f.frame === 'error'));
      })
    );
  });

  test('a non-integer or negative batch size is refused', () => {
    assertProperty(
      'bad expected ⇒ throws',
      fc.property(
        fc.oneof(
          fc.integer({ max: -1 }),
          fc.double().filter((n) => !Number.isInteger(n))
        ),
        (expected) => {
          expect(() => new IndexedNdjsonCollector(expected)).toThrow();
        }
      )
    );
  });
});

describe('collectIndexedNdjsonStream', () => {
  test('bytes over any chunking ≡ model', async () => {
    await assertProperty(
      'collectIndexedNdjsonStream ≡ model',
      fc.asyncProperty(
        arbBatch,
        fc.array(fc.nat({ max: 400 }), { maxLength: 6 }),
        async ([expected, frames], cuts) => {
          const bytes = new TextEncoder().encode(
            frames.map((f) => encodeNdjsonFrame(f)).join('')
          );
          const run = collectIndexedNdjsonStream<unknown>(
            streamOf(splitBytes(bytes, cuts)),
            expected
          );
          const outcome = model(expected, frames);
          if (outcome.kind === 'push-throws') {
            await expect(run).rejects.toThrow(/ndjson:/);
            return;
          }
          const settled = await run.then(
            (results) => () => results,
            (error: unknown) => () => {
              throw error;
            }
          );
          expectOutcome(settled, outcome);
        }
      )
    );
  });

  test('a missing body is refused', async () => {
    await expect(collectIndexedNdjsonStream(null, 1)).rejects.toThrow(
      /missing body/
    );
  });
});
