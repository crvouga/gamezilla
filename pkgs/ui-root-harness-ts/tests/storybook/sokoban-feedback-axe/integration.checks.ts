import { expect, type Page, type TestInfo, test } from '@playwright/test';
import {
  accessibility,
  capture,
  openSokoban,
} from '../sokoban-overhaul/evidence';

const viewport = { width: 390, height: 844 };
test.use({ viewport, video: { mode: 'on', size: viewport }, trace: 'on' });

async function scanBlocked(page: Page, info: TestInfo) {
  await openSokoban(page, 'puzzle--fresh');
  const board = page.getByTestId('sokoban-board');
  await board.focus();
  await board.press('ArrowLeft');
  await expect(page.getByTestId('sokoban-refusal')).toBeVisible();
  await capture(page, info, `blocked-dark`);
  await accessibility(page, info, 'blocked');
}

// regression: sokoban-feedback-states-not-scanned
test('storybook integration: Sokoban blocked feedback passes axe at 390', async ({
  page,
}, info) => {
  await scanBlocked(page, info);
});
