# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-numberlink-puzzle--solved light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  676 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/numberlink-client-ts/src/baselines/chromium/screens-games-numberlink-puzzle/solved-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/numberlink-client-ts/src/baselines/chromium/screens-games-numberlink-puzzle/solved-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 676 pixels (ratio 0.01 of all image pixels) are different.
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
  - 676 pixels (ratio 0.01 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e15]:
    - generic [ref=e16]:
      - heading "Five pairs" [level=1] [ref=e19]
      - generic [ref=e22]: Medium
    - generic [ref=e23]:
      - paragraph [ref=e24]: Join each pair of numbers and fill every square.
      - generic [ref=e25]:
        - generic [ref=e27]:
          - generic [ref=e28]:
            - img [ref=e31]
            - generic [ref=e34]:
              - paragraph [ref=e35]: Puzzle solved
              - paragraph [ref=e36]: Every pair is connected. Your completed paths are shown below.
          - group "Numberlink board" [ref=e37]:
            - img
            - 'button "A1: endpoint 1, connected" [disabled] [ref=e38]':
              - generic: "1"
            - 'button "B1: path 1, connected" [disabled] [ref=e39]'
            - 'button "C1: path 1, connected" [disabled] [ref=e40]'
            - 'button "D1: path 1, connected" [disabled] [ref=e41]'
            - 'button "E1: endpoint 2, connected" [disabled] [ref=e42]':
              - generic: "2"
            - 'button "A2: endpoint 3, connected" [disabled] [ref=e43]':
              - generic: "3"
            - 'button "B2: path 3, connected" [disabled] [ref=e44]'
            - 'button "C2: path 3, connected" [disabled] [ref=e45]'
            - 'button "D2: path 1, connected" [disabled] [ref=e46]'
            - 'button "E2: path 2, connected" [disabled] [ref=e47]'
            - 'button "A3: endpoint 4, connected" [disabled] [ref=e48]':
              - generic: "4"
            - 'button "B3: path 4, connected" [disabled] [ref=e49]'
            - 'button "C3: path 3, connected" [disabled] [ref=e50]'
            - 'button "D3: endpoint 1, connected" [disabled] [ref=e51]':
              - generic: "1"
            - 'button "E3: path 2, connected" [disabled] [ref=e52]'
            - 'button "A4: endpoint 5, connected" [disabled] [ref=e53]':
              - generic: "5"
            - 'button "B4: endpoint 4, connected" [disabled] [ref=e54]':
              - generic: "4"
            - 'button "C4: endpoint 3, connected" [disabled] [ref=e55]':
              - generic: "3"
            - 'button "D4: endpoint 2, connected" [disabled] [ref=e56]':
              - generic: "2"
            - 'button "E4: path 2, connected" [disabled] [ref=e57]'
            - 'button "A5: path 5, connected" [disabled] [ref=e58]'
            - 'button "B5: path 5, connected" [disabled] [ref=e59]'
            - 'button "C5: path 5, connected" [disabled] [ref=e60]'
            - 'button "D5: path 5, connected" [disabled] [ref=e61]'
            - 'button "E5: endpoint 5, connected" [disabled] [ref=e62]':
              - generic: "5"
        - generic [ref=e65]:
          - button "Undo" [disabled] [ref=e66]:
            - paragraph [ref=e69]: Undo
          - button "Redo" [disabled] [ref=e70]:
            - paragraph [ref=e73]: Redo
          - button "Restart" [disabled] [ref=e74]:
            - paragraph [ref=e77]: Restart
          - button "Pack overview" [ref=e78] [cursor=pointer]:
            - paragraph [ref=e81]: Pack overview
        - region "Puzzle 2 of 5 in Linking practice" [ref=e83]:
          - heading "Puzzle 2 of 5 in Linking practice" [level=2] [ref=e86]
          - progressbar "Puzzle 2 of 5" [ref=e88]
          - generic "This attempt" [ref=e90]:
            - generic [ref=e91]:
              - term [ref=e92]: Connected pairs
              - definition [ref=e93]: "5"
              - definition
            - generic [ref=e94]:
              - term [ref=e95]: Covered cells
              - definition [ref=e96]: "25"
              - definition
          - status [ref=e97]: Progress saved on this device.
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