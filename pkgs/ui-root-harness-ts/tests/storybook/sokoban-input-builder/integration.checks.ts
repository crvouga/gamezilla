import { expect, test } from '@playwright/test';
import { builderGeometry } from '../sokoban-input/builder-geometry';
import { capture, openSokoban } from '../sokoban-overhaul/evidence';

const viewport = { width: 1200, height: 884 };
test.use({
  hasTouch: true,
  viewport,
  video: { mode: 'on', size: viewport },
  trace: 'on',
});

test('storybook integration: Sokoban builder controls remain reachable at the reported viewport', async ({
  page,
}, info) => {
  await openSokoban(page, 'editor--two-crates', 'dark');
  await capture(page, info, 'builder-top');
  const geometry = await builderGeometry(page, info);
  expect(
    geometry.controls.filter(
      (control) => control.inScroller && !control.topmost
    ),
    JSON.stringify(geometry)
  ).toEqual([]);
  await capture(page, info, 'builder-bottom');
  for (const name of ['Undo', 'Redo']) {
    const control = page.getByRole('button', { name, exact: true });
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeInViewport();
  }
  // Preview is a row of the builder's hub, a screen before the board.
  await page.goto(
    '/iframe.html?id=screens-puzzles-content-author--editing&viewMode=story&globals=theme:dark'
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  const preview = page.getByTestId('content-preview');
  await preview.click({ trial: true });
  await capture(page, info, 'builder-preview-reachable');
});
