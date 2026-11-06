# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-numberlink-puzzle--disabled dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  8163 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: libs/numberlink-client-ts/src/baselines/chromium/screens-games-numberlink-puzzle/disabled-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/numberlink-client-ts/src/baselines/chromium/screens-games-numberlink-puzzle/disabled-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 8163 pixels (ratio 0.03 of all image pixels) are different.
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
  - 8163 pixels (ratio 0.03 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - heading "Five pairs" [level=1] [ref=e16]
      - generic [ref=e19]: Medium
    - generic [ref=e20]:
      - paragraph [ref=e21]: Join each pair of numbers and fill every square.
      - generic [ref=e22]:
        - generic [ref=e24]:
          - group "Numberlink board" [ref=e25]:
            - img
            - 'button "A1: endpoint 1, unfinished" [disabled] [ref=e26]':
              - generic: "1"
            - 'button "B1: empty" [disabled] [ref=e27]'
            - 'button "C1: empty" [disabled] [ref=e28]'
            - 'button "D1: empty" [disabled] [ref=e29]'
            - 'button "E1: endpoint 2, unfinished" [disabled] [ref=e30]':
              - generic: "2"
            - 'button "A2: endpoint 3, unfinished" [disabled] [ref=e31]':
              - generic: "3"
            - 'button "B2: empty" [disabled] [ref=e32]'
            - 'button "C2: empty" [disabled] [ref=e33]'
            - 'button "D2: empty" [disabled] [ref=e34]'
            - 'button "E2: empty" [disabled] [ref=e35]'
            - 'button "A3: endpoint 4, unfinished" [disabled] [ref=e36]':
              - generic: "4"
            - 'button "B3: empty" [disabled] [ref=e37]'
            - 'button "C3: empty" [disabled] [ref=e38]'
            - 'button "D3: endpoint 1, unfinished" [disabled] [ref=e39]':
              - generic: "1"
            - 'button "E3: empty" [disabled] [ref=e40]'
            - 'button "A4: endpoint 5, unfinished" [disabled] [ref=e41]':
              - generic: "5"
            - 'button "B4: endpoint 4, unfinished" [disabled] [ref=e42]':
              - generic: "4"
            - 'button "C4: endpoint 3, unfinished" [disabled] [ref=e43]':
              - generic: "3"
            - 'button "D4: endpoint 2, unfinished" [disabled] [ref=e44]':
              - generic: "2"
            - 'button "E4: empty" [disabled] [ref=e45]'
            - 'button "A5: empty" [disabled] [ref=e46]'
            - 'button "B5: empty" [disabled] [ref=e47]'
            - 'button "C5: empty" [disabled] [ref=e48]'
            - 'button "D5: empty" [disabled] [ref=e49]'
            - 'button "E5: endpoint 5, unfinished" [disabled] [ref=e50]':
              - generic: "5"
          - paragraph [ref=e51]: 0/5 pairs connected — 0/25 cells covered
          - generic [ref=e52]:
            - img [ref=e55]
            - generic [ref=e57]: Drawing is unavailable. You can still inspect the board.
        - generic [ref=e60]:
          - button "Undo" [disabled] [ref=e61]:
            - paragraph [ref=e64]: Undo
          - button "Redo" [disabled] [ref=e65]:
            - paragraph [ref=e68]: Redo
          - button "Restart" [disabled] [ref=e69]:
            - paragraph [ref=e72]: Restart
          - button "Pack overview" [ref=e73] [cursor=pointer]:
            - paragraph [ref=e76]: Pack overview
        - region "Puzzle 2 of 5 in Linking practice" [ref=e78]:
          - heading "Puzzle 2 of 5 in Linking practice" [level=2] [ref=e81]
          - progressbar "Puzzle 2 of 5" [ref=e83]
          - generic "This attempt" [ref=e85]:
            - generic [ref=e86]:
              - term [ref=e87]: Connected pairs
              - definition [ref=e88]: "0"
              - definition
            - generic [ref=e89]:
              - term [ref=e90]: Covered cells
              - definition [ref=e91]: "0"
              - definition
          - status [ref=e92]: Progress saved on this device.
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