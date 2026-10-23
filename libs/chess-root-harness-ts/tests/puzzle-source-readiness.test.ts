import { expect, test } from 'bun:test';
import { saveLichessFile } from '@libs/chess-root-harness-ts/puzzle-source-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';

// regression: lichess-upload-before-source-ready
test('saving waits for the source check before selecting and uploading', async () => {
  let ready = false;
  let saved = false;
  let selected = false;
  let uploads = 0;
  const ui = {
    get: (id: string) => ({
      isVisible: async () => {
        if (id === 'puzzle-source-saved') return saved;
        if (id === 'puzzle-source-checking') return !ready;
        return (
          ready &&
          !saved &&
          [
            'puzzle-source-missing',
            'puzzle-source-save',
            'puzzle-load-file',
          ].includes(id)
        );
      },
      attribute: async () => null,
      text: async () => 'lichess.csv',
      selectFile: async () => {
        selected = true;
      },
      tap: async () => {
        expect(id).toBe('puzzle-source-save');
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
