# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-connect-four-board--won dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  49732 pixels (ratio 0.16 of all image pixels) are different.

  Snapshot: libs/connect-four-client-ts/src/baselines/chromium/screens-games-connect-four-board/won-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/connect-four-client-ts/src/baselines/chromium/screens-games-connect-four-board/won-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 49732 pixels (ratio 0.16 of all image pixels) are different.
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
  - 49732 pixels (ratio 0.16 of all image pixels) are different.

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
      - generic [ref=e23]:
        - heading "You win" [level=2] [ref=e25]
        - group "What next" [ref=e26]:
          - button "Rematch" [ref=e27] [cursor=pointer]:
            - paragraph [ref=e30]: Rematch
          - button "Change game" [ref=e31] [cursor=pointer]:
            - paragraph [ref=e34]: Change game
          - button "Review" [ref=e35] [cursor=pointer]:
            - paragraph [ref=e38]: Review
      - generic [ref=e41]:
        - paragraph [ref=e44]: Final
        - list "Moves played" [ref=e49]:
          - listitem [ref=e50]:
            - generic [ref=e51]: Move 4
            - generic [ref=e52]: Column
            - generic [ref=e53]:
              - generic [ref=e55]: ●
              - 'button "Move 7, Red circle: 1" [ref=e56] [cursor=pointer]': "1"
        - button "All moves" [ref=e57] [cursor=pointer]:
          - img [ref=e61]
      - generic [ref=e63]:
        - generic [ref=e65]:
          - generic [ref=e72]:
            - img "Yellow diamond" [ref=e73]:
              - generic [ref=e74]: ◆
            - generic "jordan_plays" [ref=e77]
          - group "Connect Four board, seven columns and six rows" [ref=e79]:
            - button "Column 1, 4 of 6 occupied" [disabled] [active] [ref=e80]:
              - generic [ref=e82]: "1"
              - generic [ref=e88]: ●
              - generic [ref=e90]: ●
              - generic [ref=e92]: ●
              - generic [ref=e94]: ●
            - generic [ref=e95]: "Column 1, row 6: Empty. Column 1, row 5: Empty. Column 1, row 4: Red circle, winning disc. Column 1, row 3: Red circle, winning disc. Column 1, row 2: Red circle, winning disc. Column 1, row 1: Red circle, winning disc"
            - button "Column 2, 3 of 6 occupied" [disabled] [ref=e96]:
              - generic [ref=e98]: "2"
              - generic [ref=e106]: ◆
              - generic [ref=e108]: ◆
              - generic [ref=e110]: ◆
            - generic [ref=e111]: "Column 2, row 6: Empty. Column 2, row 5: Empty. Column 2, row 4: Empty. Column 2, row 3: Yellow diamond. Column 2, row 2: Yellow diamond. Column 2, row 1: Yellow diamond"
            - button "Column 3, 0 of 6 occupied" [disabled] [ref=e112]:
              - generic [ref=e114]: "3"
            - generic [ref=e127]: "Column 3, row 6: Empty. Column 3, row 5: Empty. Column 3, row 4: Empty. Column 3, row 3: Empty. Column 3, row 2: Empty. Column 3, row 1: Empty"
            - button "Column 4, 0 of 6 occupied" [disabled] [ref=e128]:
              - generic [ref=e130]: "4"
            - generic [ref=e143]: "Column 4, row 6: Empty. Column 4, row 5: Empty. Column 4, row 4: Empty. Column 4, row 3: Empty. Column 4, row 2: Empty. Column 4, row 1: Empty"
            - button "Column 5, 0 of 6 occupied" [disabled] [ref=e144]:
              - generic [ref=e146]: "5"
            - generic [ref=e159]: "Column 5, row 6: Empty. Column 5, row 5: Empty. Column 5, row 4: Empty. Column 5, row 3: Empty. Column 5, row 2: Empty. Column 5, row 1: Empty"
            - button "Column 6, 0 of 6 occupied" [disabled] [ref=e160]:
              - generic [ref=e162]: "6"
            - generic [ref=e175]: "Column 6, row 6: Empty. Column 6, row 5: Empty. Column 6, row 4: Empty. Column 6, row 3: Empty. Column 6, row 2: Empty. Column 6, row 1: Empty"
            - button "Column 7, 0 of 6 occupied" [disabled] [ref=e176]:
              - generic [ref=e178]: "7"
            - generic [ref=e191]: "Column 7, row 6: Empty. Column 7, row 5: Empty. Column 7, row 4: Empty. Column 7, row 3: Empty. Column 7, row 2: Empty. Column 7, row 1: Empty"
          - status [ref=e193]:
            - generic [ref=e194]:
              - generic [ref=e195]: "Red circle: avery. Yellow diamond: jordan_plays."
              - text: Four in a row.
          - generic [ref=e203]:
            - img "Red circle" [ref=e204]:
              - generic [ref=e205]: ●
            - generic "avery" [ref=e208]
        - generic [ref=e209]:
          - list "Standings" [ref=e211]:
            - listitem [ref=e212]:
              - generic [ref=e213]:
                - generic [ref=e214]: 1st
                - generic [ref=e217]: avery
            - listitem [ref=e218]:
              - generic [ref=e219]:
                - generic [ref=e220]: 2nd
                - generic [ref=e223]: jordan_plays
          - button "History and stats" [ref=e226] [cursor=pointer]:
            - generic [ref=e228]:
              - paragraph [ref=e229]: History and stats
              - img [ref=e232]
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