import { test } from '@playwright/test';
import { defineInputChecks } from '../checks';
import { defineLockedInspectionChecks } from '../locked-checks';

const viewport = { width: 1440, height: 900 };
test.use({
  viewport,
  hasTouch: true,
  video: { mode: 'on', size: viewport },
  trace: 'on',
});

test.describe('desktop', () => {
  defineInputChecks();
  defineLockedInspectionChecks();
});
