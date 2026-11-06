# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-connect-four-board--connect-four-to-win light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  911 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/connect-four-client-ts/src/baselines/chromium/screens-games-connect-four-board/connect-four-to-win-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/connect-four-client-ts/src/baselines/chromium/screens-games-connect-four-board/connect-four-to-win-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 911 pixels (ratio 0.01 of all image pixels) are different.
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
  - 911 pixels (ratio 0.01 of all image pixels) are different.

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
          - img "Red circle" [ref=e35]:
            - generic [ref=e36]: ●
          - generic [ref=e37]: avery
        - group "Connect Four board, seven columns and six rows" [ref=e39]:
          - button "Column 1, 4 of 6 occupied" [disabled] [active] [ref=e40]:
            - generic [ref=e42]: "1"
            - generic [ref=e48]: ●
            - generic [ref=e50]: ●
            - generic [ref=e52]: ●
            - generic [ref=e54]: ●
          - generic [ref=e55]: "Column 1, row 6: Empty. Column 1, row 5: Empty. Column 1, row 4: Red circle, winning disc. Column 1, row 3: Red circle, winning disc. Column 1, row 2: Red circle, winning disc. Column 1, row 1: Red circle, winning disc"
          - button "Column 2, 3 of 6 occupied" [disabled] [ref=e56]:
            - generic [ref=e58]: "2"
            - generic [ref=e66]: ◆
            - generic [ref=e68]: ◆
            - generic [ref=e70]: ◆
          - generic [ref=e71]: "Column 2, row 6: Empty. Column 2, row 5: Empty. Column 2, row 4: Empty. Column 2, row 3: Yellow diamond. Column 2, row 2: Yellow diamond. Column 2, row 1: Yellow diamond"
          - button "Column 3, 0 of 6 occupied" [disabled] [ref=e72]:
            - generic [ref=e74]: "3"
          - generic [ref=e87]: "Column 3, row 6: Empty. Column 3, row 5: Empty. Column 3, row 4: Empty. Column 3, row 3: Empty. Column 3, row 2: Empty. Column 3, row 1: Empty"
          - button "Column 4, 0 of 6 occupied" [disabled] [ref=e88]:
            - generic [ref=e90]: "4"
          - generic [ref=e103]: "Column 4, row 6: Empty. Column 4, row 5: Empty. Column 4, row 4: Empty. Column 4, row 3: Empty. Column 4, row 2: Empty. Column 4, row 1: Empty"
          - button "Column 5, 0 of 6 occupied" [disabled] [ref=e104]:
            - generic [ref=e106]: "5"
          - generic [ref=e119]: "Column 5, row 6: Empty. Column 5, row 5: Empty. Column 5, row 4: Empty. Column 5, row 3: Empty. Column 5, row 2: Empty. Column 5, row 1: Empty"
          - button "Column 6, 0 of 6 occupied" [disabled] [ref=e120]:
            - generic [ref=e122]: "6"
          - generic [ref=e135]: "Column 6, row 6: Empty. Column 6, row 5: Empty. Column 6, row 4: Empty. Column 6, row 3: Empty. Column 6, row 2: Empty. Column 6, row 1: Empty"
          - button "Column 7, 0 of 6 occupied" [disabled] [ref=e136]:
            - generic [ref=e138]: "7"
          - generic [ref=e151]: "Column 7, row 6: Empty. Column 7, row 5: Empty. Column 7, row 4: Empty. Column 7, row 3: Empty. Column 7, row 2: Empty. Column 7, row 1: Empty"
        - status [ref=e155]:
          - generic [ref=e156]:
            - generic [ref=e157]: "Red circle: avery. Yellow diamond: jordan_plays."
            - text: Four in a row.
        - generic [ref=e165]:
          - img "Yellow diamond" [ref=e166]:
            - generic [ref=e167]: ◆
          - generic [ref=e168]: jordan_plays
      - generic [ref=e170]:
        - heading "avery wins" [level=2] [ref=e172]
        - list "Standings" [ref=e173]:
          - listitem [ref=e174]:
            - generic [ref=e175]:
              - generic [ref=e176]: 1st
              - generic [ref=e179]: avery
          - listitem [ref=e180]:
            - generic [ref=e181]:
              - generic [ref=e182]: 2nd
              - generic [ref=e185]: jordan_plays
      - region "Game record" [ref=e187]:
        - heading "Game record" [level=2] [ref=e190]
        - generic [ref=e191]:
          - generic [ref=e192]:
            - generic [ref=e193]: Column
            - list "Moves played" [ref=e194]:
              - listitem [ref=e195]:
                - generic [ref=e196]: "1"
                - generic [ref=e197]:
                  - generic [ref=e199]: ●
                  - 'button "Move 1, Red circle: 1" [ref=e200] [cursor=pointer]': "1"
                - generic [ref=e201]:
                  - generic [ref=e203]: ◆
                  - 'button "Move 2, Yellow diamond: 2" [ref=e204] [cursor=pointer]': "2"
              - listitem [ref=e205]:
                - generic [ref=e206]: "2"
                - generic [ref=e207]:
                  - generic [ref=e209]: ●
                  - 'button "Move 3, Red circle: 1" [ref=e210] [cursor=pointer]': "1"
                - generic [ref=e211]:
                  - generic [ref=e213]: ◆
                  - 'button "Move 4, Yellow diamond: 2" [ref=e214] [cursor=pointer]': "2"
              - listitem [ref=e215]:
                - generic [ref=e216]: "3"
                - generic [ref=e217]:
                  - generic [ref=e219]: ●
                  - 'button "Move 5, Red circle: 1" [ref=e220] [cursor=pointer]': "1"
                - generic [ref=e221]:
                  - generic [ref=e223]: ◆
                  - 'button "Move 6, Yellow diamond: 2" [ref=e224] [cursor=pointer]': "2"
              - listitem [ref=e225]:
                - generic [ref=e226]: "4"
                - generic [ref=e227]:
                  - generic [ref=e229]: ●
                  - 'button "Move 7, Red circle: 1" [ref=e230] [cursor=pointer]': "1"
          - generic [ref=e231]:
            - generic [ref=e232]:
              - button "Go to the start" [ref=e233] [cursor=pointer]:
                - img [ref=e236]
              - button "Previous move" [ref=e239] [cursor=pointer]:
                - img [ref=e242]
              - button "Next move" [disabled] [ref=e244]:
                - img [ref=e247]
              - button "Return to current position" [ref=e249] [cursor=pointer]:
                - img [ref=e252]
            - button "Go to move" [ref=e255] [cursor=pointer]:
              - generic [ref=e257]:
                - paragraph [ref=e258]: Go to move
                - img [ref=e261]
        - generic [ref=e264]:
          - group "What next" [ref=e265]:
            - button "Rematch" [ref=e266] [cursor=pointer]:
              - paragraph [ref=e269]: Rematch
            - button "Change game" [ref=e270] [cursor=pointer]:
              - paragraph [ref=e273]: Change game
            - button "Review" [ref=e274] [cursor=pointer]:
              - paragraph [ref=e277]: Review
          - button "History and stats" [ref=e278] [cursor=pointer]:
            - paragraph [ref=e281]: History and stats
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