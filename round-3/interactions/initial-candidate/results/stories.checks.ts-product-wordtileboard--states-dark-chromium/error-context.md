# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> product-wordtileboard--states dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  Expected an image 390px by 488px, received 390px by 500px. 16896 pixels (ratio 0.09 of all image pixels) are different.

  Snapshot: pkgs/ui-root-client-ts/src/word-tile-board/baselines/chromium/product-wordtileboard/states-dark.png

Call log:
  - Expect "toHaveScreenshot(pkgs/ui-root-client-ts/src/word-tile-board/baselines/chromium/product-wordtileboard/states-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - Expected an image 390px by 488px, received 390px by 500px. 16896 pixels (ratio 0.09 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - captured a stable screenshot
  - Expected an image 390px by 488px, received 390px by 500px. 16896 pixels (ratio 0.09 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [ref=e5]:
  - generic [ref=e6]:
    - generic [ref=e7]:
      - button "Fit board" [pressed] [ref=e8] [cursor=pointer]:
        - paragraph [ref=e11]: Fit board
      - button "Enlarge board" [ref=e12] [cursor=pointer]:
        - paragraph [ref=e15]: Enlarge board
    - region "Scrollable word board" [ref=e16]:
      - group "Example word board" [ref=e17]:
        - generic [ref=e19]: a
        - generic [ref=e20]: b
        - generic [ref=e21]: c
        - generic [ref=e22]: d
        - generic [ref=e23]: e
        - generic [ref=e24]: "1"
        - button "3W, a1, empty" [ref=e25] [cursor=pointer]:
          - generic [ref=e26]: 3W
        - button "b1, empty" [ref=e27] [cursor=pointer]
        - button "c1, empty" [ref=e28] [cursor=pointer]
        - button "d1, empty" [ref=e29] [cursor=pointer]
        - button "e1, empty" [ref=e30] [cursor=pointer]
        - generic [ref=e31]: "2"
        - button "a2, empty" [ref=e32] [cursor=pointer]
        - button "2L, b2, empty" [ref=e33] [cursor=pointer]:
          - generic [ref=e34]: 2L
        - button "c2, empty" [ref=e35] [cursor=pointer]
        - button "3L, d2, empty" [ref=e36] [cursor=pointer]:
          - generic [ref=e37]: 3L
        - button "e2, empty" [ref=e38] [cursor=pointer]
        - generic [ref=e39]: "3"
        - button "a3, empty" [ref=e40] [cursor=pointer]
        - button "C 1, b3" [disabled] [ref=e41]:
          - generic [ref=e42]: C
        - button "A 1, c3" [disabled] [ref=e43]:
          - generic [ref=e44]: A
        - button "T 1, d3" [disabled] [ref=e45]:
          - generic [ref=e46]: T
        - button "e3, empty" [ref=e47] [cursor=pointer]
        - generic [ref=e48]: "4"
        - button "a4, empty" [ref=e49] [cursor=pointer]
        - button "b4, empty" [ref=e50] [cursor=pointer]
        - button "c4, empty" [ref=e51] [cursor=pointer]
        - button "2W, d4, empty" [ref=e52] [cursor=pointer]:
          - generic [ref=e53]: 2W
        - button "e4, empty" [ref=e54] [cursor=pointer]
        - generic [ref=e55]: "5"
        - button "a5, empty" [ref=e56] [cursor=pointer]
        - button "b5, empty" [ref=e57] [cursor=pointer]
        - button "c5, empty" [ref=e58] [cursor=pointer]
        - button "d5, empty" [ref=e59] [cursor=pointer]
        - button "e5, empty" [ref=e60] [cursor=pointer]
  - group "Example rack" [ref=e61]:
    - button "S, 1 point" [ref=e62] [cursor=pointer]:
      - generic [ref=e63]: S
      - generic [ref=e64]: "1"
    - button "E, 1 point" [ref=e65] [cursor=pointer]:
      - generic [ref=e66]: E
      - generic [ref=e67]: "1"
    - button "A, 1 point" [ref=e68] [cursor=pointer]:
      - generic [ref=e69]: A
      - generic [ref=e70]: "1"
```

# Test source

```ts
  1  | // @io-wall-ok — browser verification adapter; all requests stay on the static server.
  2  | import { expect, type Page } from '@playwright/test';
  3  | import axe from 'axe-core';
  4  | import type { visualScenarios } from '../../storybook/scenarios';
  5  | 
  6  | /** The same readiness, accessibility and pixel contract for every canvas. */
  7  | export async function verifyStoryScenario(
  8  |   page: Page,
  9  |   storyId: string,
  10 |   scenario: ReturnType<typeof visualScenarios>[number]
  11 | ): Promise<void> {
  12 |   const { width, height, theme } = scenario;
  13 |   await page.setViewportSize({ width, height });
  14 |   const failures: string[] = [];
  15 |   page.on('pageerror', (error) => failures.push(error.message));
  16 |   await page.route('**/*', (route) =>
  17 |     new URL(route.request().url()).hostname === '127.0.0.1'
  18 |       ? route.continue()
  19 |       : route.abort()
  20 |   );
  21 |   await page.goto(
  22 |     `/iframe.html?id=${storyId}&viewMode=story&globals=theme:${theme}`
  23 |   );
  24 |   await expect
  25 |     .poll(async () =>
  26 |       page.locator('#storybook-root').evaluate((root) => {
  27 |         const status = root.getAttribute('data-story-status');
  28 |         if (status === 'error')
  29 |           return `error: ${root.getAttribute('data-story-error') ?? 'Storybook reported a failure'}`;
  30 |         return root.getAttribute('data-story-ready') === 'true'
  31 |           ? 'success'
  32 |           : 'pending';
  33 |       })
  34 |     )
  35 |     .toBe('success');
  36 |   await expect(page.locator('.sb-errordisplay')).not.toBeVisible();
  37 |   await page.evaluate(() => document.fonts.ready);
  38 |   await page.addScriptTag({ content: axe.source });
  39 |   const violations = await page.evaluate(async () => {
  40 |     const root = document.querySelector<HTMLElement>('#storybook-root');
  41 |     if (!root) throw new Error('Storybook canvas is missing');
  42 |     const result = await (window as unknown as { axe: typeof axe }).axe.run(
  43 |       root
  44 |     );
  45 |     return result.violations.filter(
  46 |       (v) => v.impact === 'serious' || v.impact === 'critical'
  47 |     );
  48 |   });
  49 |   expect(violations).toEqual([]);
  50 |   expect(failures).toEqual([]);
> 51 |   await expect(page.locator('#storybook-root')).toHaveScreenshot(
     |                                                 ^ Error: expect(locator).toHaveScreenshot(expected) failed
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```