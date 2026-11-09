import { expect, type Page, type TestInfo, test } from '@playwright/test';
import { builderControlsUncovered } from '../builder-control-visibility';

const viewport = { width: 1200, height: 884 };
test.use({ viewport, video: { mode: 'on', size: viewport }, trace: 'on' });

async function openBuilder(page: Page) {
  await page.goto(
    '/iframe.html?id=screens-games-sokoban-editor--two-crates&viewMode=story&globals=theme:dark'
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
}

async function capture(page: Page, info: TestInfo, state: string) {
  const path = info.outputPath(`${state}.png`);
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await info.attach(state, { path, contentType: 'image/png' });
}

// regression: sokoban-builder-scrollport-clipping-is-not-overlap
test('storybook integration: Sokoban builder clipping and scroll reachability', async ({
  page,
}, info) => {
  await openBuilder(page);
  await capture(page, info, 'builder-before-scroll');
  expect(await page.evaluate(builderControlsUncovered)).toEqual([]);
  await capture(page, info, 'builder-after-reachability');
});

test('storybook integration: Sokoban builder probe rejects a real covering layer', async ({
  page,
}, info) => {
  await openBuilder(page);
  await page.evaluate(() => {
    const scroller = document.querySelector(
      '[data-screen="puzzle-content-author"]'
    );
    if (!scroller) throw new Error('Missing builder');
    const bounds = scroller.getBoundingClientRect();
    const cover = document.createElement('div');
    Object.assign(cover.style, {
      position: 'fixed',
      top: `${bounds.top}px`,
      left: `${bounds.left}px`,
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
      zIndex: '2147483647',
    });
    cover.textContent = 'Test obstruction';
    document.body.append(cover);
  });
  const covered = await page.evaluate(builderControlsUncovered);
  expect(covered).toContain('top: Undo');
  expect(covered).toContain('reach: Undo');
  await capture(page, info, 'real-obstruction-detected');
});
