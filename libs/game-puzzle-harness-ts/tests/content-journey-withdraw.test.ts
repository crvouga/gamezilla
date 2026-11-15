import { expect, test } from 'bun:test';
import { withdrawJourneyPublications } from '@libs/game-puzzle-harness-ts/content-journey-withdraw';
import { journeyScreensDriver } from './journey-screens-driver';

const PUBLISH = ['content-author', 'content-author-publish'] as const;

// regression: journey-withdraw-pressed-while-publication-reads
// Verify Nightly 43408857120: the Numberlink offline journey's cleanup pressed
// Withdraw while its publication was still read, with View above it; View
// went, and the press hit the builder beside Withdraw.
test('withdraws once the publication read settles, not while View still sits above Withdraw', async () => {
  const device = journeyScreensDriver({
    start: 'library',
    screens: {
      library: ['content-library', 'content-create-puzzle', 'content-draft-p'],
      builder: [
        'content-author',
        'content-author-steps',
        'content-open-publish',
      ],
      // A press here lands where Withdraw is about to leave.
      checking: [
        ...PUBLISH,
        'content-publication-status',
        'content-view-publication',
        'content-withdraw',
      ],
      published: [...PUBLISH, 'content-publication-status', 'content-withdraw'],
      confirm: ['content-withdraw-confirm'],
      withdrawn: ['content-withdraw-dismiss'],
    },
    leads: {
      'library:content-draft-p': 'builder',
      'builder:content-open-publish': 'checking',
      'published:content-withdraw': 'confirm',
      'confirm:content-withdraw-confirm': 'withdrawn',
      'withdrawn:content-withdraw-dismiss': 'published',
    },
    textArrives: { 'checking:content-publication-status': 'published' },
    expectText: ({ id }, value, options) => {
      expect(id).toBe('content-publication-status');
      // Both settled labels end so; neither in-flight one does.
      for (const label of ['Published', 'Previously published'])
        expect(label.includes(value)).toBe(true);
      for (const label of ['Checking publication', 'Awaiting confirmation'])
        expect(label.includes(value)).toBe(false);
      expect(options?.exact).toBe(false);
    },
  });
  await withdrawJourneyPublications({
    device: { ui: device.ui, timeoutMs: 20_000 },
    documentIds: ['p'],
    backId: 'nav-back',
  });
  expect(device.taps).toEqual([
    'content-draft-p',
    'content-open-publish',
    'content-withdraw',
    'content-withdraw-confirm',
    'content-withdraw-dismiss',
  ]);
});
