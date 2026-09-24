import { describe, expect, test } from 'bun:test';
import {
  acceptsEventStream,
  collectIndexedNdjsonStream,
  eventStreamAcceptHeader,
  IndexedNdjsonStreamError,
} from '@pkgs/ndjson/client';
import {
  encodeNdjsonReadableStream,
  streamParallelIndexed,
} from '@pkgs/ndjson/server';
import {
  EVENT_STREAM_CONTENT_TYPE,
  type NdjsonErrorFrame,
  type NdjsonFrame,
  NdjsonStreamDecoder,
} from '@pkgs/ndjson/shared';
import { arbJsonValue, assertProperty, fc } from '@pkgs/property';
import { arbNdjsonFrame } from './support/ndjson-frame-arbitraries';

async function* iterate<T>(
  frames: readonly NdjsonFrame<T>[],
  failure: { readonly error: unknown } | null
): AsyncIterable<NdjsonFrame<T>> {
  for (const f of frames) yield f;
  if (failure !== null) throw failure.error;
}

async function drain(
  stream: ReadableStream<Uint8Array>
): Promise<NdjsonFrame[]> {
  const decoder = new NdjsonStreamDecoder();
  const out: NdjsonFrame[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    out.push(...decoder.push(value ?? new Uint8Array(0), done));
    if (done) return out;
  }
}

async function collectAll<T>(
  iterable: AsyncIterable<NdjsonFrame<T>>
): Promise<NdjsonFrame<T>[]> {
  const out: NdjsonFrame<T>[] = [];
  for await (const f of iterable) out.push(f);
  return out;
}

/** Settle after `ticks` microtasks — deterministic completion order, no timers. */
async function afterTicks<T>(ticks: number, settle: () => T): Promise<T> {
  for (let i = 0; i < ticks; i += 1) await Promise.resolve();
  return settle();
}

/** One work unit: resolves with a value or rejects with any thrown value. */
type Unit =
  | { readonly ok: true; readonly ticks: number; readonly value: unknown }
  | { readonly ok: false; readonly ticks: number; readonly error: unknown };

const arbUnit: fc.Arbitrary<Unit> = fc.oneof(
  fc.record({
    ok: fc.constant(true as const),
    ticks: fc.nat({ max: 6 }),
    value: arbJsonValue(1),
  }),
  fc.record({
    ok: fc.constant(false as const),
    ticks: fc.nat({ max: 6 }),
    error: fc.oneof(
      fc.string().map((m) => new Error(m)),
      fc.constantFrom(undefined, null, 0, '', 'boom')
    ),
  })
);

function runUnit(unit: Unit): Promise<unknown> {
  return afterTicks(unit.ticks, () => {
    if (unit.ok) return unit.value;
    throw unit.error;
  });
}

function mapError(index: number, error: unknown): NdjsonErrorFrame {
  return {
    frame: 'error',
    index,
    status: 500,
    message: error instanceof Error ? error.message : String(error),
  };
}

describe('encodeNdjsonReadableStream', () => {
  test('a completed iterable round-trips through bytes unchanged', async () => {
    await assertProperty(
      'drain(encode(frames)) = frames',
      fc.asyncProperty(
        fc.array(arbNdjsonFrame(), { maxLength: 6 }),
        async (frames) => {
          expect(
            await drain(encodeNdjsonReadableStream(iterate(frames, null)))
          ).toEqual(frames);
        }
      )
    );
  });

  test('a throwing iterable ends with its tail error frame, then `end`', async () => {
    await assertProperty(
      'throw ⇒ prefix + tail error + end',
      fc.asyncProperty(
        fc.array(arbNdjsonFrame(), { maxLength: 4 }),
        fc.string({ maxLength: 20 }),
        fc.option(fc.stringMatching(/^[a-z]{1,8}$/), { nil: undefined }),
        async (frames, message, kind) => {
          const error = new Error(message);
          const options =
            kind === undefined
              ? undefined
              : {
                  mapTailError: (e: unknown): NdjsonErrorFrame => ({
                    frame: 'error',
                    index: -1,
                    status: 503,
                    message: e instanceof Error ? e.message : '',
                    kind,
                  }),
                };
          const out = await drain(
            encodeNdjsonReadableStream(iterate(frames, { error }), options)
          );
          const tail: NdjsonErrorFrame =
            kind === undefined
              ? { frame: 'error', index: -1, status: 500, message }
              : { frame: 'error', index: -1, status: 503, message, kind };
          expect(out).toEqual([...frames, tail, { frame: 'end' }]);
        }
      )
    );
  });
});

describe('streamParallelIndexed', () => {
  test('emits one frame per unit (result or error), then exactly one `end`', async () => {
    await assertProperty(
      'every index settles into exactly one frame',
      fc.asyncProperty(fc.array(arbUnit, { maxLength: 6 }), async (units) => {
        const frames = await collectAll(
          streamParallelIndexed(
            units.length,
            (i) => runUnit(units[i] as Unit),
            mapError
          )
        );
        expect(frames.at(-1)).toEqual({ frame: 'end' });
        const body = frames.slice(0, -1);
        expect(body.map((f) => f.frame !== 'end' && f.index).sort()).toEqual(
          units.map((_, i) => i).sort()
        );
        for (const f of body) {
          if (f.frame === 'end') throw new Error('end frame before the tail');
          const unit = units[f.index] as Unit;
          if (unit.ok) {
            expect(f).toEqual({
              frame: 'result',
              index: f.index,
              result: unit.value,
            });
          } else {
            expect(f).toEqual(mapError(f.index, unit.error));
          }
        }
      })
    );
  });

  test('server → bytes → client restores index order or surfaces the first error', async () => {
    await assertProperty(
      'end-to-end pipeline',
      fc.asyncProperty(fc.array(arbUnit, { maxLength: 6 }), async (units) => {
        const body = encodeNdjsonReadableStream(
          streamParallelIndexed(
            units.length,
            (i) => runUnit(units[i] as Unit),
            mapError
          )
        );
        const run = collectIndexedNdjsonStream<unknown>(body, units.length);
        if (units.every((u) => u.ok)) {
          expect(await run).toEqual(units.map((u) => (u.ok ? u.value : null)));
        } else {
          await expect(run).rejects.toBeInstanceOf(IndexedNdjsonStreamError);
        }
      })
    );
  });
});

describe('Accept negotiation', () => {
  test('eventStreamAcceptHeader always advertises the event stream', () => {
    assertProperty(
      'acceptsEventStream ∘ eventStreamAcceptHeader = true',
      fc.property(fc.string({ maxLength: 30 }), (fallback) => {
        expect(acceptsEventStream(eventStreamAcceptHeader(fallback))).toBe(
          true
        );
      })
    );
  });

  test('a header accepts the stream iff it names the content type', () => {
    assertProperty(
      'acceptsEventStream ≡ includes',
      fc.property(
        fc.array(
          fc.constantFrom(
            EVENT_STREAM_CONTENT_TYPE,
            'application/json',
            '*/*',
            ', ',
            'text/'
          ),
          { maxLength: 4 }
        ),
        (parts) => {
          const header = parts.join('');
          expect(acceptsEventStream(header)).toBe(
            header.includes(EVENT_STREAM_CONTENT_TYPE)
          );
        }
      )
    );
    expect(acceptsEventStream(null)).toBe(false);
    expect(acceptsEventStream(undefined)).toBe(false);
  });
});
