# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> product-cellgridboard--states light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  Expected an image 390px by 256px, received 390px by 270px. 11651 pixels (ratio 0.12 of all image pixels) are different.

  Snapshot: pkgs/ui-root-client-ts/src/cell-grid-board/baselines/chromium/product-cellgridboard/states-light.png

Call log:
  - Expect "toHaveScreenshot(pkgs/ui-root-client-ts/src/cell-grid-board/baselines/chromium/product-cellgridboard/states-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - Expected an image 390px by 256px, received 390px by 270px. 11651 pixels (ratio 0.12 of all image pixels) are different.
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
  - Expected an image 390px by 256px, received 390px by 270px. 11651 pixels (ratio 0.12 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [ref=e7]:
  - radiogroup "Grids" [ref=e9]:
    - radio "First grid" [checked] [ref=e10] [cursor=pointer]:
      - generic [ref=e11]: First grid
    - radio "Second grid" [ref=e12] [cursor=pointer]:
      - generic [ref=e13]: Second grid
  - region "First grid" [ref=e14]:
    - group "First grid" [ref=e15]:
      - generic [ref=e17]: A
      - generic [ref=e18]: B
      - generic [ref=e19]: C
      - generic [ref=e20]: D
      - generic [ref=e21]: E
      - generic [ref=e22]: "1"
      - 'button "A1: empty" [ref=e23] [cursor=pointer]'
      - 'button "B1: taken" [ref=e24] [cursor=pointer]':
        - generic: ■
      - 'button "C1: passed" [ref=e25] [cursor=pointer]':
        - generic: •
      - 'button "D1: flagged" [ref=e26] [cursor=pointer]':
        - generic: ✕
      - 'button "E1: closed" [ref=e27] [cursor=pointer]':
        - generic: ✖
      - generic [ref=e28]: "2"
      - 'button "A2: empty" [ref=e29] [cursor=pointer]'
      - 'button "B2: taken" [ref=e30] [cursor=pointer]':
        - generic: ■
      - 'button "C2: passed" [ref=e31] [cursor=pointer]':
        - generic: •
      - 'button "D2: flagged" [ref=e32] [cursor=pointer]':
        - generic: ✕
      - 'button "E2: closed" [ref=e33] [cursor=pointer]':
        - generic: ✖
      - generic [ref=e34]: "3"
      - 'button "A3: empty" [ref=e35] [cursor=pointer]'
      - 'button "B3: taken" [ref=e36] [cursor=pointer]':
        - generic: ■
      - 'button "C3: passed" [ref=e37] [cursor=pointer]':
        - generic: •
      - 'button "D3: flagged" [ref=e38] [cursor=pointer]':
        - generic: ✕
      - 'button "E3: closed" [ref=e39] [cursor=pointer]':
        - generic: ✖
      - generic [ref=e40]: "4"
      - 'button "A4: empty" [ref=e41] [cursor=pointer]'
      - 'button "B4: taken" [ref=e42] [cursor=pointer]':
        - generic: ■
      - 'button "C4: passed" [ref=e43] [cursor=pointer]':
        - generic: •
      - 'button "D4: flagged" [ref=e44] [cursor=pointer]':
        - generic: ✕
      - 'button "E4: closed" [ref=e45] [cursor=pointer]':
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
     |                                                 ^ Error: expect(locator).toHaveScreenshot(expected) failed
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```