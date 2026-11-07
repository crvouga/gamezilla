# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: board-round-five.checks.ts >> product-cellgridboard--states light-1440
- Location: tests/storybook/board-round-five.checks.ts:149:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/pkgs/ui-root-client-ts/src/cell-grid-board/baselines/chromium/product-cellgridboard/states-light-1440.png.
```

# Page snapshot

```yaml
- generic [ref=e7]:
  - region "First grid" [ref=e8]:
    - group "First grid" [ref=e9]:
      - generic [ref=e11]: A
      - generic [ref=e12]: B
      - generic [ref=e13]: C
      - generic [ref=e14]: D
      - generic [ref=e15]: E
      - generic [ref=e16]: "1"
      - 'button "A1: empty" [ref=e17] [cursor=pointer]'
      - 'button "B1: taken" [ref=e18] [cursor=pointer]':
        - generic: ■
      - 'button "C1: passed" [ref=e19] [cursor=pointer]':
        - generic: •
      - 'button "D1: flagged" [ref=e20] [cursor=pointer]':
        - generic: ✕
      - 'button "E1: closed" [ref=e21] [cursor=pointer]':
        - generic: ✖
      - generic [ref=e22]: "2"
      - 'button "A2: empty" [ref=e23] [cursor=pointer]'
      - 'button "B2: taken" [ref=e24] [cursor=pointer]':
        - generic: ■
      - 'button "C2: passed" [ref=e25] [cursor=pointer]':
        - generic: •
      - 'button "D2: flagged" [ref=e26] [cursor=pointer]':
        - generic: ✕
      - 'button "E2: closed" [ref=e27] [cursor=pointer]':
        - generic: ✖
      - generic [ref=e28]: "3"
      - 'button "A3: empty" [ref=e29] [cursor=pointer]'
      - 'button "B3: taken" [ref=e30] [cursor=pointer]':
        - generic: ■
      - 'button "C3: passed" [ref=e31] [cursor=pointer]':
        - generic: •
      - 'button "D3: flagged" [ref=e32] [cursor=pointer]':
        - generic: ✕
      - 'button "E3: closed" [ref=e33] [cursor=pointer]':
        - generic: ✖
      - generic [ref=e34]: "4"
      - 'button "A4: empty" [ref=e35] [cursor=pointer]'
      - 'button "B4: taken" [ref=e36] [cursor=pointer]':
        - generic: ■
      - 'button "C4: passed" [ref=e37] [cursor=pointer]':
        - generic: •
      - 'button "D4: flagged" [ref=e38] [cursor=pointer]':
        - generic: ✕
      - 'button "E4: closed" [ref=e39] [cursor=pointer]':
        - generic: ✖
  - region "Second grid" [ref=e40]:
    - group "Second grid" [ref=e41]:
      - generic [ref=e43]: A
      - generic [ref=e44]: B
      - generic [ref=e45]: C
      - generic [ref=e46]: D
      - generic [ref=e47]: E
      - generic [ref=e48]: "1"
      - 'button "A1: empty" [ref=e49] [cursor=pointer]'
      - 'button "B1: taken" [ref=e50] [cursor=pointer]':
        - generic: ■
      - 'button "C1: passed" [ref=e51] [cursor=pointer]':
        - generic: •
      - 'button "D1: flagged" [ref=e52] [cursor=pointer]':
        - generic: ✕
      - 'button "E1: closed" [ref=e53] [cursor=pointer]':
        - generic: ✖
      - generic [ref=e54]: "2"
      - 'button "A2: empty" [ref=e55] [cursor=pointer]'
      - 'button "B2: taken" [ref=e56] [cursor=pointer]':
        - generic: ■
      - 'button "C2: passed" [ref=e57] [cursor=pointer]':
        - generic: •
      - 'button "D2: flagged" [ref=e58] [cursor=pointer]':
        - generic: ✕
      - 'button "E2: closed" [ref=e59] [cursor=pointer]':
        - generic: ✖
      - generic [ref=e60]: "3"
      - 'button "A3: empty" [ref=e61] [cursor=pointer]'
      - 'button "B3: taken" [ref=e62] [cursor=pointer]':
        - generic: ■
      - 'button "C3: passed" [ref=e63] [cursor=pointer]':
        - generic: •
      - 'button "D3: flagged" [ref=e64] [cursor=pointer]':
        - generic: ✕
      - 'button "E3: closed" [ref=e65] [cursor=pointer]':
        - generic: ✖
      - generic [ref=e66]: "4"
      - 'button "A4: empty" [ref=e67] [cursor=pointer]'
      - 'button "B4: taken" [ref=e68] [cursor=pointer]':
        - generic: ■
      - 'button "C4: passed" [ref=e69] [cursor=pointer]':
        - generic: •
      - 'button "D4: flagged" [ref=e70] [cursor=pointer]':
        - generic: ✕
      - 'button "E4: closed" [ref=e71] [cursor=pointer]':
        - generic: ✖
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/pkgs/ui-root-client-ts/src/cell-grid-board/baselines/chromium/product-cellgridboard/states-light-1440.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```