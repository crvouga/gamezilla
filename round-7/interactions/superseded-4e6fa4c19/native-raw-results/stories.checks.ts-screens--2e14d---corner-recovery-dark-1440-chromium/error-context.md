# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-sokoban-puzzle--corner-recovery dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  5238 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/sokoban-client-ts/src/baselines/chromium/screens-games-sokoban-puzzle/corner-recovery-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/sokoban-client-ts/src/baselines/chromium/screens-games-sokoban-puzzle/corner-recovery-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 5238 pixels (ratio 0.01 of all image pixels) are different.
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
  - 5238 pixels (ratio 0.01 of all image pixels) are different.

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
          - group "Sokoban board" [ref=e28]:
            - generic [ref=e29]:
              - 'img "A1: wall" [ref=e30]'
              - 'img "B1: wall" [ref=e31]'
              - 'img "C1: wall" [ref=e32]'
              - 'img "D1: wall" [ref=e33]'
              - 'img "E1: wall" [ref=e34]'
              - 'img "F1: wall" [ref=e35]'
              - 'img "A2: wall" [ref=e36]'
              - 'img "B2: floor" [ref=e37]'
              - 'img "C2: floor, crate" [ref=e38]'
              - 'img "D2: floor, worker" [ref=e39]'
              - 'img "E2: goal" [ref=e40]'
              - 'img "F2: wall" [ref=e42]'
              - 'img "A3: wall" [ref=e43]'
              - 'img "B3: floor" [ref=e44]'
              - 'img "C3: floor" [ref=e45]'
              - 'img "D3: floor" [ref=e46]'
              - 'img "E3: floor" [ref=e47]'
              - 'img "F3: wall" [ref=e48]'
              - 'img "A4: wall" [ref=e49]'
              - 'img "B4: wall" [ref=e50]'
              - 'img "C4: wall" [ref=e51]'
              - 'img "D4: wall" [ref=e52]'
              - 'img "E4: wall" [ref=e53]'
              - 'img "F4: wall" [ref=e54]'
            - generic:
              - generic:
                - generic: ▢
              - generic:
                - generic: ☻
          - generic [ref=e56]:
            - status [ref=e57]: Moves 0 · Pushes 0
            - paragraph [ref=e58]: Move with the arrow keys or W A S D, or click a square beside the worker.
        - generic [ref=e61]:
          - button "Undo" [disabled] [ref=e62]:
            - paragraph [ref=e65]: Undo
          - button "Redo" [disabled] [ref=e66]:
            - paragraph [ref=e69]: Redo
          - button "Restart" [active] [ref=e70] [cursor=pointer]:
            - paragraph [ref=e73]: Restart
        - region "Puzzle 3 of 4 in Warehouse basics" [ref=e75]:
          - heading "Puzzle 3 of 4 in Warehouse basics" [level=2] [ref=e78]
          - progressbar "Puzzle 3 of 4" [ref=e80]
          - status [ref=e82]: Progress saved on this device.
          - status [ref=e83]:
            - img [ref=e86]
            - generic [ref=e89]:
              - paragraph [ref=e90]: Completion saved
              - paragraph [ref=e91]: Your completion is saved. You can keep playing or choose another puzzle.
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