# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-frame-geometry--drawn dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/game-session-client-ts/src/baselines/chromium/screens-games-frame-geometry/drawn-dark-1440.png.
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
          - heading "Draw" [level=2] [ref=e28]
          - paragraph [ref=e29]: Host starts the rematch
        - group "What next" [ref=e30]:
          - button "Rematch" [ref=e31] [cursor=pointer]:
            - paragraph [ref=e34]: Rematch
          - button "Change game" [ref=e35] [cursor=pointer]:
            - paragraph [ref=e38]: Change game
          - button "Review" [ref=e39] [cursor=pointer]:
            - paragraph [ref=e42]: Review
      - generic [ref=e43]:
        - generic [ref=e45]:
          - generic [ref=e52]:
            - img "Yellow diamond" [ref=e53]:
              - generic [ref=e54]: ◆
            - generic "jordan_plays" [ref=e57]
          - group "Connect Four board, seven columns and six rows" [ref=e59]:
            - button "Column 1, 0 of 6 occupied" [disabled] [ref=e60]:
              - generic [ref=e62]: "1"
            - generic [ref=e75]: "Column 1, row 6: Empty. Column 1, row 5: Empty. Column 1, row 4: Empty. Column 1, row 3: Empty. Column 1, row 2: Empty. Column 1, row 1: Empty"
            - button "Column 2, 0 of 6 occupied" [disabled] [ref=e76]:
              - generic [ref=e78]: "2"
            - generic [ref=e91]: "Column 2, row 6: Empty. Column 2, row 5: Empty. Column 2, row 4: Empty. Column 2, row 3: Empty. Column 2, row 2: Empty. Column 2, row 1: Empty"
            - button "Column 3, 3 of 6 occupied" [disabled] [ref=e92]:
              - generic [ref=e94]: "3"
              - generic [ref=e102]: ◆
              - generic [ref=e104]: ◆
              - generic [ref=e106]: ◆
            - generic [ref=e107]: "Column 3, row 6: Empty. Column 3, row 5: Empty. Column 3, row 4: Empty. Column 3, row 3: Yellow diamond. Column 3, row 2: Yellow diamond. Column 3, row 1: Yellow diamond"
            - button "Column 4, 4 of 6 occupied" [disabled] [ref=e108]:
              - generic [ref=e110]: "4"
              - generic [ref=e116]: ●
              - generic [ref=e118]: ●
              - generic [ref=e120]: ●
              - generic [ref=e122]: ●
            - generic [ref=e123]: "Column 4, row 6: Empty. Column 4, row 5: Empty. Column 4, row 4: Red circle. Column 4, row 3: Red circle. Column 4, row 2: Red circle. Column 4, row 1: Red circle"
            - button "Column 5, 0 of 6 occupied" [disabled] [ref=e124]:
              - generic [ref=e126]: "5"
            - generic [ref=e139]: "Column 5, row 6: Empty. Column 5, row 5: Empty. Column 5, row 4: Empty. Column 5, row 3: Empty. Column 5, row 2: Empty. Column 5, row 1: Empty"
            - button "Column 6, 0 of 6 occupied" [disabled] [ref=e140]:
              - generic [ref=e142]: "6"
            - generic [ref=e155]: "Column 6, row 6: Empty. Column 6, row 5: Empty. Column 6, row 4: Empty. Column 6, row 3: Empty. Column 6, row 2: Empty. Column 6, row 1: Empty"
            - button "Column 7, 0 of 6 occupied" [disabled] [ref=e156]:
              - generic [ref=e158]: "7"
            - generic [ref=e171]: "Column 7, row 6: Empty. Column 7, row 5: Empty. Column 7, row 4: Empty. Column 7, row 3: Empty. Column 7, row 2: Empty. Column 7, row 1: Empty"
          - status [ref=e173]:
            - generic [ref=e174]:
              - generic [ref=e175]: "Red circle: avery. Yellow diamond: jordan_plays."
              - text: Game drawn.
          - generic [ref=e183]:
            - img "Red circle" [ref=e184]:
              - generic [ref=e185]: ●
            - generic "avery" [ref=e188]
        - list "Standings" [ref=e191]:
          - listitem [ref=e192]:
            - generic [ref=e193]:
              - generic [ref=e194]: 1st
              - generic [ref=e197]: avery
          - listitem [ref=e198]:
            - generic [ref=e199]:
              - generic [ref=e200]: 1st
              - generic [ref=e203]: jordan_plays
        - region "Game record" [ref=e205]:
          - heading "Game record" [level=2] [ref=e208]
          - generic [ref=e209]:
            - generic [ref=e210]:
              - generic [ref=e211]: Column
              - list "Moves played" [ref=e212]:
                - listitem [ref=e213]:
                  - generic [ref=e214]: "1"
                  - generic [ref=e215]:
                    - generic [ref=e217]: ●
                    - 'button "Move 1, Red circle: 4" [ref=e218] [cursor=pointer]': "4"
                  - generic [ref=e219]:
                    - generic [ref=e221]: ◆
                    - 'button "Move 2, Yellow diamond: 3" [ref=e222] [cursor=pointer]': "3"
                - listitem [ref=e223]:
                  - generic [ref=e224]: "2"
                  - generic [ref=e225]:
                    - generic [ref=e227]: ●
                    - 'button "Move 3, Red circle: 4" [ref=e228] [cursor=pointer]': "4"
                  - generic [ref=e229]:
                    - generic [ref=e231]: ◆
                    - 'button "Move 4, Yellow diamond: 3" [ref=e232] [cursor=pointer]': "3"
                - listitem [ref=e233]:
                  - generic [ref=e234]: "3"
                  - generic [ref=e235]:
                    - generic [ref=e237]: ●
                    - 'button "Move 5, Red circle: 4" [ref=e238] [cursor=pointer]': "4"
                  - generic [ref=e239]:
                    - generic [ref=e241]: ◆
                    - 'button "Move 6, Yellow diamond: 3" [ref=e242] [cursor=pointer]': "3"
                - listitem [ref=e243]:
                  - generic [ref=e244]: "4"
                  - generic [ref=e245]:
                    - generic [ref=e247]: ●
                    - 'button "Move 7, Red circle: 4" [ref=e248] [cursor=pointer]': "4"
            - generic [ref=e249]:
              - generic [ref=e250]:
                - button "Go to the start" [ref=e251] [cursor=pointer]:
                  - img [ref=e254]
                - button "Previous move" [ref=e257] [cursor=pointer]:
                  - img [ref=e260]
                - button "Next move" [disabled] [ref=e262]:
                  - img [ref=e265]
                - button "Return to current position" [ref=e267] [cursor=pointer]:
                  - img [ref=e270]
              - button "Go to move" [ref=e273] [cursor=pointer]:
                - generic [ref=e275]:
                  - paragraph [ref=e276]: Go to move
                  - img [ref=e279]
          - button "History and stats" [ref=e283] [cursor=pointer]:
            - paragraph [ref=e286]: History and stats
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/game-session-client-ts/src/baselines/chromium/screens-games-frame-geometry/drawn-dark-1440.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```