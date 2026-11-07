# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> product-wordtileboard--states light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  Expected an image 390px by 488px, received 390px by 524px. 96822 pixels (ratio 0.48 of all image pixels) are different.

  Snapshot: pkgs/ui-root-client-ts/src/word-tile-board/baselines/chromium/product-wordtileboard/states-light.png

Call log:
  - Expect "toHaveScreenshot(pkgs/ui-root-client-ts/src/word-tile-board/baselines/chromium/product-wordtileboard/states-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - Expected an image 390px by 488px, received 390px by 524px. 96822 pixels (ratio 0.48 of all image pixels) are different.
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
  - Expected an image 390px by 488px, received 390px by 524px. 96822 pixels (ratio 0.48 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [ref=e5]:
  - generic [ref=e7]:
    - region "Scrollable word board" [ref=e8]:
      - group "Example word board" [ref=e9]:
        - generic [ref=e11]: a
        - generic [ref=e12]: b
        - generic [ref=e13]: c
        - generic [ref=e14]: d
        - generic [ref=e15]: e
        - generic [ref=e16]: "1"
        - button "3W, a1, empty" [ref=e17] [cursor=pointer]:
          - generic [ref=e18]: 3W
        - button "b1, empty" [ref=e19] [cursor=pointer]
        - button "c1, empty" [ref=e20] [cursor=pointer]
        - button "d1, empty" [ref=e21] [cursor=pointer]
        - button "e1, empty" [ref=e22] [cursor=pointer]
        - generic [ref=e23]: "2"
        - button "a2, empty" [ref=e24] [cursor=pointer]
        - button "2L, b2, empty" [ref=e25] [cursor=pointer]:
          - generic [ref=e26]: 2L
        - button "c2, empty" [ref=e27] [cursor=pointer]
        - button "3L, d2, empty" [ref=e28] [cursor=pointer]:
          - generic [ref=e29]: 3L
        - button "e2, empty" [ref=e30] [cursor=pointer]
        - generic [ref=e31]: "3"
        - button "a3, empty" [ref=e32] [cursor=pointer]
        - button "C 1, b3" [disabled] [ref=e33]:
          - generic [ref=e34]: C
        - button "A 1, c3" [disabled] [ref=e35]:
          - generic [ref=e36]: A
        - button "T 1, d3" [disabled] [ref=e37]:
          - generic [ref=e38]: T
        - button "e3, empty" [ref=e39] [cursor=pointer]
        - generic [ref=e40]: "4"
        - button "a4, empty" [ref=e41] [cursor=pointer]
        - button "b4, empty" [ref=e42] [cursor=pointer]
        - button "c4, empty" [ref=e43] [cursor=pointer]
        - button "2W, d4, empty" [ref=e44] [cursor=pointer]:
          - generic [ref=e45]: 2W
        - button "e4, empty" [ref=e46] [cursor=pointer]
        - generic [ref=e47]: "5"
        - button "a5, empty" [ref=e48] [cursor=pointer]
        - button "b5, empty" [ref=e49] [cursor=pointer]
        - button "c5, empty" [ref=e50] [cursor=pointer]
        - button "d5, empty" [ref=e51] [cursor=pointer]
        - button "e5, empty" [ref=e52] [cursor=pointer]
    - generic [ref=e53]:
      - generic [ref=e54]:
        - img "Whole board overview; outline shows the enlarged area" [ref=e55]
        - group "View a board region" [ref=e82]:
          - button "View a1 to b2" [ref=e83] [cursor=pointer]
          - button "View b1 to d2" [ref=e84] [cursor=pointer]
          - button "View d1 to e2" [ref=e85] [cursor=pointer]
          - button "View a2 to b4" [ref=e86] [cursor=pointer]
          - button "View b2 to d4" [ref=e87] [cursor=pointer]
          - button "View d2 to e4" [ref=e88] [cursor=pointer]
          - button "View a4 to b5" [ref=e89] [cursor=pointer]
          - button "View b4 to d5" [ref=e90] [cursor=pointer]
          - button "View d4 to e5" [ref=e91] [cursor=pointer]
      - generic [ref=e92]:
        - generic [ref=e93]:
          - button "Fit board" [ref=e94] [cursor=pointer]:
            - paragraph [ref=e97]: Fit board
          - button "Enlarge board" [pressed] [ref=e98] [cursor=pointer]:
            - paragraph [ref=e101]: Enlarge board
        - paragraph [ref=e102]: A 1, c3
        - 'button "Board map: locate a square" [ref=e103] [cursor=pointer]': Map
  - group "Example rack" [ref=e104]:
    - button "S, 1 point" [ref=e105] [cursor=pointer]:
      - generic [ref=e106]: S
      - generic [ref=e107]: "1"
    - button "E, 1 point" [ref=e108] [cursor=pointer]:
      - generic [ref=e109]: E
      - generic [ref=e110]: "1"
    - button "A, 1 point" [ref=e111] [cursor=pointer]:
      - generic [ref=e112]: A
      - generic [ref=e113]: "1"
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