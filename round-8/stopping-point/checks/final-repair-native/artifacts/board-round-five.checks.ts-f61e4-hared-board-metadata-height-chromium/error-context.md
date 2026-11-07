# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: board-round-five.checks.ts >> screens-games-frame-geometry--four-players regression shared-board-metadata-height
- Location: tests/storybook/board-round-five.checks.ts:86:1

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/game-session-client-ts/src/baselines/chromium/screens-games-frame-geometry/four-players-light.png.
```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e14]:
    - generic [ref=e15]:
      - heading "Connect Four" [level=1] [ref=e18]
      - generic [ref=e20]:
        - generic [ref=e21]: Unrated
        - generic [ref=e22]: ·Untimed
    - generic [ref=e23]:
      - generic [ref=e26]:
        - paragraph [ref=e29]: Live
        - list "Moves played" [ref=e34]:
          - listitem [ref=e35]:
            - generic [ref=e36]: Move 4
            - generic [ref=e37]: Column
            - generic [ref=e38]:
              - generic [ref=e40]: ●
              - 'button "Move 7, Red circle: 6" [ref=e41] [cursor=pointer]': "6"
        - button "All moves" [ref=e42] [cursor=pointer]:
          - img [ref=e46]
      - generic [ref=e48]:
        - generic [ref=e50]:
          - list "Players" [ref=e52]:
            - generic "avery" [ref=e53]:
              - listitem [ref=e54]:
                - generic [ref=e57]:
                  - generic [ref=e58]: avery
                  - generic [ref=e59]:
                    - generic [ref=e61]: ●
                    - generic [ref=e63]: You
                    - generic [ref=e65]: Choosing
            - generic "jordan_plays" [ref=e66]:
              - listitem [ref=e67]:
                - generic [ref=e69]:
                  - generic [ref=e70]: jordan_plays
                  - generic [ref=e71]:
                    - generic [ref=e73]: ◆
                    - generic [ref=e74]: Points 12
                    - generic [ref=e76]: Chosen
            - generic "morgan" [ref=e77]:
              - listitem [ref=e78]:
                - generic [ref=e80]:
                  - generic [ref=e81]: morgan
                  - generic [ref=e82]:
                    - generic [ref=e84]: ▲
                    - generic [ref=e87]: Reconnecting
                    - generic [ref=e89]: Chosen
            - generic "Bot" [ref=e90]:
              - listitem [ref=e91]:
                - generic [ref=e93]:
                  - generic [ref=e94]: Bot
                  - generic [ref=e95]:
                    - generic [ref=e97]: ■
                    - generic [ref=e99]: Out
                    - generic [ref=e101]: Choosing
          - group "Connect Four board, seven columns and six rows" [ref=e103]:
            - paragraph [ref=e104]
            - button "Column 1, 0 of 6 occupied" [disabled] [ref=e105]:
              - generic [ref=e107]: "1"
            - generic [ref=e120]: "Column 1, row 6: Empty. Column 1, row 5: Empty. Column 1, row 4: Empty. Column 1, row 3: Empty. Column 1, row 2: Empty. Column 1, row 1: Empty"
            - button "Column 2, 0 of 6 occupied" [disabled] [ref=e121]:
              - generic [ref=e123]: "2"
            - generic [ref=e136]: "Column 2, row 6: Empty. Column 2, row 5: Empty. Column 2, row 4: Empty. Column 2, row 3: Empty. Column 2, row 2: Empty. Column 2, row 1: Empty"
            - button "Column 3, 2 of 6 occupied" [disabled] [ref=e137]:
              - generic [ref=e139]: "3"
              - generic [ref=e149]: ●
              - generic [ref=e151]: ◆
            - generic [ref=e152]: "Column 3, row 6: Empty. Column 3, row 5: Empty. Column 3, row 4: Empty. Column 3, row 3: Empty. Column 3, row 2: Red circle. Column 3, row 1: Yellow diamond"
            - button "Column 4, 2 of 6 occupied" [disabled] [ref=e153]:
              - generic [ref=e155]: "4"
              - generic [ref=e165]: ◆
              - generic [ref=e167]: ●
            - generic [ref=e168]: "Column 4, row 6: Empty. Column 4, row 5: Empty. Column 4, row 4: Empty. Column 4, row 3: Empty. Column 4, row 2: Yellow diamond. Column 4, row 1: Red circle"
            - button "Column 5, 2 of 6 occupied" [disabled] [ref=e169]:
              - generic [ref=e171]: "5"
              - generic [ref=e181]: ◆
              - generic [ref=e183]: ●
            - generic [ref=e184]: "Column 5, row 6: Empty. Column 5, row 5: Empty. Column 5, row 4: Empty. Column 5, row 3: Empty. Column 5, row 2: Yellow diamond. Column 5, row 1: Red circle"
            - button "Column 6, 1 of 6 occupied" [disabled] [ref=e185]:
              - generic [ref=e187]: "6"
              - generic [ref=e199]: ●
            - generic [ref=e200]: "Column 6, row 6: Empty. Column 6, row 5: Empty. Column 6, row 4: Empty. Column 6, row 3: Empty. Column 6, row 2: Empty. Column 6, row 1: Red circle"
            - button "Column 7, 0 of 6 occupied" [disabled] [ref=e201]:
              - generic [ref=e203]: "7"
            - generic [ref=e216]: "Column 7, row 6: Empty. Column 7, row 5: Empty. Column 7, row 4: Empty. Column 7, row 3: Empty. Column 7, row 2: Empty. Column 7, row 1: Empty"
          - status [ref=e220]:
            - generic [ref=e221]:
              - generic [ref=e222]: "Red circle: avery. Yellow diamond: jordan_plays. Third seat: morgan. Fourth seat: Bot."
              - text: "Every side chooses in secret: 2 of 4 have chosen."
        - generic [ref=e225]:
          - group "Game actions" [ref=e226]:
            - button "Offer draw" [ref=e227] [cursor=pointer]:
              - paragraph [ref=e230]: Offer draw
            - button "Resign game" [ref=e231] [cursor=pointer]:
              - paragraph [ref=e234]:
                - text: Resign
                - generic [ref=e235]: game
          - button "History and stats" [ref=e236] [cursor=pointer]:
            - generic [ref=e238]:
              - paragraph [ref=e239]: History and stats
              - img [ref=e242]
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/game-session-client-ts/src/baselines/chromium/screens-games-frame-geometry/four-players-light.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```