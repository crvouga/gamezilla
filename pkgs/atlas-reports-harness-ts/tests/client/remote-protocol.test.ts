import { describe, expect, test } from 'bun:test';
import {
  commitIndexKey,
  isKeySegment,
  shaOfIndexKey,
  splitViewerTestId,
  viewerTestId,
} from '@crvouga/atlas/reports/keys';
import type { CommitEvent } from '@crvouga/atlas/reports/protocol';
import { encodeSseEvent } from '@crvouga/atlas/reports/protocol';
import { readEventStream } from '@crvouga/atlas/reports/remote-report';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const arbSha = fc
  .array(fc.constantFrom(...'0123456789abcdef'), {
    minLength: 40,
    maxLength: 40,
  })
  .map((chars) => chars.join(''));

const arbSegment = fc
  .array(fc.constantFrom(...'abcXYZ019._-'), { minLength: 1, maxLength: 12 })
  .map((chars) => chars.join(''))
  .filter(isKeySegment);

const arbCommitEvent: fc.Arbitrary<CommitEvent> = fc.oneof(
  fc.record({
    type: fc.constant('commit' as const),
    commit: fc.constant(null),
  }),
  fc.record({
    type: fc.constant('end' as const),
    state: fc.constantFrom(
      'running' as const,
      'complete' as const,
      'missing' as const
    ),
  }),
  fc.record({
    type: fc.constant('source' as const),
    source: fc.record({
      source: arbSegment,
      packageDir: fc.string({ maxLength: 20 }),
      bucket: arbSegment,
      status: fc.constantFrom(
        'passed' as const,
        'failed' as const,
        'skipped' as const
      ),
      updatedAtMs: fc.nat(),
      tests: fc.constant([]),
    }),
  })
);

/** A response whose body arrives in the given byte chunks. */
function chunkedResponse(bytes: Uint8Array, cuts: readonly number[]): Response {
  const points = [...new Set(cuts.map((c) => c % (bytes.length + 1)))].sort(
    (a, b) => a - b
  );
  const chunks: Uint8Array[] = [];
  let from = 0;
  for (const at of [...points, bytes.length]) {
    chunks.push(bytes.subarray(from, at));
    from = at;
  }
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

describe('event stream', () => {
  test('every event survives any chunking of the body, mid-codepoint included', async () => {
    await assertProperty(
      'decode ∘ encode = id under byte splits',
      fc.asyncProperty(
        fc.array(arbCommitEvent, { maxLength: 6 }),
        fc.array(fc.nat({ max: 600 }), { maxLength: 8 }),
        fc.string({ unit: 'grapheme', maxLength: 6 }),
        async (events, cuts, note) => {
          // Non-ASCII text makes some cuts land inside a codepoint.
          const withText = events.map((e) =>
            e.type === 'source'
              ? {
                  ...e,
                  source: {
                    ...e.source,
                    packageDir: `${e.source.packageDir}${note}`,
                  },
                }
              : e
          );
          const text = withText.map(encodeSseEvent).join('');
          const seen: CommitEvent[] = [];
          await readEventStream<CommitEvent>(
            chunkedResponse(new TextEncoder().encode(text), cuts),
            (event) => seen.push(event)
          );
          expect(seen).toEqual(withText);
        }
      )
    );
  });
});

describe('index keys', () => {
  test('a later start sorts first, and every key names its sha', () => {
    assertProperty(
      'newest first',
      fc.property(
        arbSha,
        arbSha,
        fc.nat({ max: 4_000_000_000_000 }),
        fc.nat({ max: 4_000_000_000_000 }),
        (a, b, t1, t2) => {
          const ka = commitIndexKey(a, t1);
          const kb = commitIndexKey(b, t2);
          expect(shaOfIndexKey(ka)).toBe(a);
          expect(shaOfIndexKey(kb)).toBe(b);
          if (t1 < t2) expect(kb < ka).toBe(true);
          if (t2 < t1) expect(ka < kb).toBe(true);
        }
      )
    );
  });

  test('refuses anything but a full sha', () => {
    expect(() => commitIndexKey('abc123', 0)).toThrow('40-hex');
    expect(() => commitIndexKey('main', 0)).toThrow('40-hex');
  });
});

describe('viewer test ids', () => {
  test('split ∘ join = id for every source and test the harness can name', () => {
    assertProperty(
      'round-trip',
      fc.property(arbSegment, arbSegment, (source, testId) => {
        expect(splitViewerTestId(viewerTestId(source, testId))).toEqual({
          source,
          testId,
        });
      })
    );
  });

  test('a path that climbs out of its test is not a test id', () => {
    expect(splitViewerTestId('libs-chess--part-1/..')).toBeNull();
    expect(splitViewerTestId('../commit.json')).toBeNull();
    expect(splitViewerTestId('no-slash')).toBeNull();
  });
});
