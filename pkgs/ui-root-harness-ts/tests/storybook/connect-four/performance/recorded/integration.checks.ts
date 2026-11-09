import { test } from '@playwright/test';
import { defineProfiles } from '../probe';

test.describe.configure({ mode: 'default' });
test.use({
  trace: 'on',
  video: { mode: 'on', size: { width: 390, height: 844 } },
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});
defineProfiles(true);
