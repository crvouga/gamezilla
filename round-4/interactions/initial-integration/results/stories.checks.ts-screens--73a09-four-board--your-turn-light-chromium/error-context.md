# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-connect-four-board--your-turn light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  603 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/connect-four-client-ts/src/baselines/chromium/screens-games-connect-four-board/your-turn-light.png

Call log:
  - Expect "toHaveScreenshot(libs/connect-four-client-ts/src/baselines/chromium/screens-games-connect-four-board/your-turn-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 603 pixels (ratio 0.01 of all image pixels) are different.
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
  - 603 pixels (ratio 0.01 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - heading "Connect Four" [level=1] [ref=e16]
      - generic [ref=e18]:
        - generic [ref=e19]: Unrated
        - generic [ref=e20]: ·Untimed
    - generic [ref=e21]:
      - generic [ref=e24]:
        - paragraph [ref=e27]: Live
        - list "Moves played" [ref=e32]:
          - listitem [ref=e33]:
            - generic [ref=e34]: Move 5
            - generic [ref=e35]: Column
            - generic [ref=e36]:
              - generic [ref=e38]: ●
              - 'button "Move 9, Red circle: 7" [ref=e39] [cursor=pointer]': "7"
            - generic [ref=e40]:
              - generic [ref=e42]: ◆
              - 'button "Move 10, Yellow diamond: 4" [ref=e43] [cursor=pointer]': "4"
        - button "All moves" [ref=e44] [cursor=pointer]:
          - img [ref=e48]
      - generic [ref=e50]:
        - generic [ref=e52]:
          - generic [ref=e59]:
            - img "Yellow diamond" [ref=e60]:
              - generic [ref=e61]: ◆
            - generic [ref=e62]: jordan_plays
          - group "Connect Four board, seven columns and six rows" [ref=e64]:
            - paragraph [ref=e65]: Drop in column 6
            - button "Drop in column 1, 0 of 6 occupied" [ref=e66] [cursor=pointer]:
              - generic [ref=e68]: "1"
            - generic [ref=e81]: "Column 1, row 6: Empty. Column 1, row 5: Empty. Column 1, row 4: Empty. Column 1, row 3: Empty. Column 1, row 2: Empty. Column 1, row 1: Empty"
            - button "Drop in column 2, 1 of 6 occupied" [ref=e82] [cursor=pointer]:
              - generic [ref=e84]: "2"
              - generic [ref=e96]: ◆
            - generic [ref=e97]: "Column 2, row 6: Empty. Column 2, row 5: Empty. Column 2, row 4: Empty. Column 2, row 3: Empty. Column 2, row 2: Empty. Column 2, row 1: Yellow diamond"
            - button "Drop in column 3, 2 of 6 occupied" [ref=e98] [cursor=pointer]:
              - generic [ref=e100]: "3"
              - generic [ref=e110]: ●
              - generic [ref=e112]: ●
            - generic [ref=e113]: "Column 3, row 6: Empty. Column 3, row 5: Empty. Column 3, row 4: Empty. Column 3, row 3: Empty. Column 3, row 2: Red circle. Column 3, row 1: Red circle"
            - button "Drop in column 4, 3 of 6 occupied" [ref=e114] [cursor=pointer]:
              - generic [ref=e116]: "4"
              - generic [ref=e124]: ◆
              - generic [ref=e126]: ◆
              - generic [ref=e128]: ●
            - generic [ref=e129]: "Column 4, row 6: Empty. Column 4, row 5: Empty. Column 4, row 4: Empty. Column 4, row 3: Yellow diamond. Column 4, row 2: Yellow diamond. Column 4, row 1: Red circle"
            - button "Drop in column 5, 2 of 6 occupied" [ref=e130] [cursor=pointer]:
              - generic [ref=e132]: "5"
              - generic [ref=e142]: ●
              - generic [ref=e144]: ◆
            - generic [ref=e145]: "Column 5, row 6: Empty. Column 5, row 5: Empty. Column 5, row 4: Empty. Column 5, row 3: Empty. Column 5, row 2: Red circle. Column 5, row 1: Yellow diamond"
            - button "Drop in column 6, 1 of 6 occupied" [ref=e146] [cursor=pointer]:
              - generic [ref=e148]: "6"
              - generic [ref=e160]: ◆
            - generic [ref=e161]: "Column 6, row 6: Empty. Column 6, row 5: Empty. Column 6, row 4: Empty. Column 6, row 3: Empty. Column 6, row 2: Empty. Column 6, row 1: Yellow diamond"
            - button "Drop in column 7, 1 of 6 occupied" [ref=e162] [cursor=pointer]:
              - generic [ref=e164]: "7"
              - generic [ref=e176]: ●
            - generic [ref=e177]: "Column 7, row 6: Empty. Column 7, row 5: Empty. Column 7, row 4: Empty. Column 7, row 3: Empty. Column 7, row 2: Empty. Column 7, row 1: Red circle"
          - status [ref=e179]:
            - generic [ref=e180]:
              - generic [ref=e181]: "Red circle: avery. Yellow diamond: jordan_plays."
              - text: Red circle to move.
          - generic [ref=e189]:
            - img "Red circle" [ref=e190]:
              - generic [ref=e191]: ●
            - generic [ref=e192]: avery
            - generic [ref=e193]: Your move
        - generic [ref=e196]:
          - group "Game actions" [ref=e197]:
            - button "Offer draw" [ref=e198] [cursor=pointer]:
              - paragraph [ref=e201]: Offer draw
            - button "Resign game" [ref=e202] [cursor=pointer]:
              - paragraph [ref=e205]:
                - text: Resign
                - generic [ref=e206]: game
          - button "History and stats" [ref=e207] [cursor=pointer]:
            - generic [ref=e209]:
              - paragraph [ref=e210]: History and stats
              - img [ref=e213]
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