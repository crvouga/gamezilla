import { test } from '@playwright/test';
import { defineControls } from '../controls';
import { boardContext } from '../matrix';
import { defineReview } from '../review';

test.use(boardContext(320));

defineReview(320);
defineControls(320);
