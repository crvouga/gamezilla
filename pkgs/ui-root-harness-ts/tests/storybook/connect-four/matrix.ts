import { test } from '@playwright/test';

/** Fix the recording canvas before context creation, not only the page viewport. */
export function forEachBoard(define: (width: number, theme: string) => void) {
  for (const width of [320, 390, 768, 1440]) {
    for (const theme of ['light', 'dark']) {
      const size = { width, height: width < 768 ? 844 : 1024 };
      test.describe(`Connect Four ${width} ${theme}`, () => {
        test.use({
          viewport: size,
          video: { mode: 'on', size },
          trace: 'on',
          hasTouch: true,
        });
        define(width, theme);
      });
    }
  }
}
