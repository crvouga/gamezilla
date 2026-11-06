# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-sokoban-puzzle--solve-with-keyboard light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  1864 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/sokoban-client-ts/src/baselines/chromium/screens-games-sokoban-puzzle/solve-with-keyboard-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/sokoban-client-ts/src/baselines/chromium/screens-games-sokoban-puzzle/solve-with-keyboard-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 1864 pixels (ratio 0.01 of all image pixels) are different.
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
  - 1864 pixels (ratio 0.01 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e15]:
    - generic [ref=e16]:
      - heading "Two crates" [level=1] [ref=e19]
      - generic [ref=e22]: Easy
    - generic [ref=e23]:
      - paragraph [ref=e24]: Push each crate onto a goal.
      - generic [ref=e25]:
        - generic [ref=e27]:
          - group "Sokoban board" [active] [ref=e28]:
            - generic [ref=e29]:
              - 'img "A1: wall" [ref=e30]'
              - 'img "B1: wall" [ref=e31]'
              - 'img "C1: wall" [ref=e32]'
              - 'img "D1: wall" [ref=e33]'
              - 'img "E1: wall" [ref=e34]'
              - 'img "F1: wall" [ref=e35]'
              - 'img "G1: wall" [ref=e36]'
              - 'img "A2: wall" [ref=e37]'
              - 'img "B2: floor" [ref=e38]'
              - 'img "C2: floor" [ref=e39]'
              - 'img "D2: floor" [ref=e40]'
              - 'img "E2: floor" [ref=e41]'
              - 'img "F2: floor" [ref=e42]'
              - 'img "G2: wall" [ref=e43]'
              - 'img "A3: wall" [ref=e44]'
              - 'img "B3: floor" [ref=e45]'
              - 'img "C3: floor" [ref=e46]'
              - 'img "D3: floor, worker" [ref=e47]'
              - 'img "E3: goal, crate" [ref=e48]'
              - 'img "F3: floor" [ref=e50]'
              - 'img "G3: wall" [ref=e51]'
              - 'img "A4: wall" [ref=e52]'
              - 'img "B4: floor" [ref=e53]'
              - 'img "C4: floor" [ref=e54]'
              - 'img "D4: floor" [ref=e55]'
              - 'img "E4: goal, crate" [ref=e56]'
              - 'img "F4: floor" [ref=e58]'
              - 'img "G4: wall" [ref=e59]'
              - 'img "A5: wall" [ref=e60]'
              - 'img "B5: floor" [ref=e61]'
              - 'img "C5: floor" [ref=e62]'
              - 'img "D5: floor" [ref=e63]'
              - 'img "E5: floor" [ref=e64]'
              - 'img "F5: floor" [ref=e65]'
              - 'img "G5: wall" [ref=e66]'
              - 'img "A6: wall" [ref=e67]'
              - 'img "B6: wall" [ref=e68]'
              - 'img "C6: wall" [ref=e69]'
              - 'img "D6: wall" [ref=e70]'
              - 'img "E6: wall" [ref=e71]'
              - 'img "F6: wall" [ref=e72]'
              - 'img "G6: wall" [ref=e73]'
            - generic:
              - generic:
                - generic: ▣
              - generic:
                - generic: ▣
              - generic:
                - generic: ☻
          - generic [ref=e75]:
            - status [ref=e76]: Moves 7 · Pushes 4
            - paragraph [ref=e77]: Move with the arrow keys or W A S D, or click a square beside the worker.
        - generic [ref=e80]:
          - button "Undo" [ref=e81] [cursor=pointer]:
            - paragraph [ref=e84]: Undo
          - button "Redo" [disabled] [ref=e85]:
            - paragraph [ref=e88]: Redo
          - button "Restart" [ref=e89] [cursor=pointer]:
            - paragraph [ref=e92]: Restart
        - region "Puzzle 3 of 4 in Warehouse basics" [ref=e94]:
          - heading "Puzzle 3 of 4 in Warehouse basics" [level=2] [ref=e97]
          - progressbar "Puzzle 3 of 4" [ref=e99]
          - status [ref=e101]: Progress saved on this device.
          - status [ref=e102]:
            - img [ref=e105]
            - generic [ref=e108]:
              - paragraph [ref=e109]: Puzzle completed
              - paragraph [ref=e110]: Your completion is saved. You can keep playing or choose another puzzle.
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