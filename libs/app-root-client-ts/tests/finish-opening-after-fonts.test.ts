import { expect, test } from 'bun:test';
import { finishOpeningAfterFonts } from '@libs/app-root-client-ts/finish-opening-after-fonts';

const flush = async () => {
  for (let step = 0; step < 8; step++) await Promise.resolve();
};

// regression: startup-font-handoff-shift
test('an already-resolved fonts.ready does not reveal before explicit faces load', async () => {
  const held = Promise.withResolvers<FontFace[]>();
  const requested: string[] = [];
  let revealed = false;
  const stop = finishOpeningAfterFonts({
    opening: document.createElement('div'),
    fonts: {
      ready: Promise.resolve(document.fonts),
      load: (font) => {
        requested.push(font);
        return held.promise;
      },
    },
    finish: () => {
      revealed = true;
    },
  });
  await flush();
  expect(revealed).toBe(false);
  expect(new Set(requested.map((font) => font.split(' ')[0]))).toEqual(
    new Set(['400', '500', '600', '700'])
  );
  held.resolve([]);
  await flush();
  expect(revealed).toBe(true);
  stop?.();
});

test('a cancelled handoff cannot reveal a disposed route after fonts arrive', async () => {
  const held = Promise.withResolvers<FontFace[]>();
  let revealed = false;
  const stop = finishOpeningAfterFonts({
    opening: document.createElement('div'),
    fonts: { ready: Promise.resolve(document.fonts), load: () => held.promise },
    finish: () => {
      revealed = true;
    },
  });
  stop?.();
  held.resolve([]);
  await flush();
  expect(revealed).toBe(false);
});

test('failed font requests reveal the app with fallback text', async () => {
  let revealed = false;
  const stop = finishOpeningAfterFonts({
    opening: document.createElement('div'),
    fonts: {
      ready: Promise.resolve(document.fonts),
      load: () => Promise.reject(new Error('font unavailable')),
    },
    finish: () => {
      revealed = true;
    },
  });
  await flush();
  expect(revealed).toBe(true);
  stop?.();
});
