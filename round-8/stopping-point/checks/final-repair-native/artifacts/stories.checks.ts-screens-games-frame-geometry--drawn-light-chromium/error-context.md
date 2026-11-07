# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-frame-geometry--drawn light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/game-session-client-ts/src/baselines/chromium/screens-games-frame-geometry/drawn-light.png.
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
      - generic [ref=e25]:
        - generic [ref=e26]:
          - heading "Draw" [level=2] [ref=e27]
          - paragraph [ref=e28]: Host starts the rematch
        - status [ref=e32]:
          - generic [ref=e33]:
            - generic [ref=e34]: "Red circle: avery. Yellow diamond: jordan_plays."
            - text: Game drawn.
        - group "What next" [ref=e35]:
          - button "Rematch" [ref=e36] [cursor=pointer]:
            - paragraph [ref=e39]: Rematch
          - button "Change game" [ref=e40] [cursor=pointer]:
            - paragraph [ref=e43]: Change game
          - button "Review" [ref=e44] [cursor=pointer]:
            - paragraph [ref=e47]: Review
      - generic [ref=e50]:
        - paragraph [ref=e52]: Finished
        - list "Moves played" [ref=e57]:
          - listitem [ref=e58]:
            - generic [ref=e59]: Move 21
            - generic [ref=e60]: Column
            - generic [ref=e61]:
              - generic [ref=e63]: ●
              - 'button "Move 41, Red circle: 7" [ref=e64] [cursor=pointer]': "7"
            - generic [ref=e65]:
              - generic [ref=e67]: ◆
              - 'button "Move 42, Yellow diamond: 7" [ref=e68] [cursor=pointer]': "7"
        - button "All moves" [ref=e69] [cursor=pointer]:
          - img [ref=e73]
      - generic [ref=e75]:
        - generic [ref=e77]:
          - generic [ref=e84]:
            - img "Yellow diamond" [ref=e85]:
              - generic [ref=e86]: ◆
            - generic "jordan_plays" [ref=e89]
          - group "Connect Four board, seven columns and six rows" [ref=e91]:
            - button "Column 1, 0 of 6 occupied" [disabled] [ref=e92]:
              - generic [ref=e94]: "1"
            - generic [ref=e107]: "Column 1, row 6: Empty. Column 1, row 5: Empty. Column 1, row 4: Empty. Column 1, row 3: Empty. Column 1, row 2: Empty. Column 1, row 1: Empty"
            - button "Column 2, 0 of 6 occupied" [disabled] [ref=e108]:
              - generic [ref=e110]: "2"
            - generic [ref=e123]: "Column 2, row 6: Empty. Column 2, row 5: Empty. Column 2, row 4: Empty. Column 2, row 3: Empty. Column 2, row 2: Empty. Column 2, row 1: Empty"
            - button "Column 3, 3 of 6 occupied" [disabled] [ref=e124]:
              - generic [ref=e126]: "3"
              - generic [ref=e134]: ◆
              - generic [ref=e136]: ◆
              - generic [ref=e138]: ◆
            - generic [ref=e139]: "Column 3, row 6: Empty. Column 3, row 5: Empty. Column 3, row 4: Empty. Column 3, row 3: Yellow diamond. Column 3, row 2: Yellow diamond. Column 3, row 1: Yellow diamond"
            - button "Column 4, 4 of 6 occupied" [disabled] [ref=e140]:
              - generic [ref=e142]: "4"
              - generic [ref=e148]: ●
              - generic [ref=e150]: ●
              - generic [ref=e152]: ●
              - generic [ref=e154]: ●
            - generic [ref=e155]: "Column 4, row 6: Empty. Column 4, row 5: Empty. Column 4, row 4: Red circle. Column 4, row 3: Red circle. Column 4, row 2: Red circle. Column 4, row 1: Red circle"
            - button "Column 5, 0 of 6 occupied" [disabled] [ref=e156]:
              - generic [ref=e158]: "5"
            - generic [ref=e171]: "Column 5, row 6: Empty. Column 5, row 5: Empty. Column 5, row 4: Empty. Column 5, row 3: Empty. Column 5, row 2: Empty. Column 5, row 1: Empty"
            - button "Column 6, 0 of 6 occupied" [disabled] [ref=e172]:
              - generic [ref=e174]: "6"
            - generic [ref=e187]: "Column 6, row 6: Empty. Column 6, row 5: Empty. Column 6, row 4: Empty. Column 6, row 3: Empty. Column 6, row 2: Empty. Column 6, row 1: Empty"
            - button "Column 7, 0 of 6 occupied" [disabled] [ref=e188]:
              - generic [ref=e190]: "7"
            - generic [ref=e203]: "Column 7, row 6: Empty. Column 7, row 5: Empty. Column 7, row 4: Empty. Column 7, row 3: Empty. Column 7, row 2: Empty. Column 7, row 1: Empty"
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
                - generic [ref=e228]: 1st
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/game-session-client-ts/src/baselines/chromium/screens-games-frame-geometry/drawn-light.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```