# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-frame-geometry--long-name-rail-desktop dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/game-session-client-ts/src/baselines/chromium/screens-games-frame-geometry/long-name-rail-desktop-dark-1440.png.
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
        - group "Connect Four board, seven columns and six rows" [ref=e29]:
          - paragraph [ref=e30]
          - button "Column 1, 0 of 6 occupied" [disabled] [ref=e31]:
            - generic [ref=e33]: "1"
          - generic [ref=e46]: "Column 1, row 6: Empty. Column 1, row 5: Empty. Column 1, row 4: Empty. Column 1, row 3: Empty. Column 1, row 2: Empty. Column 1, row 1: Empty"
          - button "Column 2, 0 of 6 occupied" [disabled] [ref=e47]:
            - generic [ref=e49]: "2"
          - generic [ref=e62]: "Column 2, row 6: Empty. Column 2, row 5: Empty. Column 2, row 4: Empty. Column 2, row 3: Empty. Column 2, row 2: Empty. Column 2, row 1: Empty"
          - button "Column 3, 2 of 6 occupied" [disabled] [ref=e63]:
            - generic [ref=e65]: "3"
            - generic [ref=e75]: ●
            - generic [ref=e77]: ◆
          - generic [ref=e78]: "Column 3, row 6: Empty. Column 3, row 5: Empty. Column 3, row 4: Empty. Column 3, row 3: Empty. Column 3, row 2: Red circle. Column 3, row 1: Yellow diamond"
          - button "Column 4, 2 of 6 occupied" [disabled] [ref=e79]:
            - generic [ref=e81]: "4"
            - generic [ref=e91]: ◆
            - generic [ref=e93]: ●
          - generic [ref=e94]: "Column 4, row 6: Empty. Column 4, row 5: Empty. Column 4, row 4: Empty. Column 4, row 3: Empty. Column 4, row 2: Yellow diamond. Column 4, row 1: Red circle"
          - button "Column 5, 2 of 6 occupied" [disabled] [ref=e95]:
            - generic [ref=e97]: "5"
            - generic [ref=e107]: ◆
            - generic [ref=e109]: ●
          - generic [ref=e110]: "Column 5, row 6: Empty. Column 5, row 5: Empty. Column 5, row 4: Empty. Column 5, row 3: Empty. Column 5, row 2: Yellow diamond. Column 5, row 1: Red circle"
          - button "Column 6, 1 of 6 occupied" [disabled] [ref=e111]:
            - generic [ref=e113]: "6"
            - generic [ref=e125]: ●
          - generic [ref=e126]: "Column 6, row 6: Empty. Column 6, row 5: Empty. Column 6, row 4: Empty. Column 6, row 3: Empty. Column 6, row 2: Empty. Column 6, row 1: Red circle"
          - button "Column 7, 0 of 6 occupied" [disabled] [ref=e127]:
            - generic [ref=e129]: "7"
          - generic [ref=e142]: "Column 7, row 6: Empty. Column 7, row 5: Empty. Column 7, row 4: Empty. Column 7, row 3: Empty. Column 7, row 2: Empty. Column 7, row 1: Empty"
        - status [ref=e144]:
          - generic [ref=e145]:
            - generic [ref=e146]: "Red circle: avery. Yellow diamond: jordan_plays."
            - text: Red circle to move.
      - region "Players" [ref=e148]:
        - heading "Players" [level=2] [ref=e151]
        - generic [ref=e152]:
          - generic [ref=e159]:
            - img "Red circle" [ref=e160]:
              - generic [ref=e161]: ●
            - generic "avery_the_extraordinarily_patient_strategist" [ref=e164]
            - generic [ref=e165]: Your move
            - generic [ref=e168]: You
          - generic [ref=e175]:
            - img "Yellow diamond" [ref=e176]:
              - generic [ref=e177]: ◆
            - generic "jordan_plays_every_single_evening_online" [ref=e180]
        - generic [ref=e182]:
          - group "Game actions" [ref=e183]:
            - button "Offer draw" [ref=e184] [cursor=pointer]:
              - paragraph [ref=e187]: Offer draw
            - button "Resign game" [ref=e188] [cursor=pointer]:
              - paragraph [ref=e191]:
                - text: Resign
                - generic [ref=e192]: game
          - button "History and stats" [ref=e193] [cursor=pointer]:
            - paragraph [ref=e196]: History and stats
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/game-session-client-ts/src/baselines/chromium/screens-games-frame-geometry/long-name-rail-desktop-dark-1440.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```