import { test } from '@playwright/test';
import { defineControls } from '../controls';
import { boardContext } from '../matrix';
import { defineReview } from '../review';

test.use(boardContext(1440));
for (const theme of ['light', 'dark']) {
  defineReview(1440, theme);
  defineControls(1440, theme);
}
