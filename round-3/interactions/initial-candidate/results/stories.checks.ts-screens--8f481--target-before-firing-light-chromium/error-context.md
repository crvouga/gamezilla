# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-board--correct-target-before-firing light
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
  - generic [ref=e12]:
    - generic [ref=e13]:
      - heading "Battleship" [level=1] [ref=e16]
      - generic [ref=e18]:
        - generic [ref=e19]: Unrated
        - generic [ref=e20]: ·Untimed
    - generic [ref=e21]:
      - generic [ref=e23]:
        - paragraph [ref=e24]: Your turn to fire.
        - generic [ref=e25]:
          - paragraph [ref=e30]: No moves yet.
          - button "All moves" [ref=e31] [cursor=pointer]:
            - img [ref=e35]
      - generic [ref=e37]:
        - generic [ref=e39]:
          - generic [ref=e46]:
            - img "Red fleet" [ref=e47]
            - generic [ref=e48]: jordan_plays
          - generic [ref=e50]:
            - generic [ref=e52]:
              - radiogroup "Boards" [ref=e54]:
                - radio "Your fleet" [ref=e55] [cursor=pointer]:
                  - generic [ref=e56]: Your fleet
                - radio "Targeting" [checked] [ref=e57] [cursor=pointer]:
                  - generic [ref=e58]: Targeting
              - region "Targeting" [ref=e59]:
                - generic [ref=e60]:
                  - group "Targeting" [ref=e61]:
                    - generic [ref=e63]: F
                    - generic [ref=e64]: G
                    - generic [ref=e65]: H
                    - generic [ref=e66]: I
                    - generic [ref=e67]: J
                    - generic [ref=e68]: "6"
                    - button "Fire at F6" [ref=e69] [cursor=pointer]
                    - button "Fire at G6" [ref=e70] [cursor=pointer]
                    - button "Fire at H6" [ref=e71] [cursor=pointer]
                    - button "Fire at I6" [ref=e72] [cursor=pointer]
                    - button "Fire at J6" [ref=e73] [cursor=pointer]
                    - generic [ref=e74]: "7"
                    - button "Fire at F7" [ref=e75] [cursor=pointer]
                    - button "Fire at G7" [ref=e76] [cursor=pointer]
                    - button "Fire at H7" [ref=e77] [cursor=pointer]
                    - button "Fire at I7" [ref=e78] [cursor=pointer]
                    - button "Fire at J7" [ref=e79] [cursor=pointer]
                    - generic [ref=e80]: "8"
                    - button "Fire at F8" [ref=e81] [cursor=pointer]
                    - button "Fire at G8" [ref=e82] [cursor=pointer]
                    - button "Fire at H8" [ref=e83] [cursor=pointer]
                    - button "Fire at I8" [ref=e84] [cursor=pointer]
                    - button "Fire at J8" [ref=e85] [cursor=pointer]
                    - generic [ref=e86]: "9"
                    - button "Fire at F9" [ref=e87] [cursor=pointer]
                    - button "Fire at G9" [ref=e88] [cursor=pointer]
                    - button "Fire at H9" [ref=e89] [cursor=pointer]
                    - button "Fire at I9" [ref=e90] [cursor=pointer]
                    - button "Fire at J9" [ref=e91] [cursor=pointer]
                    - generic [ref=e92]: "10"
                    - button "Fire at F10" [ref=e93] [cursor=pointer]
                    - button "Fire at G10" [ref=e94] [cursor=pointer]
                    - button "Fire at H10" [ref=e95] [cursor=pointer]
                    - button "Fire at I10" [ref=e96] [cursor=pointer]
                    - button "Fire at J10" [ref=e97] [cursor=pointer]
                  - button "Show whole board" [ref=e98] [cursor=pointer]:
                    - paragraph [ref=e101]: Show whole board
                  - generic [ref=e102]:
                    - button "A1–E5" [ref=e103] [cursor=pointer]:
                      - paragraph [ref=e106]: A1–E5
                    - button "F1–J5" [ref=e107] [cursor=pointer]:
                      - paragraph [ref=e110]: F1–J5
                    - button "A6–E10" [ref=e111] [cursor=pointer]:
                      - paragraph [ref=e114]: A6–E10
                    - button "F6–J10" [active] [ref=e115] [cursor=pointer]:
                      - paragraph [ref=e118]: F6–J10
            - button "Choose a target" [disabled] [ref=e119]:
              - paragraph [ref=e122]: Choose a target
            - list "Key" [ref=e123]:
              - listitem [ref=e124]:
                - generic [ref=e125]:
                  - generic: ■
                - text: Ship
              - listitem [ref=e126]:
                - generic [ref=e127]:
                  - generic: ○
                - text: Miss
              - listitem [ref=e128]:
                - generic [ref=e129]:
                  - generic: ✕
                - text: Hit
              - listitem [ref=e130]:
                - generic [ref=e131]:
                  - generic: ✖
                - text: Sunk
          - status [ref=e133]:
            - generic [ref=e134]:
              - generic [ref=e135]: "Blue fleet: avery. Red fleet: jordan_plays."
              - text: Your turn to fire.
          - generic [ref=e143]:
            - img "Blue fleet" [ref=e144]
            - generic [ref=e145]: avery
            - generic [ref=e146]: Your move
        - generic [ref=e149]:
          - group "Game actions" [ref=e150]:
            - button "Resign game" [ref=e151] [cursor=pointer]:
              - paragraph [ref=e154]:
                - text: Resign
                - generic [ref=e155]: game
          - button "History and stats" [ref=e156] [cursor=pointer]:
            - generic [ref=e158]:
              - paragraph [ref=e159]: History and stats
              - img [ref=e162]
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