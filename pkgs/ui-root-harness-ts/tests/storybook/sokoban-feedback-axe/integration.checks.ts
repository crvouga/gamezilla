import { expect, test } from '@playwright/test';
import {
  accessibility,
  capture,
  openSokoban,
} from '../sokoban-overhaul/evidence';

const viewport = { width: 390, height: 844 };
test.use({ viewport, video: { mode: 'on', size: viewport }, trace: 'on' });

// regression: sokoban-feedback-states-not-scanned
for (const theme of ['light', 'dark'] as const) {
  test(`storybook integration: Sokoban blocked feedback passes axe at 390/${theme}`, async ({
    page,
  }, info) => {
    await openSokoban(page, 'puzzle--fresh', theme);
    const board = page.getByTestId('sokoban-board');
    await board.focus();
    await board.press('ArrowLeft');
    await expect(page.getByTestId('sokoban-refusal')).toBeVisible();
    await capture(page, info, `blocked-${theme}`);
    await accessibility(page, info);
  });
}
