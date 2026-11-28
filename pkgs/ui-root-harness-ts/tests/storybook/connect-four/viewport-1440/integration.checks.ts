import { test } from '@playwright/test';
import { defineControls } from '../controls';
import { defineGestures } from '../gestures';
import { boardContext } from '../matrix';
import { defineReview } from '../review';

test.use(boardContext(1440));

defineReview(1440);
defineControls(1440);

defineGestures(1440);
