# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-frame-geometry--win-desktop light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/game-session-client-ts/src/baselines/chromium/screens-games-frame-geometry/win-desktop-light-1440.png.
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
        - generic [ref=e27]:
          - heading "You win" [level=2] [ref=e28]
          - paragraph [ref=e29]: Host starts the rematch
        - group "What next" [ref=e30]:
          - button "Done" [disabled] [ref=e31]:
            - generic [ref=e33]:
              - generic:
                - generic:
                  - paragraph: Rematch
              - generic [ref=e35]:
                - img [ref=e38]
                - paragraph [ref=e41]: Done
          - button "Change game" [ref=e42] [cursor=pointer]:
            - paragraph [ref=e45]: Change game
          - button "Review" [ref=e46] [cursor=pointer]:
            - paragraph [ref=e49]: Review
      - generic [ref=e50]:
        - generic [ref=e52]:
          - generic [ref=e59]:
            - img "Yellow diamond" [ref=e60]:
              - generic [ref=e61]: ◆
            - generic "jordan_plays" [ref=e64]
          - group "Connect Four board, seven columns and six rows" [ref=e66]:
            - button "Column 1, 0 of 6 occupied" [disabled] [ref=e67]:
              - generic [ref=e69]: "1"
            - generic [ref=e82]: "Column 1, row 6: Empty. Column 1, row 5: Empty. Column 1, row 4: Empty. Column 1, row 3: Empty. Column 1, row 2: Empty. Column 1, row 1: Empty"
            - button "Column 2, 0 of 6 occupied" [disabled] [ref=e83]:
              - generic [ref=e85]: "2"
            - generic [ref=e98]: "Column 2, row 6: Empty. Column 2, row 5: Empty. Column 2, row 4: Empty. Column 2, row 3: Empty. Column 2, row 2: Empty. Column 2, row 1: Empty"
            - button "Column 3, 3 of 6 occupied" [disabled] [ref=e99]:
              - generic [ref=e101]: "3"
              - generic [ref=e109]: ◆
              - generic [ref=e111]: ◆
              - generic [ref=e113]: ◆
            - generic [ref=e114]: "Column 3, row 6: Empty. Column 3, row 5: Empty. Column 3, row 4: Empty. Column 3, row 3: Yellow diamond. Column 3, row 2: Yellow diamond. Column 3, row 1: Yellow diamond"
            - button "Column 4, 4 of 6 occupied" [disabled] [ref=e115]:
              - generic [ref=e117]: "4"
              - generic [ref=e123]: ●
              - generic [ref=e125]: ●
              - generic [ref=e127]: ●
              - generic [ref=e129]: ●
            - generic [ref=e130]: "Column 4, row 6: Empty. Column 4, row 5: Empty. Column 4, row 4: Red circle. Column 4, row 3: Red circle. Column 4, row 2: Red circle. Column 4, row 1: Red circle"
            - button "Column 5, 0 of 6 occupied" [disabled] [ref=e131]:
              - generic [ref=e133]: "5"
            - generic [ref=e146]: "Column 5, row 6: Empty. Column 5, row 5: Empty. Column 5, row 4: Empty. Column 5, row 3: Empty. Column 5, row 2: Empty. Column 5, row 1: Empty"
            - button "Column 6, 0 of 6 occupied" [disabled] [ref=e147]:
              - generic [ref=e149]: "6"
            - generic [ref=e162]: "Column 6, row 6: Empty. Column 6, row 5: Empty. Column 6, row 4: Empty. Column 6, row 3: Empty. Column 6, row 2: Empty. Column 6, row 1: Empty"
            - button "Column 7, 0 of 6 occupied" [disabled] [ref=e163]:
              - generic [ref=e165]: "7"
            - generic [ref=e178]: "Column 7, row 6: Empty. Column 7, row 5: Empty. Column 7, row 4: Empty. Column 7, row 3: Empty. Column 7, row 2: Empty. Column 7, row 1: Empty"
          - status [ref=e180]:
            - generic [ref=e181]:
              - generic [ref=e182]: "Red circle: avery. Yellow diamond: jordan_plays."
              - text: Red circle wins by four in a row.
          - generic [ref=e190]:
            - img "Red circle" [ref=e191]:
              - generic [ref=e192]: ●
            - generic "avery" [ref=e195]
        - list "Standings" [ref=e198]:
          - listitem [ref=e199]:
            - generic [ref=e200]:
              - generic [ref=e201]: 1st
              - generic [ref=e204]: avery
          - listitem [ref=e205]:
            - generic [ref=e206]:
              - generic [ref=e207]: 2nd
              - generic [ref=e210]: jordan_plays
        - region "Game record" [ref=e212]:
          - heading "Game record" [level=2] [ref=e215]
          - generic [ref=e216]:
            - generic [ref=e217]:
              - generic [ref=e218]: Column
              - list "Moves played" [ref=e219]:
                - listitem [ref=e220]:
                  - generic [ref=e221]: "1"
                  - generic [ref=e222]:
                    - generic [ref=e224]: ●
                    - 'button "Move 1, Red circle: 4" [ref=e225] [cursor=pointer]': "4"
                  - generic [ref=e226]:
                    - generic [ref=e228]: ◆
                    - 'button "Move 2, Yellow diamond: 3" [ref=e229] [cursor=pointer]': "3"
                - listitem [ref=e230]:
                  - generic [ref=e231]: "2"
                  - generic [ref=e232]:
                    - generic [ref=e234]: ●
                    - 'button "Move 3, Red circle: 4" [ref=e235] [cursor=pointer]': "4"
                  - generic [ref=e236]:
                    - generic [ref=e238]: ◆
                    - 'button "Move 4, Yellow diamond: 3" [ref=e239] [cursor=pointer]': "3"
                - listitem [ref=e240]:
                  - generic [ref=e241]: "3"
                  - generic [ref=e242]:
                    - generic [ref=e244]: ●
                    - 'button "Move 5, Red circle: 4" [ref=e245] [cursor=pointer]': "4"
                  - generic [ref=e246]:
                    - generic [ref=e248]: ◆
                    - 'button "Move 6, Yellow diamond: 3" [ref=e249] [cursor=pointer]': "3"
                - listitem [ref=e250]:
                  - generic [ref=e251]: "4"
                  - generic [ref=e252]:
                    - generic [ref=e254]: ●
                    - 'button "Move 7, Red circle: 4" [ref=e255] [cursor=pointer]': "4"
            - generic [ref=e256]:
              - generic [ref=e257]:
                - button "Go to the start" [ref=e258] [cursor=pointer]:
                  - img [ref=e261]
                - button "Previous move" [ref=e264] [cursor=pointer]:
                  - img [ref=e267]
                - button "Next move" [disabled] [ref=e269]:
                  - img [ref=e272]
                - button "Return to current position" [ref=e274] [cursor=pointer]:
                  - img [ref=e277]
              - button "Go to move" [ref=e280] [cursor=pointer]:
                - generic [ref=e282]:
                  - paragraph [ref=e283]: Go to move
                  - img [ref=e286]
          - button "History and stats" [ref=e290] [cursor=pointer]:
            - paragraph [ref=e293]: History and stats
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/game-session-client-ts/src/baselines/chromium/screens-games-frame-geometry/win-desktop-light-1440.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```