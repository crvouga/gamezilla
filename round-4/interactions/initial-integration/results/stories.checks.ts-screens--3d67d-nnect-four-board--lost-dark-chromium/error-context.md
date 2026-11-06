# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-connect-four-board--lost dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  643 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/connect-four-client-ts/src/baselines/chromium/screens-games-connect-four-board/lost-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/connect-four-client-ts/src/baselines/chromium/screens-games-connect-four-board/lost-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 643 pixels (ratio 0.01 of all image pixels) are different.
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
  - 643 pixels (ratio 0.01 of all image pixels) are different.

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
        - paragraph [ref=e29]: No moves yet.
        - button "All moves" [ref=e30] [cursor=pointer]:
          - img [ref=e34]
      - generic [ref=e36]:
        - generic [ref=e38]:
          - generic [ref=e45]:
            - img "Yellow diamond" [ref=e46]:
              - generic [ref=e47]: ◆
            - generic [ref=e48]: jordan_plays
          - group "Connect Four board, seven columns and six rows" [ref=e50]:
            - button "Column 1, 1 of 6 occupied" [disabled] [ref=e51]:
              - generic [ref=e53]: "1"
              - generic [ref=e65]: ◆
            - generic [ref=e66]: "Column 1, row 6: Empty. Column 1, row 5: Empty. Column 1, row 4: Empty. Column 1, row 3: Empty. Column 1, row 2: Empty. Column 1, row 1: Yellow diamond, winning disc"
            - button "Column 2, 1 of 6 occupied" [disabled] [ref=e67]:
              - generic [ref=e69]: "2"
              - generic [ref=e81]: ◆
            - generic [ref=e82]: "Column 2, row 6: Empty. Column 2, row 5: Empty. Column 2, row 4: Empty. Column 2, row 3: Empty. Column 2, row 2: Empty. Column 2, row 1: Yellow diamond, winning disc"
            - button "Column 3, 1 of 6 occupied" [disabled] [ref=e83]:
              - generic [ref=e85]: "3"
              - generic [ref=e97]: ◆
            - generic [ref=e98]: "Column 3, row 6: Empty. Column 3, row 5: Empty. Column 3, row 4: Empty. Column 3, row 3: Empty. Column 3, row 2: Empty. Column 3, row 1: Yellow diamond, winning disc"
            - button "Column 4, 1 of 6 occupied" [disabled] [ref=e99]:
              - generic [ref=e101]: "4"
              - generic [ref=e113]: ◆
            - generic [ref=e114]: "Column 4, row 6: Empty. Column 4, row 5: Empty. Column 4, row 4: Empty. Column 4, row 3: Empty. Column 4, row 2: Empty. Column 4, row 1: Yellow diamond, winning disc"
            - button "Column 5, 0 of 6 occupied" [disabled] [ref=e115]:
              - generic [ref=e117]: "5"
            - generic [ref=e130]: "Column 5, row 6: Empty. Column 5, row 5: Empty. Column 5, row 4: Empty. Column 5, row 3: Empty. Column 5, row 2: Empty. Column 5, row 1: Empty"
            - button "Column 6, 2 of 6 occupied" [disabled] [ref=e131]:
              - generic [ref=e133]: "6"
              - generic [ref=e143]: ●
              - generic [ref=e145]: ●
            - generic [ref=e146]: "Column 6, row 6: Empty. Column 6, row 5: Empty. Column 6, row 4: Empty. Column 6, row 3: Empty. Column 6, row 2: Red circle. Column 6, row 1: Red circle"
            - button "Column 7, 2 of 6 occupied" [disabled] [ref=e147]:
              - generic [ref=e149]: "7"
              - generic [ref=e159]: ●
              - generic [ref=e161]: ●
            - generic [ref=e162]: "Column 7, row 6: Empty. Column 7, row 5: Empty. Column 7, row 4: Empty. Column 7, row 3: Empty. Column 7, row 2: Red circle. Column 7, row 1: Red circle"
          - status [ref=e166]:
            - generic [ref=e167]:
              - generic [ref=e168]: "Red circle: avery. Yellow diamond: jordan_plays."
              - text: Four in a row.
          - generic [ref=e176]:
            - img "Red circle" [ref=e177]:
              - generic [ref=e178]: ●
            - generic [ref=e179]: avery
        - generic [ref=e180]:
          - generic [ref=e181]:
            - heading "jordan_plays wins" [level=2] [ref=e183]
            - list "Standings" [ref=e184]:
              - listitem [ref=e185]:
                - generic [ref=e186]:
                  - generic [ref=e187]: 1st
                  - generic [ref=e190]: jordan_plays
              - listitem [ref=e191]:
                - generic [ref=e192]:
                  - generic [ref=e193]: 2nd
                  - generic [ref=e196]: avery
          - generic [ref=e198]:
            - group "What next" [ref=e199]:
              - button "Rematch" [ref=e200] [cursor=pointer]:
                - paragraph [ref=e203]: Rematch
              - button "Change game" [ref=e204] [cursor=pointer]:
                - paragraph [ref=e207]: Change game
              - button "Review" [ref=e208] [cursor=pointer]:
                - paragraph [ref=e211]: Review
            - button "History and stats" [ref=e212] [cursor=pointer]:
              - generic [ref=e214]:
                - paragraph [ref=e215]: History and stats
                - img [ref=e218]
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