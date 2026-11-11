import { expect, test } from 'bun:test';
import { publishJourneyDraft } from '@libs/game-puzzle-harness-ts/content-journey-authoring';
import { journeyScreensDriver } from './journey-screens-driver';

const PUBLISH = [
  'content-author',
  'content-author-publish',
  'content-validate',
  'content-validation-passed',
  'content-publish',
  'content-publication-status',
  'content-view-publication',
] as const;

// regression: numberlink-journey-opens-previous-publication
// mw6tcjre: local publication completes before the current-edition read arrives.
test('waits for Canyon publication confirmation before opening the edition', async () => {
  let confirmed = false;
  let opened = '';
  const device = journeyScreensDriver({
    start: 'builder',
    screens: {
      builder: [
        'content-author',
        'content-author-steps',
        'content-open-publish',
      ],
      publish: PUBLISH,
      edition: ['content-edition'],
    },
    leads: {
      'builder:content-open-publish': 'publish',
      'publish:content-validate': 'publish',
      'publish:content-publish': 'publish',
      'publish:content-view-publication': 'edition',
    },
    attribute: (_id, name) =>
      name === 'data-documentid' ? 'puzzle' : 'canyon-edition',
    expectText: ({ id }, value, options) => {
      if (id === 'content-publication-status') {
        expect(value).toBe('Published');
        expect(options?.exact).toBe(true);
        confirmed = true;
      }
      if (id === 'content-edition') {
        opened = confirmed ? 'Canyon mw6tcjre' : 'Valley mw6tcjre';
        expect(opened).toBe(value);
      }
    },
  });
  await publishJourneyDraft(
    { ui: device.ui, timeoutMs: 20_000 },
    'Canyon mw6tcjre'
  );
  expect(opened).toBe('Canyon mw6tcjre');
  // Validate and Publish are pressed on the builder's publish screen.
  expect(device.taps).toEqual([
    'content-open-publish',
    'content-validate',
    'content-publish',
    'content-view-publication',
  ]);
});
