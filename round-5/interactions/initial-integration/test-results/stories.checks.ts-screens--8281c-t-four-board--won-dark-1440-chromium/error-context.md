# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-connect-four-board--won dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  81690 pixels (ratio 0.07 of all image pixels) are different.

  Snapshot: libs/connect-four-client-ts/src/baselines/chromium/screens-games-connect-four-board/won-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/connect-four-client-ts/src/baselines/chromium/screens-games-connect-four-board/won-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 81690 pixels (ratio 0.07 of all image pixels) are different.
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
  - 81690 pixels (ratio 0.07 of all image pixels) are different.

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
    - generic [ref=e24]:
      - generic [ref=e26]:
        - heading "You win" [level=2] [ref=e28]
        - group "What next" [ref=e29]:
          - button "Rematch" [ref=e30] [cursor=pointer]:
            - paragraph [ref=e33]: Rematch
          - button "Change game" [ref=e34] [cursor=pointer]:
            - paragraph [ref=e37]: Change game
          - button "Review" [ref=e38] [cursor=pointer]:
            - paragraph [ref=e41]: Review
      - generic [ref=e42]:
        - generic [ref=e44]:
          - generic [ref=e51]:
            - img "Yellow diamond" [ref=e52]:
              - generic [ref=e53]: ◆
            - generic "jordan_plays" [ref=e56]
          - group "Connect Four board, seven columns and six rows" [ref=e58]:
            - button "Column 1, 4 of 6 occupied" [disabled] [active] [ref=e59]:
              - generic [ref=e61]: "1"
              - generic [ref=e67]: ●
              - generic [ref=e69]: ●
              - generic [ref=e71]: ●
              - generic [ref=e73]: ●
            - generic [ref=e74]: "Column 1, row 6: Empty. Column 1, row 5: Empty. Column 1, row 4: Red circle, winning disc. Column 1, row 3: Red circle, winning disc. Column 1, row 2: Red circle, winning disc. Column 1, row 1: Red circle, winning disc"
            - button "Column 2, 3 of 6 occupied" [disabled] [ref=e75]:
              - generic [ref=e77]: "2"
              - generic [ref=e85]: ◆
              - generic [ref=e87]: ◆
              - generic [ref=e89]: ◆
            - generic [ref=e90]: "Column 2, row 6: Empty. Column 2, row 5: Empty. Column 2, row 4: Empty. Column 2, row 3: Yellow diamond. Column 2, row 2: Yellow diamond. Column 2, row 1: Yellow diamond"
            - button "Column 3, 0 of 6 occupied" [disabled] [ref=e91]:
              - generic [ref=e93]: "3"
            - generic [ref=e106]: "Column 3, row 6: Empty. Column 3, row 5: Empty. Column 3, row 4: Empty. Column 3, row 3: Empty. Column 3, row 2: Empty. Column 3, row 1: Empty"
            - button "Column 4, 0 of 6 occupied" [disabled] [ref=e107]:
              - generic [ref=e109]: "4"
            - generic [ref=e122]: "Column 4, row 6: Empty. Column 4, row 5: Empty. Column 4, row 4: Empty. Column 4, row 3: Empty. Column 4, row 2: Empty. Column 4, row 1: Empty"
            - button "Column 5, 0 of 6 occupied" [disabled] [ref=e123]:
              - generic [ref=e125]: "5"
            - generic [ref=e138]: "Column 5, row 6: Empty. Column 5, row 5: Empty. Column 5, row 4: Empty. Column 5, row 3: Empty. Column 5, row 2: Empty. Column 5, row 1: Empty"
            - button "Column 6, 0 of 6 occupied" [disabled] [ref=e139]:
              - generic [ref=e141]: "6"
            - generic [ref=e154]: "Column 6, row 6: Empty. Column 6, row 5: Empty. Column 6, row 4: Empty. Column 6, row 3: Empty. Column 6, row 2: Empty. Column 6, row 1: Empty"
            - button "Column 7, 0 of 6 occupied" [disabled] [ref=e155]:
              - generic [ref=e157]: "7"
            - generic [ref=e170]: "Column 7, row 6: Empty. Column 7, row 5: Empty. Column 7, row 4: Empty. Column 7, row 3: Empty. Column 7, row 2: Empty. Column 7, row 1: Empty"
          - status [ref=e172]:
            - generic [ref=e173]:
              - generic [ref=e174]: "Red circle: avery. Yellow diamond: jordan_plays."
              - text: Four in a row.
          - generic [ref=e182]:
            - img "Red circle" [ref=e183]:
              - generic [ref=e184]: ●
            - generic "avery" [ref=e187]
        - list "Standings" [ref=e190]:
          - listitem [ref=e191]:
            - generic [ref=e192]:
              - generic [ref=e193]: 1st
              - generic [ref=e196]: avery
          - listitem [ref=e197]:
            - generic [ref=e198]:
              - generic [ref=e199]: 2nd
              - generic [ref=e202]: jordan_plays
        - region "Game record" [ref=e204]:
          - heading "Game record" [level=2] [ref=e207]
          - generic [ref=e208]:
            - generic [ref=e209]:
              - generic [ref=e210]: Column
              - list "Moves played" [ref=e211]:
                - listitem [ref=e212]:
                  - generic [ref=e213]: "1"
                  - generic [ref=e214]:
                    - generic [ref=e216]: ●
                    - 'button "Move 1, Red circle: 1" [ref=e217] [cursor=pointer]': "1"
                  - generic [ref=e218]:
                    - generic [ref=e220]: ◆
                    - 'button "Move 2, Yellow diamond: 2" [ref=e221] [cursor=pointer]': "2"
                - listitem [ref=e222]:
                  - generic [ref=e223]: "2"
                  - generic [ref=e224]:
                    - generic [ref=e226]: ●
                    - 'button "Move 3, Red circle: 1" [ref=e227] [cursor=pointer]': "1"
                  - generic [ref=e228]:
                    - generic [ref=e230]: ◆
                    - 'button "Move 4, Yellow diamond: 2" [ref=e231] [cursor=pointer]': "2"
                - listitem [ref=e232]:
                  - generic [ref=e233]: "3"
                  - generic [ref=e234]:
                    - generic [ref=e236]: ●
                    - 'button "Move 5, Red circle: 1" [ref=e237] [cursor=pointer]': "1"
                  - generic [ref=e238]:
                    - generic [ref=e240]: ◆
                    - 'button "Move 6, Yellow diamond: 2" [ref=e241] [cursor=pointer]': "2"
                - listitem [ref=e242]:
                  - generic [ref=e243]: "4"
                  - generic [ref=e244]:
                    - generic [ref=e246]: ●
                    - 'button "Move 7, Red circle: 1" [ref=e247] [cursor=pointer]': "1"
            - generic [ref=e248]:
              - generic [ref=e249]:
                - button "Go to the start" [ref=e250] [cursor=pointer]:
                  - img [ref=e253]
                - button "Previous move" [ref=e256] [cursor=pointer]:
                  - img [ref=e259]
                - button "Next move" [disabled] [ref=e261]:
                  - img [ref=e264]
                - button "Return to current position" [ref=e266] [cursor=pointer]:
                  - img [ref=e269]
              - button "Go to move" [ref=e272] [cursor=pointer]:
                - generic [ref=e274]:
                  - paragraph [ref=e275]: Go to move
                  - img [ref=e278]
          - button "History and stats" [ref=e282] [cursor=pointer]:
            - paragraph [ref=e285]: History and stats
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