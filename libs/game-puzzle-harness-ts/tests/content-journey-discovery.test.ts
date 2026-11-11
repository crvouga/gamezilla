import { expect, test } from 'bun:test';
import { discoverJourneyContent } from '@libs/game-puzzle-harness-ts/content-journey-discovery';
import { journeyScreensDriver } from './journey-screens-driver';

const EDITION = 'content-published-cc620be7-d4cb-44c0-9da7-7afebdc5395a';

// regression: live-content-discovery-first-page
test('discovery opens Browse, then loads the next page before opening the requested edition', async () => {
  const device = journeyScreensDriver({
    start: 'library',
    screens: {
      library: [
        'content-library',
        'content-library-tab-continue',
        'content-library-tab-browse',
      ],
      'page-1': [
        'content-library',
        'content-library-browse',
        'content-more-published',
      ],
      loading: ['content-library', 'content-library-browse'],
      'page-2': ['content-library', 'content-library-browse', EDITION],
      edition: ['content-edition'],
    },
    leads: {
      'library:content-library-tab-browse': 'page-1',
      'page-1:content-more-published': 'loading',
      [`page-2:${EDITION}`]: 'edition',
    },
    arrives: { loading: 'page-2' },
  });
  await discoverJourneyContent(
    { ui: device.ui, timeoutMs: 100 },
    'cc620be7-d4cb-44c0-9da7-7afebdc5395a'
  );
  expect(device.taps).toEqual([
    'content-library-tab-browse',
    'content-more-published',
    EDITION,
  ]);
});
