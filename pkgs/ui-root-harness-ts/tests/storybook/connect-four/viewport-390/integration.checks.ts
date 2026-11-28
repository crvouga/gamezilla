import { test } from '@playwright/test';
import { defineControls } from '../controls';
import { defineGestures } from '../gestures';
import { boardContext } from '../matrix';
import { defineReview } from '../review';

test.use(boardContext(390));

defineReview(390);
defineControls(390);

defineGestures(390);
