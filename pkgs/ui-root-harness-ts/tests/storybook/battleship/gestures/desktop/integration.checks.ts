import { test } from '@playwright/test';
import { defineGestureChecks } from '../checks';

const viewport = { width: 1440, height: 900 };
test.use({
  viewport,
  hasTouch: true,
  contextOptions: { reducedMotion: 'no-preference' },
  video: { mode: 'on', size: viewport },
  trace: 'on',
});

test.describe(`Battleship board gestures ${viewport.width}`, () => {
  defineGestureChecks(viewport.width);
});
