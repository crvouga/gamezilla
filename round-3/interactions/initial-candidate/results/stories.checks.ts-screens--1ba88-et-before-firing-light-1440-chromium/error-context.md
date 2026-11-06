# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-board--correct-target-before-firing light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "success"
Received: "error: expected 23.796875 to be greater than or equal to 44"

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e15]:
    - generic [ref=e16]:
      - heading "Battleship" [level=1] [ref=e19]
      - generic [ref=e21]:
        - generic [ref=e22]: Unrated
        - generic [ref=e23]: ·Untimed
    - generic [ref=e25]:
      - generic [ref=e27]:
        - generic [ref=e34]:
          - img "Red fleet" [ref=e35]
          - generic [ref=e36]: jordan_plays
        - generic [ref=e38]:
          - generic [ref=e40]:
            - radiogroup "Boards" [ref=e42]:
              - radio "Your fleet" [ref=e43] [cursor=pointer]:
                - generic [ref=e44]: Your fleet
              - radio "Targeting" [checked] [ref=e45] [cursor=pointer]:
                - generic [ref=e46]: Targeting
            - region "Targeting" [ref=e47]:
              - generic [ref=e48]:
                - group "Targeting" [ref=e49]:
                  - generic [ref=e51]: F
                  - generic [ref=e52]: G
                  - generic [ref=e53]: H
                  - generic [ref=e54]: I
                  - generic [ref=e55]: J
                  - generic [ref=e56]: "6"
                  - button "Fire at F6" [ref=e57] [cursor=pointer]
                  - button "Fire at G6" [ref=e58] [cursor=pointer]
                  - button "Fire at H6" [ref=e59] [cursor=pointer]
                  - button "Fire at I6" [ref=e60] [cursor=pointer]
                  - button "Fire at J6" [ref=e61] [cursor=pointer]
                  - generic [ref=e62]: "7"
                  - button "Fire at F7" [ref=e63] [cursor=pointer]
                  - button "Fire at G7" [ref=e64] [cursor=pointer]
                  - button "Fire at H7" [ref=e65] [cursor=pointer]
                  - button "Fire at I7" [ref=e66] [cursor=pointer]
                  - button "Fire at J7" [ref=e67] [cursor=pointer]
                  - generic [ref=e68]: "8"
                  - button "Fire at F8" [ref=e69] [cursor=pointer]
                  - button "Fire at G8" [ref=e70] [cursor=pointer]
                  - button "Fire at H8" [ref=e71] [cursor=pointer]
                  - button "Fire at I8" [ref=e72] [cursor=pointer]
                  - button "Fire at J8" [ref=e73] [cursor=pointer]
                  - generic [ref=e74]: "9"
                  - button "Fire at F9" [ref=e75] [cursor=pointer]
                  - button "Fire at G9" [ref=e76] [cursor=pointer]
                  - button "Fire at H9" [ref=e77] [cursor=pointer]
                  - button "Fire at I9" [ref=e78] [cursor=pointer]
                  - button "Fire at J9" [ref=e79] [cursor=pointer]
                  - generic [ref=e80]: "10"
                  - button "Fire at F10" [ref=e81] [cursor=pointer]
                  - button "Fire at G10" [ref=e82] [cursor=pointer]
                  - button "Fire at H10" [ref=e83] [cursor=pointer]
                  - button "Fire at I10" [ref=e84] [cursor=pointer]
                  - button "Fire at J10" [ref=e85] [cursor=pointer]
                - button "Show whole board" [ref=e86] [cursor=pointer]:
                  - paragraph [ref=e89]: Show whole board
                - generic [ref=e90]:
                  - button "A1–E5" [ref=e91] [cursor=pointer]:
                    - paragraph [ref=e94]: A1–E5
                  - button "F1–J5" [ref=e95] [cursor=pointer]:
                    - paragraph [ref=e98]: F1–J5
                  - button "A6–E10" [ref=e99] [cursor=pointer]:
                    - paragraph [ref=e102]: A6–E10
                  - button "F6–J10" [active] [ref=e103] [cursor=pointer]:
                    - paragraph [ref=e106]: F6–J10
          - button "Choose a target" [disabled] [ref=e107]:
            - paragraph [ref=e110]: Choose a target
          - list "Key" [ref=e111]:
            - listitem [ref=e112]:
              - generic [ref=e113]:
                - generic: ■
              - text: Ship
            - listitem [ref=e114]:
              - generic [ref=e115]:
                - generic: ○
              - text: Miss
            - listitem [ref=e116]:
              - generic [ref=e117]:
                - generic: ✕
              - text: Hit
            - listitem [ref=e118]:
              - generic [ref=e119]:
                - generic: ✖
              - text: Sunk
        - status [ref=e121]:
          - generic [ref=e122]:
            - generic [ref=e123]: "Blue fleet: avery. Red fleet: jordan_plays."
            - text: Your turn to fire.
        - generic [ref=e131]:
          - img "Blue fleet" [ref=e132]
          - generic [ref=e133]: avery
          - generic [ref=e134]: Your move
      - region "Game record" [ref=e137]:
        - generic [ref=e138]:
          - heading "Game record" [level=2] [ref=e140]
          - paragraph [ref=e141]: Your turn to fire.
        - generic [ref=e143]:
          - group "Game actions" [ref=e144]:
            - button "Resign game" [ref=e145] [cursor=pointer]:
              - paragraph [ref=e148]:
                - text: Resign
                - generic [ref=e149]: game
          - button "History and stats" [ref=e150] [cursor=pointer]:
            - paragraph [ref=e153]: History and stats
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