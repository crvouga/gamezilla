# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: board-round-five.checks.ts >> product-wordtileboard--enlarged-placement dark-1440
- Location: tests/storybook/board-round-five.checks.ts:149:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/pkgs/ui-root-client-ts/src/word-tile-board/baselines/chromium/product-wordtileboard/enlarged-placement-dark-1440.png.
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
    - region "Scrollable word board" [ref=e17]:
      - group "Example word board" [ref=e18]:
        - generic [ref=e20]: a
        - generic [ref=e21]: b
        - generic [ref=e22]: c
        - generic [ref=e23]: d
        - generic [ref=e24]: e
        - generic [ref=e25]: "1"
        - button "3W, a1, empty" [ref=e26] [cursor=pointer]:
          - generic [ref=e27]: 3W
        - button "b1, empty" [ref=e28] [cursor=pointer]
        - button "c1, empty" [ref=e29] [cursor=pointer]
        - button "d1, empty" [ref=e30] [cursor=pointer]
        - button "e1, empty" [ref=e31] [cursor=pointer]
        - generic [ref=e32]: "2"
        - button "a2, empty" [ref=e33] [cursor=pointer]
        - button "2L, b2, empty" [ref=e34] [cursor=pointer]:
          - generic [ref=e35]: 2L
        - button "c2, empty" [ref=e36] [cursor=pointer]
        - button "3L, d2, empty" [ref=e37] [cursor=pointer]:
          - generic [ref=e38]: 3L
        - button "e2, empty" [ref=e39] [cursor=pointer]
        - generic [ref=e40]: "3"
        - button "a3, empty" [ref=e41] [cursor=pointer]
        - button "C 1, b3" [disabled] [ref=e42]:
          - generic [ref=e43]: C
          - generic [ref=e44]: "1"
        - button "A 1, c3" [disabled] [ref=e45]:
          - generic [ref=e46]: A
          - generic [ref=e47]: "1"
        - button "T 1, d3" [disabled] [ref=e48]:
          - generic [ref=e49]: T
          - generic [ref=e50]: "1"
        - button "S 1, e3, tentative" [active] [ref=e51] [cursor=pointer]:
          - generic [ref=e52]: S
          - generic [ref=e53]: "1"
        - generic [ref=e54]: "4"
        - button "a4, empty" [ref=e55] [cursor=pointer]
        - button "b4, empty" [ref=e56] [cursor=pointer]
        - button "c4, empty" [ref=e57] [cursor=pointer]
        - button "2W, d4, empty" [ref=e58] [cursor=pointer]:
          - generic [ref=e59]: 2W
        - button "e4, empty" [ref=e60] [cursor=pointer]
        - generic [ref=e61]: "5"
        - button "a5, empty" [ref=e62] [cursor=pointer]
        - button "b5, empty" [ref=e63] [cursor=pointer]
        - button "c5, empty" [ref=e64] [cursor=pointer]
        - button "d5, empty" [ref=e65] [cursor=pointer]
        - button "e5, empty" [ref=e66] [cursor=pointer]
  - group "Example rack" [ref=e67]:
    - button "S, 1 point" [ref=e68] [cursor=pointer]
    - button "E, 1 point" [ref=e69] [cursor=pointer]:
      - generic [ref=e70]: E
      - generic [ref=e71]: "1"
    - button "A, 1 point" [ref=e72] [cursor=pointer]:
      - generic [ref=e73]: A
      - generic [ref=e74]: "1"
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/pkgs/ui-root-client-ts/src/word-tile-board/baselines/chromium/product-wordtileboard/enlarged-placement-dark-1440.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```