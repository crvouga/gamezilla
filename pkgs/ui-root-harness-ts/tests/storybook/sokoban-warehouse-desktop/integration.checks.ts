import { test } from '@playwright/test';
import { inspectWarehouse } from '../sokoban-warehouse/inspect-warehouse';

const viewport = { width: 1440, height: 900 };
test.use({
  viewport,
  hasTouch: false,
  video: { mode: 'on', size: viewport },
  trace: 'on',
});

test('storybook integration: Sokoban trackpad board inspection, push and undo', async ({
  page,
}, info) => {
  await inspectWarehouse(page, info, 'trackpad');
});
