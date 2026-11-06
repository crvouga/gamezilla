# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-numberlink-puzzle--recover-with-pointer dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  761 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/numberlink-client-ts/src/baselines/chromium/screens-games-numberlink-puzzle/recover-with-pointer-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/numberlink-client-ts/src/baselines/chromium/screens-games-numberlink-puzzle/recover-with-pointer-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 761 pixels (ratio 0.01 of all image pixels) are different.
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
  - 761 pixels (ratio 0.01 of all image pixels) are different.

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
            - 'button "A1: endpoint 1, connected" [ref=e26] [cursor=pointer]':
              - generic: "1"
            - 'button "B1: path 1, connected" [ref=e27] [cursor=pointer]'
            - 'button "C1: path 1, connected" [ref=e28] [cursor=pointer]'
            - 'button "D1: path 1, connected" [ref=e29] [cursor=pointer]'
            - 'button "E1: endpoint 2, unfinished" [ref=e30] [cursor=pointer]':
              - generic: "2"
            - 'button "A2: endpoint 3, unfinished" [ref=e31] [cursor=pointer]':
              - generic: "3"
            - 'button "B2: empty" [ref=e32] [cursor=pointer]'
            - 'button "C2: empty" [ref=e33] [cursor=pointer]'
            - 'button "D2: path 1, connected" [ref=e34] [cursor=pointer]'
            - 'button "E2: empty" [ref=e35] [cursor=pointer]'
            - 'button "A3: endpoint 4, unfinished" [ref=e36] [cursor=pointer]':
              - generic: "4"
            - 'button "B3: empty" [ref=e37] [cursor=pointer]'
            - 'button "C3: empty" [ref=e38] [cursor=pointer]'
            - 'button "D3: endpoint 1, connected" [ref=e39] [cursor=pointer]':
              - generic: "1"
            - 'button "E3: empty" [ref=e40] [cursor=pointer]'
            - 'button "A4: endpoint 5, unfinished" [ref=e41] [cursor=pointer]':
              - generic: "5"
            - 'button "B4: endpoint 4, unfinished" [ref=e42] [cursor=pointer]':
              - generic: "4"
            - 'button "C4: endpoint 3, unfinished" [ref=e43] [cursor=pointer]':
              - generic: "3"
            - 'button "D4: endpoint 2, unfinished" [ref=e44] [cursor=pointer]':
              - generic: "2"
            - 'button "E4: empty" [ref=e45] [cursor=pointer]'
            - 'button "A5: empty" [ref=e46] [cursor=pointer]'
            - 'button "B5: empty" [ref=e47] [cursor=pointer]'
            - 'button "C5: empty" [ref=e48] [cursor=pointer]'
            - 'button "D5: empty" [ref=e49] [cursor=pointer]'
            - 'button "E5: endpoint 5, unfinished" [ref=e50] [cursor=pointer]':
              - generic: "5"
          - paragraph [ref=e51]: Drag from a number to its match.
          - generic [ref=e52]:
            - paragraph [ref=e53]: Start again at a number to redraw its path. Drag back along your path to shorten it. Remove a drawn path below to start fresh.
            - button "Remove path 1" [ref=e55] [cursor=pointer]:
              - paragraph [ref=e58]: Remove path 1
        - generic [ref=e61]:
          - button "Undo" [ref=e62] [cursor=pointer]:
            - paragraph [ref=e65]: Undo
          - button "Redo" [disabled] [ref=e66]:
            - paragraph [ref=e69]: Redo
          - button "Restart" [ref=e70] [cursor=pointer]:
            - paragraph [ref=e73]: Restart
          - button "Pack overview" [ref=e74] [cursor=pointer]:
            - paragraph [ref=e77]: Pack overview
        - region "Puzzle 2 of 5 in Linking practice" [ref=e79]:
          - heading "Puzzle 2 of 5 in Linking practice" [level=2] [ref=e82]
          - progressbar "Puzzle 2 of 5" [ref=e84]
          - generic "This attempt" [ref=e86]:
            - generic [ref=e87]:
              - term [ref=e88]: Connected pairs
              - definition [ref=e89]: "1"
              - definition
            - generic [ref=e90]:
              - term [ref=e91]: Covered cells
              - definition [ref=e92]: "6"
              - definition
          - status [ref=e93]: Progress saved on this device.
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