import { test } from '@playwright/test';
import { captureInactiveKeyboard, captureKeyboard } from './keyboard';
import { captureMotion } from './motion';
import { captureTouchEdges } from './touch';

export function defineControls(width: number) {
  test(`storybook integration: connect-four native keyboard ${width} dark`, async ({
    page,
  }, info) => {
    await captureKeyboard(page, info);
  });
  test(`storybook integration: connect-four inactive keyboard ${width} dark`, async ({
    page,
  }, info) => {
    await captureInactiveKeyboard(page, info);
  });
  test(`storybook integration: connect-four touch boundaries ${width} dark`, async ({
    page,
  }, info) => {
    await captureTouchEdges(page, info);
  });
  for (const reduced of [true, false]) {
    test(`storybook integration: connect-four motion ${reduced ? 'reduced' : 'normal'} ${width} dark`, async ({
      page,
    }, info) => {
      await captureMotion(page, info, reduced);
    });
  }
}
