import { expect, test } from 'bun:test';
import { loadStoryFonts } from '../storybook/story-fonts';

function registeredFonts(load: FontFaceSet['load']) {
  return {
    [Symbol.iterator]: function* () {
      for (const weight of ['400', '500', '600', '700'])
        yield { family: 'Manrope', weight };
    },
    load,
    ready: Promise.resolve(),
  } as unknown as FontFaceSet;
}

// regression: storybook-word-tiles-font-focus-scroll-race
test('an already-resolved fonts.ready cannot bypass explicit face loads', async () => {
  const held = Promise.withResolvers<FontFace[]>();
  const requested: string[] = [];
  const fonts = registeredFonts((font) => {
    requested.push(font);
    return held.promise;
  });
  let finished = false;
  const loading = loadStoryFonts(fonts).then(() => {
    finished = true;
  });
  await Promise.resolve();
  expect(finished).toBe(false);
  expect(requested).toEqual([
    '400 16px Manrope',
    '500 16px Manrope',
    '600 16px Manrope',
    '700 16px Manrope',
  ]);
  held.resolve([{ status: 'loaded' } as FontFace]);
  await loading;
  expect(finished).toBe(true);
});

test('missing CSS registration rejects rather than accepting an empty font set', async () => {
  const fonts = registeredFonts(() => Promise.resolve([]));
  Object.assign(fonts, { [Symbol.iterator]: function* () {} });
  const result: unknown = await loadStoryFonts(fonts).catch(
    (error: unknown) => error
  );
  expect(result).toBeInstanceOf(Error);
  expect(String(result)).toContain('not registered');
});

test('an empty load result rejects rather than silently using fallback copy', async () => {
  const result: unknown = await loadStoryFonts(
    registeredFonts(() => Promise.resolve([]))
  ).catch((error: unknown) => error);
  expect(result).toBeInstanceOf(Error);
  expect(String(result)).toContain('did not load');
});

test('font network failures propagate to the native Storybook loader', async () => {
  const failure = new Error('font response failed');
  const result: unknown = await loadStoryFonts(
    registeredFonts(() => Promise.reject(failure))
  ).catch((error: unknown) => error);
  expect(result).toBe(failure);
});
