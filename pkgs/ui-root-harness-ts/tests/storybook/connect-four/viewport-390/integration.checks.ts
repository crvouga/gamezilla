import { test } from '@playwright/test';
import { defineControls } from '../controls';
import { defineGestures } from '../gestures';
import { boardContext } from '../matrix';
import { defineReview } from '../review';

test.use(boardContext(390));
for (const theme of ['light', 'dark']) {
  defineReview(390, theme);
  defineControls(390, theme);
}

defineGestures(390);
