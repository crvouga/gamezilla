# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-frame-geometry--win dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/game-session-client-ts/src/baselines/chromium/screens-games-frame-geometry/win-dark.png.
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
          - heading "You win" [level=2] [ref=e27]
          - paragraph [ref=e28]: Host starts the rematch
        - status [ref=e32]:
          - generic [ref=e33]:
            - generic [ref=e34]: "Red circle: avery. Yellow diamond: jordan_plays."
            - text: Red circle wins by four in a row.
        - group "What next" [ref=e35]:
          - button "Done" [disabled] [ref=e36]:
            - generic [ref=e38]:
              - generic:
                - generic:
                  - paragraph: Rematch
              - generic [ref=e40]:
                - img [ref=e43]
                - paragraph [ref=e46]: Done
          - button "Change game" [ref=e47] [cursor=pointer]:
            - paragraph [ref=e50]: Change game
          - button "Review" [ref=e51] [cursor=pointer]:
            - paragraph [ref=e54]: Review
      - generic [ref=e57]:
        - paragraph [ref=e59]: Finished
        - list "Moves played" [ref=e64]:
          - listitem [ref=e65]:
            - generic [ref=e66]: Move 4
            - generic [ref=e67]: Column
            - generic [ref=e68]:
              - generic [ref=e70]: ●
              - 'button "Move 7, Red circle: 4" [ref=e71] [cursor=pointer]': "4"
        - button "All moves" [ref=e72] [cursor=pointer]:
          - img [ref=e76]
      - generic [ref=e78]:
        - generic [ref=e80]:
          - generic [ref=e87]:
            - img "Yellow diamond" [ref=e88]:
              - generic [ref=e89]: ◆
            - generic "jordan_plays" [ref=e92]
          - group "Connect Four board, seven columns and six rows" [ref=e94]:
            - button "Column 1, 0 of 6 occupied" [disabled] [ref=e95]:
              - generic [ref=e97]: "1"
            - generic [ref=e110]: "Column 1, row 6: Empty. Column 1, row 5: Empty. Column 1, row 4: Empty. Column 1, row 3: Empty. Column 1, row 2: Empty. Column 1, row 1: Empty"
            - button "Column 2, 0 of 6 occupied" [disabled] [ref=e111]:
              - generic [ref=e113]: "2"
            - generic [ref=e126]: "Column 2, row 6: Empty. Column 2, row 5: Empty. Column 2, row 4: Empty. Column 2, row 3: Empty. Column 2, row 2: Empty. Column 2, row 1: Empty"
            - button "Column 3, 3 of 6 occupied" [disabled] [ref=e127]:
              - generic [ref=e129]: "3"
              - generic [ref=e137]: ◆
              - generic [ref=e139]: ◆
              - generic [ref=e141]: ◆
            - generic [ref=e142]: "Column 3, row 6: Empty. Column 3, row 5: Empty. Column 3, row 4: Empty. Column 3, row 3: Yellow diamond. Column 3, row 2: Yellow diamond. Column 3, row 1: Yellow diamond"
            - button "Column 4, 4 of 6 occupied" [disabled] [ref=e143]:
              - generic [ref=e145]: "4"
              - generic [ref=e151]: ●
              - generic [ref=e153]: ●
              - generic [ref=e155]: ●
              - generic [ref=e157]: ●
            - generic [ref=e158]: "Column 4, row 6: Empty. Column 4, row 5: Empty. Column 4, row 4: Red circle. Column 4, row 3: Red circle. Column 4, row 2: Red circle. Column 4, row 1: Red circle"
            - button "Column 5, 0 of 6 occupied" [disabled] [ref=e159]:
              - generic [ref=e161]: "5"
            - generic [ref=e174]: "Column 5, row 6: Empty. Column 5, row 5: Empty. Column 5, row 4: Empty. Column 5, row 3: Empty. Column 5, row 2: Empty. Column 5, row 1: Empty"
            - button "Column 6, 0 of 6 occupied" [disabled] [ref=e175]:
              - generic [ref=e177]: "6"
            - generic [ref=e190]: "Column 6, row 6: Empty. Column 6, row 5: Empty. Column 6, row 4: Empty. Column 6, row 3: Empty. Column 6, row 2: Empty. Column 6, row 1: Empty"
            - button "Column 7, 0 of 6 occupied" [disabled] [ref=e191]:
              - generic [ref=e193]: "7"
            - generic [ref=e206]: "Column 7, row 6: Empty. Column 7, row 5: Empty. Column 7, row 4: Empty. Column 7, row 3: Empty. Column 7, row 2: Empty. Column 7, row 1: Empty"
          - generic [ref=e214]:
            - img "Red circle" [ref=e215]:
              - generic [ref=e216]: ●
            - generic "avery" [ref=e219]
        - generic [ref=e220]:
          - list "Standings" [ref=e222]:
            - listitem [ref=e223]:
              - generic [ref=e224]:
                - generic [ref=e225]: 1st
                - generic [ref=e228]: avery
            - listitem [ref=e229]:
              - generic [ref=e230]:
                - generic [ref=e231]: 2nd
                - generic [ref=e234]: jordan_plays
          - button "History and stats" [ref=e237] [cursor=pointer]:
            - generic [ref=e239]:
              - paragraph [ref=e240]: History and stats
              - img [ref=e243]
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/game-session-client-ts/src/baselines/chromium/screens-games-frame-geometry/win-dark.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```