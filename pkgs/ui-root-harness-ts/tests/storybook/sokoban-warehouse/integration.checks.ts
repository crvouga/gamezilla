import { test } from '@playwright/test';
import { inspectWarehouse } from './inspect-warehouse';

const viewport = { width: 390, height: 844 };
test.use({
  viewport,
  hasTouch: true,
  video: { mode: 'on', size: viewport },
  trace: 'on',
});

test('storybook integration: Sokoban touch board inspection, push and undo', async ({
  page,
}, info) => {
  await inspectWarehouse(page, info, 'touch');
});
