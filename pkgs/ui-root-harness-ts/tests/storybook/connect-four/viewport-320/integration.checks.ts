import { test } from '@playwright/test';
import { defineControls } from '../controls';
import { boardContext } from '../matrix';
import { defineReview } from '../review';

test.use(boardContext(320));
for (const theme of ['light', 'dark']) {
  defineReview(320, theme);
  defineControls(320, theme);
}
