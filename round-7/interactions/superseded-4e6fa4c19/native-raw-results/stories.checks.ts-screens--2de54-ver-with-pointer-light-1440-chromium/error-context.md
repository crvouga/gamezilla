# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-numberlink-puzzle--recover-with-pointer light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  7418 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/numberlink-client-ts/src/baselines/chromium/screens-games-numberlink-puzzle/recover-with-pointer-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/numberlink-client-ts/src/baselines/chromium/screens-games-numberlink-puzzle/recover-with-pointer-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 7418 pixels (ratio 0.01 of all image pixels) are different.
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
  - 7418 pixels (ratio 0.01 of all image pixels) are different.

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
          - group "Numberlink board" [ref=e28]:
            - img
            - 'button "A1: endpoint 1, connected" [ref=e29] [cursor=pointer]':
              - generic: "1"
            - 'button "B1: path 1, connected" [ref=e30] [cursor=pointer]'
            - 'button "C1: path 1, connected" [ref=e31] [cursor=pointer]'
            - 'button "D1: path 1, connected" [ref=e32] [cursor=pointer]'
            - 'button "E1: endpoint 2, unfinished" [ref=e33] [cursor=pointer]':
              - generic: "2"
            - 'button "A2: endpoint 3, unfinished" [ref=e34] [cursor=pointer]':
              - generic: "3"
            - 'button "B2: empty" [ref=e35] [cursor=pointer]'
            - 'button "C2: empty" [ref=e36] [cursor=pointer]'
            - 'button "D2: path 1, connected" [ref=e37] [cursor=pointer]'
            - 'button "E2: empty" [ref=e38] [cursor=pointer]'
            - 'button "A3: endpoint 4, unfinished" [ref=e39] [cursor=pointer]':
              - generic: "4"
            - 'button "B3: empty" [ref=e40] [cursor=pointer]'
            - 'button "C3: empty" [ref=e41] [cursor=pointer]'
            - 'button "D3: endpoint 1, connected" [ref=e42] [cursor=pointer]':
              - generic: "1"
            - 'button "E3: empty" [ref=e43] [cursor=pointer]'
            - 'button "A4: endpoint 5, unfinished" [ref=e44] [cursor=pointer]':
              - generic: "5"
            - 'button "B4: endpoint 4, unfinished" [ref=e45] [cursor=pointer]':
              - generic: "4"
            - 'button "C4: endpoint 3, unfinished" [ref=e46] [cursor=pointer]':
              - generic: "3"
            - 'button "D4: endpoint 2, unfinished" [ref=e47] [cursor=pointer]':
              - generic: "2"
            - 'button "E4: empty" [ref=e48] [cursor=pointer]'
            - 'button "A5: empty" [ref=e49] [cursor=pointer]'
            - 'button "B5: empty" [ref=e50] [cursor=pointer]'
            - 'button "C5: empty" [ref=e51] [cursor=pointer]'
            - 'button "D5: empty" [ref=e52] [cursor=pointer]'
            - 'button "E5: endpoint 5, unfinished" [ref=e53] [cursor=pointer]':
              - generic: "5"
          - paragraph [ref=e54]: 1/5 pairs connected — 6/25 cells covered
          - paragraph [ref=e55]: Drag from a number to its match.
          - button "Remove a path" [ref=e57] [cursor=pointer]:
            - paragraph [ref=e58]: Remove a path
            - img [ref=e60]
          - button "Drawing and keyboard help" [ref=e63] [cursor=pointer]:
            - img [ref=e66]
            - paragraph [ref=e68]: Drawing and keyboard help
        - generic [ref=e71]:
          - button "Undo" [ref=e72] [cursor=pointer]:
            - paragraph [ref=e75]: Undo
          - button "Redo" [disabled] [ref=e76]:
            - paragraph [ref=e79]: Redo
          - button "Restart" [ref=e80] [cursor=pointer]:
            - paragraph [ref=e83]: Restart
          - button "Pack overview" [ref=e84] [cursor=pointer]:
            - paragraph [ref=e87]: Pack overview
        - region "Puzzle 2 of 5 in Linking practice" [ref=e89]:
          - heading "Puzzle 2 of 5 in Linking practice" [level=2] [ref=e92]
          - progressbar "Puzzle 2 of 5" [ref=e94]
          - generic "This attempt" [ref=e96]:
            - generic [ref=e97]:
              - term [ref=e98]: Connected pairs
              - definition [ref=e99]: "1"
              - definition
            - generic [ref=e100]:
              - term [ref=e101]: Covered cells
              - definition [ref=e102]: "6"
              - definition
          - status [ref=e103]: Progress saved on this device.
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