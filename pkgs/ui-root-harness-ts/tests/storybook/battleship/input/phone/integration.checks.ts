import { test } from '@playwright/test';
import { defineInputChecks } from '../checks';

const viewport = { width: 390, height: 844 };
test.use({
  viewport,
  hasTouch: true,
  video: { mode: 'on', size: viewport },
  trace: 'on',
});

test.describe('phone', defineInputChecks);
