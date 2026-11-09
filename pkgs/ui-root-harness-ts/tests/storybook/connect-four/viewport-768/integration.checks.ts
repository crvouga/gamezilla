import { test } from '@playwright/test';
import { defineControls } from '../controls';
import { boardContext } from '../matrix';
import { defineReview } from '../review';

test.use(boardContext(768));
for (const theme of ['light', 'dark']) {
  defineReview(768, theme);
  defineControls(768, theme);
}
