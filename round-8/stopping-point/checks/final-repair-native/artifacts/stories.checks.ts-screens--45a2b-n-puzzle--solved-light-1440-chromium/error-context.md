# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-sokoban-puzzle--solved light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  232741 pixels (ratio 0.20 of all image pixels) are different.

  Snapshot: libs/sokoban-client-ts/src/baselines/chromium/screens-games-sokoban-puzzle/solved-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/sokoban-client-ts/src/baselines/chromium/screens-games-sokoban-puzzle/solved-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 232741 pixels (ratio 0.20 of all image pixels) are different.
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
  - 232741 pixels (ratio 0.20 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e9]:
    - generic [ref=e11]:
      - img "Unnamed App" [ref=e13]:
        - img [ref=e14]
        - generic [ref=e15]: Unnamed App
      - navigation "Navigation" [ref=e16]:
        - button "Spaces" [ref=e17] [cursor=pointer]:
          - img [ref=e19]
          - generic [ref=e21]: Spaces
        - button "Search" [ref=e22] [cursor=pointer]:
          - img [ref=e24]
          - generic [ref=e27]: Search
        - button "Notifications" [ref=e28] [cursor=pointer]:
          - img [ref=e30]
          - generic [ref=e33]: Notifications
        - button "Profile" [ref=e34] [cursor=pointer]:
          - img [ref=e36]
          - generic [ref=e39]: Profile
      - button "@avery, account menu" [ref=e43] [cursor=pointer]:
        - generic [ref=e46]: "@avery"
    - generic [ref=e50]:
      - generic [ref=e52]:
        - navigation "Breadcrumb" [ref=e55]:
          - list [ref=e56]:
            - listitem [ref=e57]:
              - generic [ref=e58]:
                - generic [ref=e59]: F
                - generic [ref=e60]: Friday game night
        - generic [ref=e63]:
          - button "People in this space" [ref=e65] [cursor=pointer]:
            - img [ref=e69]
          - button "Minimize space" [ref=e75] [cursor=pointer]:
            - img [ref=e79]
          - button "More" [ref=e83] [cursor=pointer]:
            - img [ref=e86]
      - generic [ref=e93]:
        - generic [ref=e94]:
          - heading "Two crates" [level=1] [ref=e97]
          - generic [ref=e100]: Easy
        - generic [ref=e101]:
          - paragraph [ref=e102]: Push each crate onto a goal.
          - generic [ref=e103]:
            - generic [ref=e105]:
              - group "Sokoban board" [active] [ref=e106]:
                - generic [ref=e107]:
                  - 'img "A1: wall" [ref=e108]'
                  - 'img "B1: wall" [ref=e109]'
                  - 'img "C1: wall" [ref=e110]'
                  - 'img "D1: wall" [ref=e111]'
                  - 'img "E1: wall" [ref=e112]'
                  - 'img "F1: wall" [ref=e113]'
                  - 'img "G1: wall" [ref=e114]'
                  - 'img "A2: wall" [ref=e115]'
                  - 'img "B2: floor" [ref=e116]'
                  - 'img "C2: floor" [ref=e117]'
                  - 'img "D2: floor" [ref=e118]'
                  - 'img "E2: floor" [ref=e119]'
                  - 'img "F2: floor" [ref=e120]'
                  - 'img "G2: wall" [ref=e121]'
                  - 'img "A3: wall" [ref=e122]'
                  - 'img "B3: floor" [ref=e123]'
                  - 'img "C3: floor, worker" [ref=e124]'
                  - 'img "D3: floor" [ref=e125]'
                  - 'img "E3: goal, crate" [ref=e126]'
                  - 'img "F3: floor" [ref=e128]'
                  - 'img "G3: wall" [ref=e129]'
                  - 'img "A4: wall" [ref=e130]'
                  - 'img "B4: floor" [ref=e131]'
                  - 'img "C4: floor" [ref=e132]'
                  - 'img "D4: floor" [ref=e133]'
                  - 'img "E4: goal, crate" [ref=e134]'
                  - 'img "F4: floor" [ref=e136]'
                  - 'img "G4: wall" [ref=e137]'
                  - 'img "A5: wall" [ref=e138]'
                  - 'img "B5: floor" [ref=e139]'
                  - 'img "C5: floor" [ref=e140]'
                  - 'img "D5: floor" [ref=e141]'
                  - 'img "E5: floor" [ref=e142]'
                  - 'img "F5: floor" [ref=e143]'
                  - 'img "G5: wall" [ref=e144]'
                  - 'img "A6: wall" [ref=e145]'
                  - 'img "B6: wall" [ref=e146]'
                  - 'img "C6: wall" [ref=e147]'
                  - 'img "D6: wall" [ref=e148]'
                  - 'img "E6: wall" [ref=e149]'
                  - 'img "F6: wall" [ref=e150]'
                  - 'img "G6: wall" [ref=e151]'
                - generic:
                  - generic:
                    - generic: ▣
                  - generic:
                    - generic: ▣
                  - generic:
                    - generic: ☻
              - generic [ref=e152]:
                - img [ref=e155]
                - generic [ref=e158]:
                  - status [ref=e159]: All crates are on goals
                  - paragraph [ref=e160]: Keep playing or choose another puzzle.
                  - button "Choose another puzzle" [ref=e161] [cursor=pointer]:
                    - paragraph [ref=e164]: Choose another puzzle
              - generic [ref=e166]:
                - status [ref=e167]: Moves 8 · Pushes 4
                - paragraph [ref=e168]: Move with the arrow keys or W A S D, or click a square beside the worker.
            - generic [ref=e171]:
              - button "Undo" [ref=e172] [cursor=pointer]:
                - paragraph [ref=e175]: Undo
              - button "Redo" [disabled] [ref=e176]:
                - paragraph [ref=e179]: Redo
              - button "Restart" [ref=e180] [cursor=pointer]:
                - paragraph [ref=e183]: Restart
            - region "Puzzle 3 of 4 in Warehouse basics" [ref=e185]:
              - heading "Puzzle 3 of 4 in Warehouse basics" [level=2] [ref=e188]
              - progressbar "Puzzle 3 of 4" [ref=e190]
              - status [ref=e192]: Progress saved on this device.
              - status [ref=e193]:
                - img [ref=e196]
                - generic [ref=e199]:
                  - paragraph [ref=e200]: Completion saved
                  - paragraph [ref=e201]: Your completion is saved. You can keep playing or choose another puzzle.
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