import { test } from '@playwright/test';
import { captureInactiveKeyboard, captureKeyboard } from './keyboard';
import { captureMotion } from './motion';
import { captureTouchEdges } from './touch';

export function defineControls(width: number, theme: string) {
  test(`storybook integration: connect-four native keyboard ${width} ${theme}`, async ({
    page,
  }, info) => {
    await captureKeyboard(page, info, theme);
  });
  test(`storybook integration: connect-four inactive keyboard ${width} ${theme}`, async ({
    page,
  }, info) => {
    await captureInactiveKeyboard(page, info, theme);
  });
  test(`storybook integration: connect-four touch boundaries ${width} ${theme}`, async ({
    page,
  }, info) => {
    await captureTouchEdges(page, info, theme);
  });
  for (const reduced of [true, false]) {
    test(`storybook integration: connect-four motion ${reduced ? 'reduced' : 'normal'} ${width} ${theme}`, async ({
      page,
    }, info) => {
      await captureMotion(page, info, theme, reduced);
    });
  }
}
