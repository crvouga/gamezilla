import { test } from '@playwright/test';
import { defineInputChecks } from '../checks';

const viewport = { width: 768, height: 1024 };
test.use({
  viewport,
  hasTouch: true,
  video: { mode: 'on', size: viewport },
  trace: 'on',
});

test.describe('tablet', defineInputChecks);
