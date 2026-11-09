import { test } from '@playwright/test';
import { defineProfiles } from '../probe';

test.describe.configure({ mode: 'default' });
test.use({
  trace: 'off',
  video: 'off',
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});
defineProfiles(false);
