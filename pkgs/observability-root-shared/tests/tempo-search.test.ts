import { describe, expect, test } from 'bun:test';
import type { SearchHit } from '@pkgs/observability-root-shared/tempo-search';
import {
  MAX_QUERY_MS,
  PAGE_SIZE,
  pageRange,
} from '@pkgs/observability-root-shared/tempo-search';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

/** Tempo as it behaves: a full page of whichever matches it reads first. */
function tempoOf(hits: readonly SearchHit[]) {
  const asked: { startMs: number; endMs: number }[] = [];
  return {
    asked,
    fetchPage: async (range: { startMs: number; endMs: number }) => {
      asked.push(range);
      const first = Math.floor(range.startMs / 1000);
      const last = Math.ceil(range.endMs / 1000);
      return hits
        .filter((hit) => {
          const second = hit.startedAtMs / 1000;
          return second >= first && second <= last;
        })
        .sort((a, b) => a.startedAtMs - b.startedAtMs)
        .slice(0, PAGE_SIZE);
    },
  };
}

function distinctSeconds(seconds: readonly number[]): SearchHit[] {
  return seconds.map((second) => ({
    traceId: `trace-${second}`,
    startedAtMs: second * 1000,
  }));
}

const HOUR = { startMs: 0, endMs: 3_600_000 };

describe('paging a truncating search by time', () => {
  test('a range that fits one page is read once', async () => {
    const tempo = tempoOf(distinctSeconds([5, 10, 15]));
    const paged = await pageRange(tempo.fetchPage, HOUR, {
      limit: 200,
      order: 'newest',
    });
    expect(paged.hits.map((hit) => hit.traceId)).toEqual([
      'trace-15',
      'trace-10',
      'trace-5',
    ]);
    expect(paged.truncated).toBeUndefined();
    expect(tempo.asked).toHaveLength(1);
  });

  // regression: obs-tempo-search-truncates-silently
  test('120 traces behind a 50 trace page are all read', async () => {
    const seconds = Array.from({ length: 120 }, (_, index) => index * 29 + 1);
    const tempo = tempoOf(distinctSeconds(seconds));
    const paged = await pageRange(tempo.fetchPage, HOUR, {
      limit: 200,
      order: 'newest',
    });
    expect(paged.hits).toHaveLength(120);
    expect(paged.truncated).toBeUndefined();
  });

  test('a limit keeps the newest traces and says it stopped', async () => {
    const seconds = Array.from({ length: 120 }, (_, index) => index * 29 + 1);
    const paged = await pageRange(
      tempoOf(distinctSeconds(seconds)).fetchPage,
      HOUR,
      {
        limit: 7,
        order: 'newest',
      }
    );
    expect(paged.hits.map((hit) => hit.startedAtMs / 1000)).toEqual(
      seconds.slice(-7).reverse()
    );
    expect(paged.truncated).toBe('limit');
  });

  test('the oldest order keeps the earliest traces', async () => {
    const seconds = Array.from({ length: 120 }, (_, index) => index * 29 + 1);
    const paged = await pageRange(
      tempoOf(distinctSeconds(seconds)).fetchPage,
      HOUR,
      {
        limit: 3,
        order: 'oldest',
      }
    );
    expect(paged.hits.map((hit) => hit.startedAtMs / 1000)).toEqual(
      seconds.slice(0, 3)
    );
    expect(paged.truncated).toBe('limit');
  });

  test('more traces in one second than a page holds is announced as a range cut', async () => {
    const pile = Array.from({ length: 80 }, (_, index) => ({
      traceId: `same-second-${index}`,
      startedAtMs: 1_000 + index,
    }));
    const paged = await pageRange(tempoOf(pile).fetchPage, HOUR, {
      limit: 200,
      order: 'newest',
    });
    expect(paged.hits).toHaveLength(PAGE_SIZE);
    expect(paged.truncated).toBe('range');
  });

  test('no search covers more than Tempo allows', async () => {
    const tempo = tempoOf(distinctSeconds([10]));
    await pageRange(
      tempo.fetchPage,
      { startMs: 0, endMs: 10 * MAX_QUERY_MS },
      { limit: 200, order: 'newest' }
    );
    expect(tempo.asked.every((r) => r.endMs - r.startMs <= MAX_QUERY_MS)).toBe(
      true
    );
  });

  test('property: the result is complete, newest-first, and every cut is announced', async () => {
    await assertProperty(
      'paged search completeness',
      fc.asyncProperty(
        fc.uniqueArray(fc.integer({ min: 0, max: 7_200 }), { maxLength: 300 }),
        fc.integer({ min: 1, max: 400 }),
        fc.constantFrom('newest' as const, 'oldest' as const),
        async (seconds, limit, order) => {
          const matches = distinctSeconds(seconds);
          const paged = await pageRange(
            tempoOf(matches).fetchPage,
            { startMs: 0, endMs: 7_200_000 },
            { limit, order }
          );
          const ids = paged.hits.map((hit) => hit.traceId);
          expect(new Set(ids).size).toBe(ids.length);
          const sorted = [...matches].sort((a, b) =>
            order === 'newest'
              ? b.startedAtMs - a.startedAtMs
              : a.startedAtMs - b.startedAtMs
          );
          expect(ids).toEqual(
            sorted.slice(0, ids.length).map((hit) => hit.traceId)
          );
          if (paged.truncated === undefined) {
            expect(ids).toHaveLength(matches.length);
          } else {
            expect(paged.truncated).toBe('limit');
          }
          if (matches.length <= limit) {
            expect(ids).toHaveLength(matches.length);
          } else {
            expect(ids).toHaveLength(limit);
            expect(paged.truncated).toBe('limit');
          }
        }
      )
    );
  });
});
