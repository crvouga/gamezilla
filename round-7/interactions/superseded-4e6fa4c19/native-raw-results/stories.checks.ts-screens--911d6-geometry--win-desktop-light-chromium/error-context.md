# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-frame-geometry--win-desktop light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/game-session-client-ts/src/baselines/chromium/screens-games-frame-geometry/win-desktop-light.png.
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
        - generic [ref=e24]:
          - heading "You win" [level=2] [ref=e25]
          - paragraph [ref=e26]: Host starts the rematch
        - group "What next" [ref=e27]:
          - button "Done" [disabled] [ref=e28]:
            - generic [ref=e30]:
              - generic:
                - generic:
                  - paragraph: Rematch
              - generic [ref=e32]:
                - img [ref=e35]
                - paragraph [ref=e38]: Done
          - button "Change game" [ref=e39] [cursor=pointer]:
            - paragraph [ref=e42]: Change game
          - button "Review" [ref=e43] [cursor=pointer]:
            - paragraph [ref=e46]: Review
      - generic [ref=e49]:
        - paragraph [ref=e52]: Final
        - list "Moves played" [ref=e57]:
          - listitem [ref=e58]:
            - generic [ref=e59]: Move 4
            - generic [ref=e60]: Column
            - generic [ref=e61]:
              - generic [ref=e63]: ●
              - 'button "Move 7, Red circle: 4" [ref=e64] [cursor=pointer]': "4"
        - button "All moves" [ref=e65] [cursor=pointer]:
          - img [ref=e69]
      - generic [ref=e71]:
        - generic [ref=e73]:
          - generic [ref=e80]:
            - img "Yellow diamond" [ref=e81]:
              - generic [ref=e82]: ◆
            - generic "jordan_plays" [ref=e85]
          - group "Connect Four board, seven columns and six rows" [ref=e87]:
            - button "Column 1, 0 of 6 occupied" [disabled] [ref=e88]:
              - generic [ref=e90]: "1"
            - generic [ref=e103]: "Column 1, row 6: Empty. Column 1, row 5: Empty. Column 1, row 4: Empty. Column 1, row 3: Empty. Column 1, row 2: Empty. Column 1, row 1: Empty"
            - button "Column 2, 0 of 6 occupied" [disabled] [ref=e104]:
              - generic [ref=e106]: "2"
            - generic [ref=e119]: "Column 2, row 6: Empty. Column 2, row 5: Empty. Column 2, row 4: Empty. Column 2, row 3: Empty. Column 2, row 2: Empty. Column 2, row 1: Empty"
            - button "Column 3, 3 of 6 occupied" [disabled] [ref=e120]:
              - generic [ref=e122]: "3"
              - generic [ref=e130]: ◆
              - generic [ref=e132]: ◆
              - generic [ref=e134]: ◆
            - generic [ref=e135]: "Column 3, row 6: Empty. Column 3, row 5: Empty. Column 3, row 4: Empty. Column 3, row 3: Yellow diamond. Column 3, row 2: Yellow diamond. Column 3, row 1: Yellow diamond"
            - button "Column 4, 4 of 6 occupied" [disabled] [ref=e136]:
              - generic [ref=e138]: "4"
              - generic [ref=e144]: ●
              - generic [ref=e146]: ●
              - generic [ref=e148]: ●
              - generic [ref=e150]: ●
            - generic [ref=e151]: "Column 4, row 6: Empty. Column 4, row 5: Empty. Column 4, row 4: Red circle. Column 4, row 3: Red circle. Column 4, row 2: Red circle. Column 4, row 1: Red circle"
            - button "Column 5, 0 of 6 occupied" [disabled] [ref=e152]:
              - generic [ref=e154]: "5"
            - generic [ref=e167]: "Column 5, row 6: Empty. Column 5, row 5: Empty. Column 5, row 4: Empty. Column 5, row 3: Empty. Column 5, row 2: Empty. Column 5, row 1: Empty"
            - button "Column 6, 0 of 6 occupied" [disabled] [ref=e168]:
              - generic [ref=e170]: "6"
            - generic [ref=e183]: "Column 6, row 6: Empty. Column 6, row 5: Empty. Column 6, row 4: Empty. Column 6, row 3: Empty. Column 6, row 2: Empty. Column 6, row 1: Empty"
            - button "Column 7, 0 of 6 occupied" [disabled] [ref=e184]:
              - generic [ref=e186]: "7"
            - generic [ref=e199]: "Column 7, row 6: Empty. Column 7, row 5: Empty. Column 7, row 4: Empty. Column 7, row 3: Empty. Column 7, row 2: Empty. Column 7, row 1: Empty"
          - status [ref=e201]:
            - generic [ref=e202]:
              - generic [ref=e203]: "Red circle: avery. Yellow diamond: jordan_plays."
              - text: Red circle wins by four in a row.
          - generic [ref=e211]:
            - img "Red circle" [ref=e212]:
              - generic [ref=e213]: ●
            - generic "avery" [ref=e216]
        - generic [ref=e217]:
          - list "Standings" [ref=e219]:
            - listitem [ref=e220]:
              - generic [ref=e221]:
                - generic [ref=e222]: 1st
                - generic [ref=e225]: avery
            - listitem [ref=e226]:
              - generic [ref=e227]:
                - generic [ref=e228]: 2nd
                - generic [ref=e231]: jordan_plays
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/game-session-client-ts/src/baselines/chromium/screens-games-frame-geometry/win-desktop-light.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```