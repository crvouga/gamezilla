import type { TimeRange } from './types';

/** Tempo answers a search with an arbitrary subset once it holds this many. */
export const PAGE_SIZE = 50;
/** Tempo refuses searches over a week; stay far inside that. */
export const MAX_QUERY_MS = 72 * 60 * 60 * 1000;
/** Search ranges are whole seconds, so two seconds is the narrowest split. */
const MIN_SPLIT_MS = 2_000;

export type SearchHit = {
  readonly startedAtMs: number;
  readonly traceId: string;
};

export type FetchPage = (range: TimeRange) => Promise<readonly SearchHit[]>;

export type PagedHits = {
  readonly hits: readonly SearchHit[];
  /** Absent when every match was read. */
  readonly truncated?: 'limit' | 'range';
};

type Walk = {
  capped: boolean;
  narrow: boolean;
  readonly fetchPage: FetchPage;
  readonly found: Map<string, SearchHit>;
  readonly limit: number;
  readonly order: 'newest' | 'oldest';
};

/**
 * Read every trace in a range through a search that truncates silently.
 * A range that returns a full page is split in two and each half is read
 * again, the half the caller wants first, until every part comes back short
 * of a page or `limit` traces are in hand. Because the wanted half is read
 * first, a limit keeps the newest (or oldest) traces, deterministically.
 */
export async function pageRange(
  fetchPage: FetchPage,
  range: TimeRange,
  options: { readonly limit: number; readonly order: 'newest' | 'oldest' }
): Promise<PagedHits> {
  const walk: Walk = {
    capped: false,
    narrow: false,
    fetchPage,
    found: new Map(),
    limit: options.limit,
    order: options.order,
  };
  await visit(walk, range);
  const ordered = [...walk.found.values()].sort(
    (a, b) =>
      (options.order === 'newest'
        ? b.startedAtMs - a.startedAtMs
        : a.startedAtMs - b.startedAtMs) ||
      (a.traceId < b.traceId ? -1 : a.traceId > b.traceId ? 1 : 0)
  );
  const hits = ordered.slice(0, options.limit);
  const cut = walk.capped || ordered.length > hits.length;
  if (cut) return { hits, truncated: 'limit' };
  return walk.narrow ? { hits, truncated: 'range' } : { hits };
}

async function visit(walk: Walk, range: TimeRange): Promise<void> {
  if (walk.found.size >= walk.limit) {
    walk.capped = true;
    return;
  }
  const width = range.endMs - range.startMs;
  if (width <= MAX_QUERY_MS) {
    const page = await walk.fetchPage(range);
    if (page.length < PAGE_SIZE || width <= MIN_SPLIT_MS) {
      if (page.length >= PAGE_SIZE) walk.narrow = true;
      for (const hit of page) walk.found.set(hit.traceId, hit);
      return;
    }
  }
  const middle = Math.floor((range.startMs + range.endMs) / 2);
  const newer = { startMs: middle, endMs: range.endMs };
  const older = { startMs: range.startMs, endMs: middle };
  const [first, second] =
    walk.order === 'newest' ? [newer, older] : [older, newer];
  await visit(walk, first);
  await visit(walk, second);
}
