# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-connect-four-board--full-board-draw light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  1619 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/connect-four-client-ts/src/baselines/chromium/screens-games-connect-four-board/full-board-draw-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/connect-four-client-ts/src/baselines/chromium/screens-games-connect-four-board/full-board-draw-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 1619 pixels (ratio 0.01 of all image pixels) are different.
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
  - 1619 pixels (ratio 0.01 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e15]:
    - generic [ref=e16]:
      - heading "Connect Four" [level=1] [ref=e19]
      - generic [ref=e21]:
        - generic [ref=e22]: Unrated
        - generic [ref=e23]: ·Untimed
    - generic [ref=e25]:
      - generic [ref=e27]:
        - generic [ref=e34]:
          - img "Yellow diamond" [ref=e35]:
            - generic [ref=e36]: ◆
          - generic [ref=e37]: jordan_plays
        - group "Connect Four board, seven columns and six rows" [ref=e39]:
          - button "Column 1, full" [disabled] [active] [ref=e40]:
            - generic [ref=e42]: "1"
            - generic [ref=e44]: ◆
            - generic [ref=e46]: ●
            - generic [ref=e48]: ◆
            - generic [ref=e50]: ●
            - generic [ref=e52]: ◆
            - generic [ref=e54]: ●
          - generic [ref=e55]: "Column 1, row 6: Yellow diamond. Column 1, row 5: Red circle. Column 1, row 4: Yellow diamond. Column 1, row 3: Red circle. Column 1, row 2: Yellow diamond. Column 1, row 1: Red circle"
          - button "Column 2, full" [disabled] [ref=e56]:
            - generic [ref=e58]: "2"
            - generic [ref=e60]: ◆
            - generic [ref=e62]: ●
            - generic [ref=e64]: ◆
            - generic [ref=e66]: ●
            - generic [ref=e68]: ◆
            - generic [ref=e70]: ●
          - generic [ref=e71]: "Column 2, row 6: Yellow diamond. Column 2, row 5: Red circle. Column 2, row 4: Yellow diamond. Column 2, row 3: Red circle. Column 2, row 2: Yellow diamond. Column 2, row 1: Red circle"
          - button "Column 3, full" [disabled] [ref=e72]:
            - generic [ref=e74]: "3"
            - generic [ref=e76]: ◆
            - generic [ref=e78]: ●
            - generic [ref=e80]: ◆
            - generic [ref=e82]: ●
            - generic [ref=e84]: ◆
            - generic [ref=e86]: ●
          - generic [ref=e87]: "Column 3, row 6: Yellow diamond. Column 3, row 5: Red circle. Column 3, row 4: Yellow diamond. Column 3, row 3: Red circle. Column 3, row 2: Yellow diamond. Column 3, row 1: Red circle"
          - button "Column 4, full" [disabled] [ref=e88]:
            - generic [ref=e90]: "4"
            - generic [ref=e92]: ●
            - generic [ref=e94]: ◆
            - generic [ref=e96]: ●
            - generic [ref=e98]: ◆
            - generic [ref=e100]: ●
            - generic [ref=e102]: ◆
          - generic [ref=e103]: "Column 4, row 6: Red circle. Column 4, row 5: Yellow diamond. Column 4, row 4: Red circle. Column 4, row 3: Yellow diamond. Column 4, row 2: Red circle. Column 4, row 1: Yellow diamond"
          - button "Column 5, full" [disabled] [ref=e104]:
            - generic [ref=e106]: "5"
            - generic [ref=e108]: ◆
            - generic [ref=e110]: ●
            - generic [ref=e112]: ◆
            - generic [ref=e114]: ●
            - generic [ref=e116]: ◆
            - generic [ref=e118]: ●
          - generic [ref=e119]: "Column 5, row 6: Yellow diamond. Column 5, row 5: Red circle. Column 5, row 4: Yellow diamond. Column 5, row 3: Red circle. Column 5, row 2: Yellow diamond. Column 5, row 1: Red circle"
          - button "Column 6, full" [disabled] [ref=e120]:
            - generic [ref=e122]: "6"
            - generic [ref=e124]: ◆
            - generic [ref=e126]: ●
            - generic [ref=e128]: ◆
            - generic [ref=e130]: ●
            - generic [ref=e132]: ◆
            - generic [ref=e134]: ●
          - generic [ref=e135]: "Column 6, row 6: Yellow diamond. Column 6, row 5: Red circle. Column 6, row 4: Yellow diamond. Column 6, row 3: Red circle. Column 6, row 2: Yellow diamond. Column 6, row 1: Red circle"
          - button "Column 7, full" [disabled] [ref=e136]:
            - generic [ref=e138]: "7"
            - generic [ref=e140]: ◆
            - generic [ref=e142]: ●
            - generic [ref=e144]: ◆
            - generic [ref=e146]: ●
            - generic [ref=e148]: ◆
            - generic [ref=e150]: ●
          - generic [ref=e151]: "Column 7, row 6: Yellow diamond. Column 7, row 5: Red circle. Column 7, row 4: Yellow diamond. Column 7, row 3: Red circle. Column 7, row 2: Yellow diamond. Column 7, row 1: Red circle"
        - status [ref=e153]:
          - generic [ref=e154]:
            - generic [ref=e155]: "Red circle: avery. Yellow diamond: jordan_plays."
            - text: The board is full. Game drawn.
        - generic [ref=e163]:
          - img "Red circle" [ref=e164]:
            - generic [ref=e165]: ●
          - generic [ref=e166]: avery
      - generic [ref=e168]:
        - heading "Draw" [level=2] [ref=e170]
        - list "Standings" [ref=e171]:
          - listitem [ref=e172]:
            - generic [ref=e173]:
              - generic [ref=e174]: 1st
              - generic [ref=e177]: avery
          - listitem [ref=e178]:
            - generic [ref=e179]:
              - generic [ref=e180]: 1st
              - generic [ref=e183]: jordan_plays
      - region "Game record" [ref=e186]:
        - generic [ref=e187]:
          - heading "Game record" [level=2] [ref=e189]
          - paragraph [ref=e190]: The board is full. Game drawn.
        - generic [ref=e192]:
          - group "What next" [ref=e193]:
            - button "Rematch" [ref=e194] [cursor=pointer]:
              - paragraph [ref=e197]: Rematch
            - button "Change game" [ref=e198] [cursor=pointer]:
              - paragraph [ref=e201]: Change game
            - button "Review" [ref=e202] [cursor=pointer]:
              - paragraph [ref=e205]: Review
          - button "History and stats" [ref=e206] [cursor=pointer]:
            - paragraph [ref=e209]: History and stats
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