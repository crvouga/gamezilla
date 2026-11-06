# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-sokoban-puzzle--disabled dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  1064 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/sokoban-client-ts/src/baselines/chromium/screens-games-sokoban-puzzle/disabled-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/sokoban-client-ts/src/baselines/chromium/screens-games-sokoban-puzzle/disabled-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 1064 pixels (ratio 0.01 of all image pixels) are different.
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
  - 1064 pixels (ratio 0.01 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - heading "Two crates" [level=1] [ref=e16]
      - generic [ref=e19]: Easy
    - generic [ref=e20]:
      - paragraph [ref=e21]: Push each crate onto a goal.
      - generic [ref=e22]:
        - generic [ref=e24]:
          - group "Sokoban board" [ref=e25]:
            - generic [ref=e26]:
              - 'img "A1: wall" [ref=e27]'
              - 'img "B1: wall" [ref=e28]'
              - 'img "C1: wall" [ref=e29]'
              - 'img "D1: wall" [ref=e30]'
              - 'img "E1: wall" [ref=e31]'
              - 'img "F1: wall" [ref=e32]'
              - 'img "G1: wall" [ref=e33]'
              - 'img "A2: wall" [ref=e34]'
              - 'img "B2: floor" [ref=e35]'
              - 'img "C2: floor" [ref=e36]'
              - 'img "D2: floor" [ref=e37]'
              - 'img "E2: floor" [ref=e38]'
              - 'img "F2: floor" [ref=e39]'
              - 'img "G2: wall" [ref=e40]'
              - 'img "A3: wall" [ref=e41]'
              - 'img "B3: floor" [ref=e42]'
              - 'img "C3: floor, crate" [ref=e43]'
              - 'img "D3: floor" [ref=e44]'
              - 'img "E3: goal" [ref=e45]'
              - 'img "F3: floor" [ref=e47]'
              - 'img "G3: wall" [ref=e48]'
              - 'img "A4: wall" [ref=e49]'
              - 'img "B4: floor, worker" [ref=e50]'
              - 'img "C4: floor, crate" [ref=e51]'
              - 'img "D4: floor" [ref=e52]'
              - 'img "E4: goal" [ref=e53]'
              - 'img "F4: floor" [ref=e55]'
              - 'img "G4: wall" [ref=e56]'
              - 'img "A5: wall" [ref=e57]'
              - 'img "B5: floor" [ref=e58]'
              - 'img "C5: floor" [ref=e59]'
              - 'img "D5: floor" [ref=e60]'
              - 'img "E5: floor" [ref=e61]'
              - 'img "F5: floor" [ref=e62]'
              - 'img "G5: wall" [ref=e63]'
              - 'img "A6: wall" [ref=e64]'
              - 'img "B6: wall" [ref=e65]'
              - 'img "C6: wall" [ref=e66]'
              - 'img "D6: wall" [ref=e67]'
              - 'img "E6: wall" [ref=e68]'
              - 'img "F6: wall" [ref=e69]'
              - 'img "G6: wall" [ref=e70]'
            - generic:
              - generic:
                - generic: ▢
              - generic:
                - generic: ▢
              - generic:
                - generic: ☻
          - generic [ref=e71]:
            - generic [ref=e72]:
              - status [ref=e73]: Moves 0 · Pushes 0
              - paragraph [ref=e74]: Swipe, tap beside the worker, or use the pad.
            - group [ref=e75]:
              - button "Move up" [ref=e76] [cursor=pointer]:
                - img [ref=e77]
              - button "Move left" [ref=e79] [cursor=pointer]:
                - img [ref=e80]
              - button "Move right" [ref=e82] [cursor=pointer]:
                - img [ref=e83]
              - button "Move down" [ref=e85] [cursor=pointer]:
                - img [ref=e86]
          - status [ref=e88]: Keeping your move. Your next directions will wait.
        - generic [ref=e91]:
          - button "Undo" [disabled] [ref=e92]:
            - paragraph [ref=e95]: Undo
          - button "Redo" [disabled] [ref=e96]:
            - paragraph [ref=e99]: Redo
          - button "Restart" [disabled] [ref=e100]:
            - paragraph [ref=e103]: Restart
        - region "Puzzle 3 of 4 in Warehouse basics" [ref=e105]:
          - heading "Puzzle 3 of 4 in Warehouse basics" [level=2] [ref=e108]
          - progressbar "Puzzle 3 of 4" [ref=e110]
          - status [ref=e112]: Progress saved on this device.
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