# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-sokoban-puzzle--solved dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  59242 pixels (ratio 0.18 of all image pixels) are different.

  Snapshot: libs/sokoban-client-ts/src/baselines/chromium/screens-games-sokoban-puzzle/solved-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/sokoban-client-ts/src/baselines/chromium/screens-games-sokoban-puzzle/solved-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 59242 pixels (ratio 0.18 of all image pixels) are different.
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
  - 59242 pixels (ratio 0.18 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e10]:
    - generic [ref=e12]:
      - button "Spaces" [ref=e14] [cursor=pointer]:
        - img [ref=e17]
      - generic [ref=e21]:
        - paragraph [ref=e22]: Spaces
        - paragraph [ref=e23]: Friday game night
      - generic [ref=e25]:
        - button "2 people in this space" [ref=e27] [cursor=pointer]:
          - img [ref=e31]
        - button "More" [ref=e37] [cursor=pointer]:
          - img [ref=e40]
      - button "Account menu" [ref=e45] [cursor=pointer]
    - generic [ref=e50]:
      - generic [ref=e51]:
        - heading "Two crates" [level=1] [ref=e54]
        - generic [ref=e57]: Easy
      - generic [ref=e58]:
        - paragraph [ref=e59]: Push each crate onto a goal.
        - generic [ref=e60]:
          - generic [ref=e62]:
            - group "Sokoban board" [active] [ref=e63]:
              - generic [ref=e64]:
                - 'img "A1: wall" [ref=e65]'
                - 'img "B1: wall" [ref=e66]'
                - 'img "C1: wall" [ref=e67]'
                - 'img "D1: wall" [ref=e68]'
                - 'img "E1: wall" [ref=e69]'
                - 'img "F1: wall" [ref=e70]'
                - 'img "G1: wall" [ref=e71]'
                - 'img "A2: wall" [ref=e72]'
                - 'img "B2: floor" [ref=e73]'
                - 'img "C2: floor" [ref=e74]'
                - 'img "D2: floor" [ref=e75]'
                - 'img "E2: floor" [ref=e76]'
                - 'img "F2: floor" [ref=e77]'
                - 'img "G2: wall" [ref=e78]'
                - 'img "A3: wall" [ref=e79]'
                - 'img "B3: floor" [ref=e80]'
                - 'img "C3: floor, worker" [ref=e81]'
                - 'img "D3: floor" [ref=e82]'
                - 'img "E3: goal, crate" [ref=e83]'
                - 'img "F3: floor" [ref=e85]'
                - 'img "G3: wall" [ref=e86]'
                - 'img "A4: wall" [ref=e87]'
                - 'img "B4: floor" [ref=e88]'
                - 'img "C4: floor" [ref=e89]'
                - 'img "D4: floor" [ref=e90]'
                - 'img "E4: goal, crate" [ref=e91]'
                - 'img "F4: floor" [ref=e93]'
                - 'img "G4: wall" [ref=e94]'
                - 'img "A5: wall" [ref=e95]'
                - 'img "B5: floor" [ref=e96]'
                - 'img "C5: floor" [ref=e97]'
                - 'img "D5: floor" [ref=e98]'
                - 'img "E5: floor" [ref=e99]'
                - 'img "F5: floor" [ref=e100]'
                - 'img "G5: wall" [ref=e101]'
                - 'img "A6: wall" [ref=e102]'
                - 'img "B6: wall" [ref=e103]'
                - 'img "C6: wall" [ref=e104]'
                - 'img "D6: wall" [ref=e105]'
                - 'img "E6: wall" [ref=e106]'
                - 'img "F6: wall" [ref=e107]'
                - 'img "G6: wall" [ref=e108]'
              - generic:
                - generic:
                  - generic: ▣
                - generic:
                  - generic: ▣
                - generic:
                  - generic: ☻
            - generic [ref=e109]:
              - img [ref=e112]
              - generic [ref=e115]:
                - status [ref=e116]: All crates are on goals
                - paragraph [ref=e117]: Keep playing or choose another puzzle.
                - button "Choose another puzzle" [ref=e118] [cursor=pointer]:
                  - paragraph [ref=e121]: Choose another puzzle
            - generic [ref=e122]:
              - generic [ref=e123]:
                - status [ref=e124]: Moves 8 · Pushes 4
                - paragraph [ref=e125]: Swipe, tap beside the worker, or use the pad.
              - group [ref=e126]:
                - button "Move up" [ref=e127] [cursor=pointer]:
                  - img [ref=e128]
                - button "Move left" [ref=e130] [cursor=pointer]:
                  - img [ref=e131]
                - button "Move right" [ref=e133] [cursor=pointer]:
                  - img [ref=e134]
                - button "Move down" [ref=e136] [cursor=pointer]:
                  - img [ref=e137]
          - generic [ref=e141]:
            - button "Undo" [ref=e142] [cursor=pointer]:
              - paragraph [ref=e145]: Undo
            - button "Redo" [disabled] [ref=e146]:
              - paragraph [ref=e149]: Redo
            - button "Restart" [ref=e150] [cursor=pointer]:
              - paragraph [ref=e153]: Restart
          - region "Puzzle 3 of 4 in Warehouse basics" [ref=e155]:
            - heading "Puzzle 3 of 4 in Warehouse basics" [level=2] [ref=e158]
            - progressbar "Puzzle 3 of 4" [ref=e160]
            - status [ref=e162]: Progress saved on this device.
            - status [ref=e163]:
              - img [ref=e166]
              - generic [ref=e169]:
                - paragraph [ref=e170]: Completion saved
                - paragraph [ref=e171]: Your completion is saved. You can keep playing or choose another puzzle.
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