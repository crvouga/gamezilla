import { expect, test } from 'bun:test';
import { publishJourneyDraft } from '@libs/game-puzzle-harness-ts/content-journey-authoring';
import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';

// regression: numberlink-journey-opens-previous-publication
// mw6tcjre: local publication completes before the current-edition read arrives.
test('waits for Canyon publication confirmation before opening the edition', async () => {
  let confirmed = false;
  let opened = '';
  const unused = (): never => {
    throw new Error('Unexpected driver operation');
  };
  const ui: Driver = {
    kind: 'script',
    launch: unused,
    close: unused,
    key: unused,
    snapshotHtml: unused,
    get: (id): DriverNode => ({
      get: unused,
      tapAt: unused,
      drag: unused,
      layout: unused,
      selectFile: unused,
      input: unused,
      clear: unused,
      key: unused,
      scroll: unused,
      text: unused,
      attribute: async (name) =>
        name === 'data-documentid' ? 'puzzle' : 'canyon-edition',
      isVisible: async () => true,
      wait: async () => {},
      tap: async () => {
        if (id === 'content-view-publication')
          opened = confirmed ? 'Canyon mw6tcjre' : 'Valley mw6tcjre';
      },
      expect: {
        visible: async () => {},
        hidden: unused,
        text: async (value, options) => {
          if (id === 'content-publication-status') {
            expect(value).toBe('Published');
            expect(options?.exact).toBe(true);
            confirmed = true;
          }
          if (id === 'content-edition') expect(opened).toBe(value);
        },
      },
    }),
  };
  await publishJourneyDraft({ ui, timeoutMs: 20_000 }, 'Canyon mw6tcjre');
  expect(opened).toBe('Canyon mw6tcjre');
});
