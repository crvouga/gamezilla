import { describe, expect, test } from 'bun:test';

import { peopleSearchShowsAnswer, searchResultPhase } from '@libs/search-shared/search-result-phase';

const hidden = {
  loading: false,
  empty: false,
  needsConnection: false,
  denied: false,
  paintedRow: false,
} as const;

describe('people search result phase', () => {
  // regression: people-search-stale-results-look-settled
  test('an in-flight search replaces the previous person with Searching', () => {
    expect(
      searchResultPhase({
        searching: true,
        needsConnection: false,
        resultCount: 1,
      })
    ).toBe('searching');
  });

  // regression: people-search-stale-results-look-settled
  test('the list shell is not a settled search', () => {
    expect(peopleSearchShowsAnswer(hidden)).toBe(false);
    expect(peopleSearchShowsAnswer({ ...hidden, loading: true })).toBe(false);
    expect(
      peopleSearchShowsAnswer({ ...hidden, loading: true, paintedRow: true })
    ).toBe(false);
  });

  test('a painted row, nobody, offline, or sign-in is a settled search', () => {
    expect(peopleSearchShowsAnswer({ ...hidden, paintedRow: true })).toBe(true);
    expect(peopleSearchShowsAnswer({ ...hidden, empty: true })).toBe(true);
    expect(peopleSearchShowsAnswer({ ...hidden, needsConnection: true })).toBe(
      true
    );
    expect(peopleSearchShowsAnswer({ ...hidden, denied: true })).toBe(true);
  });
});
