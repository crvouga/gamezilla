import { expect, test } from 'bun:test';
import { observeBotGameJourney } from '@libs/runtime-harness-ts/bot-game-journey';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { journeyDiagnosticDriver } from './journey-diagnostic-driver';

// regression: bot-journey-multiseat-name-wrapper
test('observes bots in the three-player Word Tiles seat wrappers', async () => {
  const texts: Readonly<Record<string, string>> = {
    'custom-game-white': 'Amber RequiredHedgehog455',
    'custom-game-black': 'Teal Bot (medium)',
    'custom-game-red': 'Violet Bot (medium)',
  };
  const visible = [
    ...Object.keys(texts),
    'custom-game-board',
    'custom-game-board-rack',
    'custom-game-resign',
    'custom-game-public',
  ];
  const base = journeyDiagnosticDriver({
    html: null,
    visible,
    texts,
    captions: {},
  }).ui;
  const checked: string[] = [];
  const ui: Driver = {
    ...base,
    get: (id) => ({
      ...base.get(id),
      attribute: async (name) =>
        id === 'custom-game-public' && name === 'data-status' ? 'active' : null,
      layout: async () => ({ x: 0, y: 0, width: 320, height: 320 }),
      expect: {
        visible: async () => {
          expect(visible).toContain(id);
        },
        hidden: async () => {
          expect(visible).not.toContain(id);
        },
        text: async (value) => {
          expect(texts[id]).toContain(value);
          checked.push(id);
        },
      },
    }),
  };
  await observeBotGameJourney(
    { act: async (_name, gestures) => gestures(ui) },
    'Word Tiles for three'
  );
  expect(checked).toEqual(['custom-game-black', 'custom-game-red']);
});
