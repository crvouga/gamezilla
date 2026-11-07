# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-frame-geometry--two-players-desktop dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/game-session-client-ts/src/baselines/chromium/screens-games-frame-geometry/two-players-desktop-dark.png.
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
            - generic "jordan_plays" [ref=e64]
          - group "Connect Four board, seven columns and six rows" [ref=e66]:
            - paragraph [ref=e67]
            - button "Column 1, 0 of 6 occupied" [disabled] [ref=e68]:
              - generic [ref=e70]: "1"
            - generic [ref=e83]: "Column 1, row 6: Empty. Column 1, row 5: Empty. Column 1, row 4: Empty. Column 1, row 3: Empty. Column 1, row 2: Empty. Column 1, row 1: Empty"
            - button "Column 2, 0 of 6 occupied" [disabled] [ref=e84]:
              - generic [ref=e86]: "2"
            - generic [ref=e99]: "Column 2, row 6: Empty. Column 2, row 5: Empty. Column 2, row 4: Empty. Column 2, row 3: Empty. Column 2, row 2: Empty. Column 2, row 1: Empty"
            - button "Column 3, 2 of 6 occupied" [disabled] [ref=e100]:
              - generic [ref=e102]: "3"
              - generic [ref=e112]: ●
              - generic [ref=e114]: ◆
            - generic [ref=e115]: "Column 3, row 6: Empty. Column 3, row 5: Empty. Column 3, row 4: Empty. Column 3, row 3: Empty. Column 3, row 2: Red circle. Column 3, row 1: Yellow diamond"
            - button "Column 4, 2 of 6 occupied" [disabled] [ref=e116]:
              - generic [ref=e118]: "4"
              - generic [ref=e128]: ◆
              - generic [ref=e130]: ●
            - generic [ref=e131]: "Column 4, row 6: Empty. Column 4, row 5: Empty. Column 4, row 4: Empty. Column 4, row 3: Empty. Column 4, row 2: Yellow diamond. Column 4, row 1: Red circle"
            - button "Column 5, 2 of 6 occupied" [disabled] [ref=e132]:
              - generic [ref=e134]: "5"
              - generic [ref=e144]: ◆
              - generic [ref=e146]: ●
            - generic [ref=e147]: "Column 5, row 6: Empty. Column 5, row 5: Empty. Column 5, row 4: Empty. Column 5, row 3: Empty. Column 5, row 2: Yellow diamond. Column 5, row 1: Red circle"
            - button "Column 6, 1 of 6 occupied" [disabled] [ref=e148]:
              - generic [ref=e150]: "6"
              - generic [ref=e162]: ●
            - generic [ref=e163]: "Column 6, row 6: Empty. Column 6, row 5: Empty. Column 6, row 4: Empty. Column 6, row 3: Empty. Column 6, row 2: Empty. Column 6, row 1: Red circle"
            - button "Column 7, 0 of 6 occupied" [disabled] [ref=e164]:
              - generic [ref=e166]: "7"
            - generic [ref=e179]: "Column 7, row 6: Empty. Column 7, row 5: Empty. Column 7, row 4: Empty. Column 7, row 3: Empty. Column 7, row 2: Empty. Column 7, row 1: Empty"
          - status [ref=e181]:
            - generic [ref=e182]:
              - generic [ref=e183]: "Red circle: avery. Yellow diamond: jordan_plays."
              - text: Red circle to move.
          - generic [ref=e191]:
            - img "Red circle" [ref=e192]:
              - generic [ref=e193]: ●
            - generic "avery" [ref=e196]
            - generic [ref=e197]: Your move
        - generic [ref=e200]:
          - group "Game actions" [ref=e201]:
            - button "Offer draw" [ref=e202] [cursor=pointer]:
              - paragraph [ref=e205]: Offer draw
            - button "Resign game" [ref=e206] [cursor=pointer]:
              - paragraph [ref=e209]:
                - text: Resign
                - generic [ref=e210]: game
          - button "History and stats" [ref=e211] [cursor=pointer]:
            - generic [ref=e213]:
              - paragraph [ref=e214]: History and stats
              - img [ref=e217]
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/game-session-client-ts/src/baselines/chromium/screens-games-frame-geometry/two-players-desktop-dark.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```