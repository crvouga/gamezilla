# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-frame-geometry--four-players-desktop light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/game-session-client-ts/src/baselines/chromium/screens-games-frame-geometry/four-players-desktop-light-1440.png.
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
        - list "Other players" [ref=e29]:
          - generic "jordan_plays" [ref=e30]:
            - listitem [ref=e31]:
              - generic [ref=e35]:
                - generic [ref=e36]: jordan_plays
                - generic [ref=e37]:
                  - generic [ref=e39]: ◆
                  - generic [ref=e40]: Points 12
                  - generic [ref=e42]: Chosen
          - generic "morgan" [ref=e43]:
            - listitem [ref=e44]:
              - generic [ref=e48]:
                - generic [ref=e49]: morgan
                - generic [ref=e50]:
                  - generic [ref=e52]: ▲
                  - generic [ref=e55]: Reconnecting
                  - generic [ref=e57]: Chosen
          - generic "Bot" [ref=e58]:
            - listitem [ref=e59]:
              - generic [ref=e60]:
                - img [ref=e62]:
                  - img [ref=e64]
                - generic [ref=e67]:
                  - generic [ref=e68]: Bot
                  - generic [ref=e69]:
                    - generic [ref=e71]: ■
                    - generic [ref=e73]: Out
                    - generic [ref=e75]: Choosing
        - group "Connect Four board, seven columns and six rows" [ref=e77]:
          - paragraph [ref=e78]
          - button "Column 1, 0 of 6 occupied" [disabled] [ref=e79]:
            - generic [ref=e81]: "1"
          - generic [ref=e94]: "Column 1, row 6: Empty. Column 1, row 5: Empty. Column 1, row 4: Empty. Column 1, row 3: Empty. Column 1, row 2: Empty. Column 1, row 1: Empty"
          - button "Column 2, 0 of 6 occupied" [disabled] [ref=e95]:
            - generic [ref=e97]: "2"
          - generic [ref=e110]: "Column 2, row 6: Empty. Column 2, row 5: Empty. Column 2, row 4: Empty. Column 2, row 3: Empty. Column 2, row 2: Empty. Column 2, row 1: Empty"
          - button "Column 3, 2 of 6 occupied" [disabled] [ref=e111]:
            - generic [ref=e113]: "3"
            - generic [ref=e123]: ●
            - generic [ref=e125]: ◆
          - generic [ref=e126]: "Column 3, row 6: Empty. Column 3, row 5: Empty. Column 3, row 4: Empty. Column 3, row 3: Empty. Column 3, row 2: Red circle. Column 3, row 1: Yellow diamond"
          - button "Column 4, 2 of 6 occupied" [disabled] [ref=e127]:
            - generic [ref=e129]: "4"
            - generic [ref=e139]: ◆
            - generic [ref=e141]: ●
          - generic [ref=e142]: "Column 4, row 6: Empty. Column 4, row 5: Empty. Column 4, row 4: Empty. Column 4, row 3: Empty. Column 4, row 2: Yellow diamond. Column 4, row 1: Red circle"
          - button "Column 5, 2 of 6 occupied" [disabled] [ref=e143]:
            - generic [ref=e145]: "5"
            - generic [ref=e155]: ◆
            - generic [ref=e157]: ●
          - generic [ref=e158]: "Column 5, row 6: Empty. Column 5, row 5: Empty. Column 5, row 4: Empty. Column 5, row 3: Empty. Column 5, row 2: Yellow diamond. Column 5, row 1: Red circle"
          - button "Column 6, 1 of 6 occupied" [disabled] [ref=e159]:
            - generic [ref=e161]: "6"
            - generic [ref=e173]: ●
          - generic [ref=e174]: "Column 6, row 6: Empty. Column 6, row 5: Empty. Column 6, row 4: Empty. Column 6, row 3: Empty. Column 6, row 2: Empty. Column 6, row 1: Red circle"
          - button "Column 7, 0 of 6 occupied" [disabled] [ref=e175]:
            - generic [ref=e177]: "7"
          - generic [ref=e190]: "Column 7, row 6: Empty. Column 7, row 5: Empty. Column 7, row 4: Empty. Column 7, row 3: Empty. Column 7, row 2: Empty. Column 7, row 1: Empty"
        - status [ref=e194]:
          - generic [ref=e195]:
            - generic [ref=e196]: "Red circle: avery. Yellow diamond: jordan_plays. Third seat: morgan. Fourth seat: Bot."
            - text: "Every side chooses in secret: 2 of 4 have chosen."
        - generic [ref=e203]:
          - generic [ref=e204]:
            - img "Red circle" [ref=e205]:
              - generic [ref=e206]: ●
            - generic "avery" [ref=e209]
          - generic [ref=e212]: Choosing
      - region "Game record" [ref=e214]:
        - heading "Game record" [level=2] [ref=e217]
        - generic [ref=e218]:
          - generic [ref=e219]:
            - generic [ref=e220]: Column
            - list "Moves played" [ref=e221]:
              - listitem [ref=e222]:
                - generic [ref=e223]: "1"
                - generic [ref=e224]:
                  - generic [ref=e226]: ●
                  - 'button "Move 1, Red circle: 4" [ref=e227] [cursor=pointer]': "4"
                - generic [ref=e228]:
                  - generic [ref=e230]: ◆
                  - 'button "Move 2, Yellow diamond: 4" [ref=e231] [cursor=pointer]': "4"
              - listitem [ref=e232]:
                - generic [ref=e233]: "2"
                - generic [ref=e234]:
                  - generic [ref=e236]: ●
                  - 'button "Move 3, Red circle: 5" [ref=e237] [cursor=pointer]': "5"
                - generic [ref=e238]:
                  - generic [ref=e240]: ◆
                  - 'button "Move 4, Yellow diamond: 3" [ref=e241] [cursor=pointer]': "3"
              - listitem [ref=e242]:
                - generic [ref=e243]: "3"
                - generic [ref=e244]:
                  - generic [ref=e246]: ●
                  - 'button "Move 5, Red circle: 3" [ref=e247] [cursor=pointer]': "3"
                - generic [ref=e248]:
                  - generic [ref=e250]: ◆
                  - 'button "Move 6, Yellow diamond: 5" [ref=e251] [cursor=pointer]': "5"
              - listitem [ref=e252]:
                - generic [ref=e253]: "4"
                - generic [ref=e254]:
                  - generic [ref=e256]: ●
                  - 'button "Move 7, Red circle: 6" [ref=e257] [cursor=pointer]': "6"
          - generic [ref=e258]:
            - generic [ref=e259]:
              - button "Go to the start" [ref=e260] [cursor=pointer]:
                - img [ref=e263]
              - button "Previous move" [ref=e266] [cursor=pointer]:
                - img [ref=e269]
              - button "Next move" [disabled] [ref=e271]:
                - img [ref=e274]
              - button "Return to current position" [ref=e276] [cursor=pointer]:
                - img [ref=e279]
            - button "Go to move" [ref=e282] [cursor=pointer]:
              - generic [ref=e284]:
                - paragraph [ref=e285]: Go to move
                - img [ref=e288]
        - generic [ref=e291]:
          - group "Game actions" [ref=e292]:
            - button "Offer draw" [ref=e293] [cursor=pointer]:
              - paragraph [ref=e296]: Offer draw
            - button "Resign game" [ref=e297] [cursor=pointer]:
              - paragraph [ref=e300]:
                - text: Resign
                - generic [ref=e301]: game
          - button "History and stats" [ref=e302] [cursor=pointer]:
            - paragraph [ref=e305]: History and stats
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/game-session-client-ts/src/baselines/chromium/screens-games-frame-geometry/four-players-desktop-light-1440.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```