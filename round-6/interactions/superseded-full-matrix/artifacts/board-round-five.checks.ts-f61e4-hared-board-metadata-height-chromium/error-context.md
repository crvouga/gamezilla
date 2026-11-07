# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: board-round-five.checks.ts >> screens-games-frame-geometry--four-players regression shared-board-metadata-height
- Location: tests/storybook/board-round-five.checks.ts:86:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "success"
Received: "error: expected 122 to be less than 112"

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
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
            - generic [ref=e34]: Move 4
            - generic [ref=e35]: Column
            - generic [ref=e36]:
              - generic [ref=e38]: ●
              - 'button "Move 7, Red circle: 6" [ref=e39] [cursor=pointer]': "6"
        - button "All moves" [ref=e40] [cursor=pointer]:
          - img [ref=e44]
      - generic [ref=e46]:
        - generic [ref=e48]:
          - list "Players" [ref=e50]:
            - generic "avery" [ref=e51]:
              - listitem [ref=e52]:
                - generic [ref=e55]:
                  - generic [ref=e56]: avery
                  - generic [ref=e57]:
                    - generic [ref=e59]: ●
                    - generic [ref=e61]: You
                    - generic [ref=e63]: Choosing
            - generic "jordan_plays" [ref=e64]:
              - listitem [ref=e65]:
                - generic [ref=e67]:
                  - generic [ref=e68]: jordan_plays
                  - generic [ref=e69]:
                    - generic [ref=e71]: ◆
                    - generic [ref=e72]: Points 12
                    - generic [ref=e74]: Chosen
            - generic "morgan" [ref=e75]:
              - listitem [ref=e76]:
                - generic [ref=e78]:
                  - generic [ref=e79]: morgan
                  - generic [ref=e80]:
                    - generic [ref=e82]: ▲
                    - generic [ref=e85]: Reconnecting
                    - generic [ref=e87]: Chosen
            - generic "Bot" [ref=e88]:
              - listitem [ref=e89]:
                - generic [ref=e91]:
                  - generic [ref=e92]: Bot
                  - generic [ref=e93]:
                    - generic [ref=e95]: ■
                    - generic [ref=e97]: Out
                    - generic [ref=e99]: Choosing
          - group "Connect Four board, seven columns and six rows" [ref=e101]:
            - paragraph [ref=e102]
            - button "Column 1, 0 of 6 occupied" [disabled] [ref=e103]:
              - generic [ref=e105]: "1"
            - generic [ref=e118]: "Column 1, row 6: Empty. Column 1, row 5: Empty. Column 1, row 4: Empty. Column 1, row 3: Empty. Column 1, row 2: Empty. Column 1, row 1: Empty"
            - button "Column 2, 0 of 6 occupied" [disabled] [ref=e119]:
              - generic [ref=e121]: "2"
            - generic [ref=e134]: "Column 2, row 6: Empty. Column 2, row 5: Empty. Column 2, row 4: Empty. Column 2, row 3: Empty. Column 2, row 2: Empty. Column 2, row 1: Empty"
            - button "Column 3, 2 of 6 occupied" [disabled] [ref=e135]:
              - generic [ref=e137]: "3"
              - generic [ref=e147]: ●
              - generic [ref=e149]: ◆
            - generic [ref=e150]: "Column 3, row 6: Empty. Column 3, row 5: Empty. Column 3, row 4: Empty. Column 3, row 3: Empty. Column 3, row 2: Red circle. Column 3, row 1: Yellow diamond"
            - button "Column 4, 2 of 6 occupied" [disabled] [ref=e151]:
              - generic [ref=e153]: "4"
              - generic [ref=e163]: ◆
              - generic [ref=e165]: ●
            - generic [ref=e166]: "Column 4, row 6: Empty. Column 4, row 5: Empty. Column 4, row 4: Empty. Column 4, row 3: Empty. Column 4, row 2: Yellow diamond. Column 4, row 1: Red circle"
            - button "Column 5, 2 of 6 occupied" [disabled] [ref=e167]:
              - generic [ref=e169]: "5"
              - generic [ref=e179]: ◆
              - generic [ref=e181]: ●
            - generic [ref=e182]: "Column 5, row 6: Empty. Column 5, row 5: Empty. Column 5, row 4: Empty. Column 5, row 3: Empty. Column 5, row 2: Yellow diamond. Column 5, row 1: Red circle"
            - button "Column 6, 1 of 6 occupied" [disabled] [ref=e183]:
              - generic [ref=e185]: "6"
              - generic [ref=e197]: ●
            - generic [ref=e198]: "Column 6, row 6: Empty. Column 6, row 5: Empty. Column 6, row 4: Empty. Column 6, row 3: Empty. Column 6, row 2: Empty. Column 6, row 1: Red circle"
            - button "Column 7, 0 of 6 occupied" [disabled] [ref=e199]:
              - generic [ref=e201]: "7"
            - generic [ref=e214]: "Column 7, row 6: Empty. Column 7, row 5: Empty. Column 7, row 4: Empty. Column 7, row 3: Empty. Column 7, row 2: Empty. Column 7, row 1: Empty"
          - status [ref=e218]:
            - generic [ref=e219]:
              - generic [ref=e220]: "Red circle: avery. Yellow diamond: jordan_plays. Third seat: morgan. Fourth seat: Bot."
              - text: "Every side chooses in secret: 2 of 4 have chosen."
        - generic [ref=e223]:
          - group "Game actions" [ref=e224]:
            - button "Offer draw" [ref=e225] [cursor=pointer]:
              - paragraph [ref=e228]: Offer draw
            - button "Resign game" [ref=e229] [cursor=pointer]:
              - paragraph [ref=e232]:
                - text: Resign
                - generic [ref=e233]: game
          - button "History and stats" [ref=e234] [cursor=pointer]:
            - generic [ref=e236]:
              - paragraph [ref=e237]: History and stats
              - img [ref=e240]
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
> 35 |     .toBe('success');
     |      ^ Error: expect(received).toBe(expected) // Object.is equality
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
  51 |   await expect(page.locator('#storybook-root')).toHaveScreenshot(
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```