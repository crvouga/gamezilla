import { expect, test } from 'bun:test';
import { saveLichessFile } from '@libs/chess-root-harness-ts/puzzle-source-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';

/** The controls each place of the loader holds while the file is missing. */
const SOURCE_PLACE = [
  'puzzle-source-missing',
  'puzzle-source-save',
  'puzzle-load-file',
];

// regression: lichess-upload-before-source-ready
test('saving waits for the source check before selecting and uploading', async () => {
  let ready = false;
  let saved = false;
  let selected = false;
  let uploads = 0;
  let place: 'load' | 'source' = 'load';
  const visible = (id: string): boolean => {
    if (id === 'puzzle-load-content') return true;
    if (id === 'puzzle-load-source') return place === 'load';
    if (id === 'nav-back') return place === 'source';
    if (place !== 'source') return false;
    if (id === 'puzzle-source-saved') return saved;
    if (id === 'puzzle-source-checking') return !ready;
    return ready && !saved && SOURCE_PLACE.includes(id);
  };
  const ui = {
    get: (id: string) => ({
      isVisible: async () => visible(id),
      attribute: async (name: string) => {
        if (id !== 'puzzle-load-content') return null;
        if (name === 'data-place') return place;
        return name === 'data-stage' ? 'ready' : null;
      },
      text: async () => 'lichess.csv',
      selectFile: async () => {
        expect(place).toBe('source');
        selected = true;
      },
      tap: async () => {
        if (id === 'puzzle-load-source') {
          place = 'source';
          return;
        }
        if (id === 'nav-back') {
          place = 'load';
          return;
        }
        expect(id).toBe('puzzle-source-save');
        expect(place).toBe('source');
        expect(selected).toBe(true);
        uploads += 1;
        saved = true;
      },
    }),
  };
  const harness = {
    actors: new Map([['alice', { ui }]]),
    session: {
      scheduler: { starvedAdvances: () => 0 },
      advanceTime: async () => {
        ready = true;
      },
      waitForIdle: async () => {},
    },
  } as unknown as ProductHarness;
  await Promise.resolve(saveLichessFile.act(harness, 'alice'));
  expect(uploads).toBe(1);
  expect(saved).toBe(true);
});
