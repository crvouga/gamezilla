// @io-wall-ok — controlled browser network handshake; test-owned pages and files.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect, test } from '@playwright/test';
import { captureFontSchedule } from './font-capture';

const cases = [
  ['board--recall-and-restore', 'light', 1440],
  ['board--recover-and-submit', 'dark', 1440],
  ['puzzle--enlarged-blank', 'light', 1440],
  ['puzzle--enlarged-blank', 'dark', 1440],
  ['board--accepted-exchange', 'dark', 390],
  ['board--accepted-exchange', 'light', 390],
  ['board--accepted-pass', 'light', 390],
] as const;

// regression: storybook-word-tiles-font-focus-scroll-race
for (const [story, theme, width] of cases) {
  test(`storybook integration: font readiness ${story} ${theme} ${width}x844`, async ({
    context,
  }, info) => {
    const results = [];
    for (const held of [false, true]) {
      results.push(
        await captureFontSchedule(
          await context.newPage(),
          { story, theme, held, width },
          info
        )
      );
    }
    const [ready, held] = results;
    if (!ready || !held) throw new Error('Both font schedules are required');
    const pair = JSON.stringify(
      results.map(({ state, reached, pending }) => ({
        state,
        reached,
        pending,
      })),
      null,
      2
    );
    await writeFile(info.outputPath('viewport-pair.json'), pair);
    await info.attach('viewport-pair', {
      body: pair,
      contentType: 'application/json',
    });
    expect.soft(held.state).toEqual(ready.state);
    // Same-run, same-OS oracle in test output; never writes shared references.
    const name = [
      'pkgs',
      'ui-root-harness-ts',
      '.cache',
      'font-readiness',
      `${story}-${theme}-${width}.png`,
    ];
    await mkdir(dirname(info.snapshotPath(...name)), { recursive: true });
    await writeFile(info.snapshotPath(...name), ready.png);
    expect.soft(held.png).toMatchSnapshot(name);
    expect.soft(held.pending).toEqual({ ready: false, focusCount: 0 });
    expect(held.reached).toBe('font-load');
  });
}

// regression: storybook-word-tiles-font-focus-scroll-race
test('storybook integration: font readiness failure stays a native loader failure', async ({
  page,
}) => {
  await page.route(/\.woff2?(?:\?|$)/, (route) => route.abort('failed'));
  await page.goto(
    '/iframe.html?id=screens-games-word-tiles-puzzle--enlarged-blank&viewMode=story'
  );
  await expect(page.locator('.sb-errordisplay')).toBeVisible();
  expect(
    await page.locator('#storybook-root').getAttribute('data-story-ready')
  ).not.toBe('true');
});
