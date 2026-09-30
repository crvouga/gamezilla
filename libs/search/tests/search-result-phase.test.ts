import { describe, expect, test } from 'bun:test';

import { searchResultPhase } from '@libs/search/public/search-result-phase';

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
});
