import { expect, type Page, type TestInfo } from '@playwright/test';
import { fontHandshake, fontViewport } from './font-handshake';

async function routeFonts(page: Page, held: boolean) {
  const release = Promise.withResolvers<undefined>();
  const requested = Promise.withResolvers<undefined>();
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') return route.abort();
    if (/\.woff2?$/.test(url.pathname) && held) {
      requested.resolve(undefined);
      await release.promise;
    }
    if (!held && /\/iframe-[^/]+\.js$/.test(url.pathname)) {
      const response = await route.fetch();
      return route.fulfill({
        response,
        body:
          'await Promise.all([400,500,600,700].map(w=>document.fonts.load(`${w} 16px Manrope`)));\n' +
          (await response.text()),
      });
    }
    return route.continue();
  });
  return { release: release.resolve, requested: requested.promise };
}

/** Fonts are released by observed loader/play events, never by a sleep. */
export async function captureFontSchedule(
  page: Page,
  options: { story: string; theme: string; held: boolean },
  info: TestInfo
) {
  const { story, theme, held } = options;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const gate = await routeFonts(page, held);
  const { boundary } = await fontHandshake(page);
  await page.setViewportSize({ width: 1440, height: 844 });
  try {
    await page.goto(
      `/iframe.html?id=screens-games-word-tiles-${story}&viewMode=story&globals=theme:${theme}`,
      { waitUntil: 'commit' }
    );
    const reached = await boundary;
    let pending;
    if (held) {
      await gate.requested;
      pending = await page.evaluate(() => ({
        ready:
          document
            .querySelector('#storybook-root')
            ?.getAttribute('data-story-ready') === 'true',
        focusCount: Number(
          document.documentElement.dataset['fontTestFocus'] ?? 0
        ),
      }));
      gate.release(undefined);
    }
    await page.waitForFunction(
      () =>
        document
          .querySelector('#storybook-root')
          ?.getAttribute('data-story-ready') === 'true'
    );
    await page.evaluate(() => document.fonts.ready);
    expect(errors).toEqual([]);
    const state = await fontViewport(page);
    const png = await page.locator('#storybook-root').screenshot({
      animations: 'disabled',
      path: info.outputPath(held ? 'held-font.png' : 'ready-font.png'),
    });
    await info.attach(held ? 'held-font' : 'ready-font', {
      body: png,
      contentType: 'image/png',
    });
    return { state, png, reached, pending };
  } finally {
    gate.release(undefined);
    await page.close();
  }
}
