# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-connect-four-board--your-turn dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  757 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/connect-four-client-ts/src/baselines/chromium/screens-games-connect-four-board/your-turn-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/connect-four-client-ts/src/baselines/chromium/screens-games-connect-four-board/your-turn-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 757 pixels (ratio 0.01 of all image pixels) are different.
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
  - 757 pixels (ratio 0.01 of all image pixels) are different.

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
          - paragraph [ref=e40]: Drop in column 6
          - button "Drop in column 1, 0 of 6 occupied" [ref=e41] [cursor=pointer]:
            - generic [ref=e43]: "1"
          - generic [ref=e56]: "Column 1, row 6: Empty. Column 1, row 5: Empty. Column 1, row 4: Empty. Column 1, row 3: Empty. Column 1, row 2: Empty. Column 1, row 1: Empty"
          - button "Drop in column 2, 1 of 6 occupied" [ref=e57] [cursor=pointer]:
            - generic [ref=e59]: "2"
            - generic [ref=e71]: ◆
          - generic [ref=e72]: "Column 2, row 6: Empty. Column 2, row 5: Empty. Column 2, row 4: Empty. Column 2, row 3: Empty. Column 2, row 2: Empty. Column 2, row 1: Yellow diamond"
          - button "Drop in column 3, 2 of 6 occupied" [ref=e73] [cursor=pointer]:
            - generic [ref=e75]: "3"
            - generic [ref=e85]: ●
            - generic [ref=e87]: ●
          - generic [ref=e88]: "Column 3, row 6: Empty. Column 3, row 5: Empty. Column 3, row 4: Empty. Column 3, row 3: Empty. Column 3, row 2: Red circle. Column 3, row 1: Red circle"
          - button "Drop in column 4, 3 of 6 occupied" [ref=e89] [cursor=pointer]:
            - generic [ref=e91]: "4"
            - generic [ref=e99]: ◆
            - generic [ref=e101]: ◆
            - generic [ref=e103]: ●
          - generic [ref=e104]: "Column 4, row 6: Empty. Column 4, row 5: Empty. Column 4, row 4: Empty. Column 4, row 3: Yellow diamond. Column 4, row 2: Yellow diamond. Column 4, row 1: Red circle"
          - button "Drop in column 5, 2 of 6 occupied" [ref=e105] [cursor=pointer]:
            - generic [ref=e107]: "5"
            - generic [ref=e117]: ●
            - generic [ref=e119]: ◆
          - generic [ref=e120]: "Column 5, row 6: Empty. Column 5, row 5: Empty. Column 5, row 4: Empty. Column 5, row 3: Empty. Column 5, row 2: Red circle. Column 5, row 1: Yellow diamond"
          - button "Drop in column 6, 1 of 6 occupied" [ref=e121] [cursor=pointer]:
            - generic [ref=e123]: "6"
            - generic [ref=e135]: ◆
          - generic [ref=e136]: "Column 6, row 6: Empty. Column 6, row 5: Empty. Column 6, row 4: Empty. Column 6, row 3: Empty. Column 6, row 2: Empty. Column 6, row 1: Yellow diamond"
          - button "Drop in column 7, 1 of 6 occupied" [ref=e137] [cursor=pointer]:
            - generic [ref=e139]: "7"
            - generic [ref=e151]: ●
          - generic [ref=e152]: "Column 7, row 6: Empty. Column 7, row 5: Empty. Column 7, row 4: Empty. Column 7, row 3: Empty. Column 7, row 2: Empty. Column 7, row 1: Red circle"
        - status [ref=e154]:
          - generic [ref=e155]:
            - generic [ref=e156]: "Red circle: avery. Yellow diamond: jordan_plays."
            - text: Red circle to move.
        - generic [ref=e164]:
          - img "Red circle" [ref=e165]:
            - generic [ref=e166]: ●
          - generic [ref=e167]: avery
          - generic [ref=e168]: Your move
      - region "Game record" [ref=e170]:
        - heading "Game record" [level=2] [ref=e173]
        - generic [ref=e174]:
          - generic [ref=e175]:
            - generic [ref=e176]: Column
            - list "Moves played" [ref=e177]:
              - listitem [ref=e178]:
                - generic [ref=e179]: "1"
                - generic [ref=e180]:
                  - generic [ref=e182]: ●
                  - 'button "Move 1, Red circle: 4" [ref=e183] [cursor=pointer]': "4"
                - generic [ref=e184]:
                  - generic [ref=e186]: ◆
                  - 'button "Move 2, Yellow diamond: 4" [ref=e187] [cursor=pointer]': "4"
              - listitem [ref=e188]:
                - generic [ref=e189]: "2"
                - generic [ref=e190]:
                  - generic [ref=e192]: ●
                  - 'button "Move 3, Red circle: 3" [ref=e193] [cursor=pointer]': "3"
                - generic [ref=e194]:
                  - generic [ref=e196]: ◆
                  - 'button "Move 4, Yellow diamond: 5" [ref=e197] [cursor=pointer]': "5"
              - listitem [ref=e198]:
                - generic [ref=e199]: "3"
                - generic [ref=e200]:
                  - generic [ref=e202]: ●
                  - 'button "Move 5, Red circle: 5" [ref=e203] [cursor=pointer]': "5"
                - generic [ref=e204]:
                  - generic [ref=e206]: ◆
                  - 'button "Move 6, Yellow diamond: 6" [ref=e207] [cursor=pointer]': "6"
              - listitem [ref=e208]:
                - generic [ref=e209]: "4"
                - generic [ref=e210]:
                  - generic [ref=e212]: ●
                  - 'button "Move 7, Red circle: 3" [ref=e213] [cursor=pointer]': "3"
                - generic [ref=e214]:
                  - generic [ref=e216]: ◆
                  - 'button "Move 8, Yellow diamond: 2" [ref=e217] [cursor=pointer]': "2"
              - listitem [ref=e218]:
                - generic [ref=e219]: "5"
                - generic [ref=e220]:
                  - generic [ref=e222]: ●
                  - 'button "Move 9, Red circle: 7" [ref=e223] [cursor=pointer]': "7"
                - generic [ref=e224]:
                  - generic [ref=e226]: ◆
                  - 'button "Move 10, Yellow diamond: 4" [ref=e227] [cursor=pointer]': "4"
          - generic [ref=e228]:
            - generic [ref=e229]:
              - button "Go to the start" [ref=e230] [cursor=pointer]:
                - img [ref=e233]
              - button "Previous move" [ref=e236] [cursor=pointer]:
                - img [ref=e239]
              - button "Next move" [disabled] [ref=e241]:
                - img [ref=e244]
              - button "Return to current position" [ref=e246] [cursor=pointer]:
                - img [ref=e249]
            - button "Go to move" [ref=e252] [cursor=pointer]:
              - generic [ref=e254]:
                - paragraph [ref=e255]: Go to move
                - img [ref=e258]
        - generic [ref=e261]:
          - group "Game actions" [ref=e262]:
            - button "Offer draw" [ref=e263] [cursor=pointer]:
              - paragraph [ref=e266]: Offer draw
            - button "Resign game" [ref=e267] [cursor=pointer]:
              - paragraph [ref=e270]:
                - text: Resign
                - generic [ref=e271]: game
          - button "History and stats" [ref=e272] [cursor=pointer]:
            - paragraph [ref=e275]: History and stats
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