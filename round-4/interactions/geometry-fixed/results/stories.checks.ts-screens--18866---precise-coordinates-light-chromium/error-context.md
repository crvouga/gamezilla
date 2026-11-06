# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--precise-coordinates light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "success"
Received: "error: custom-game-board-wall-commit: expected [ 'outside initial viewport', …(3) ] to deeply equal []"

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - 'heading "Quoridor: King of the Hill" [level=1] [ref=e16]'
      - generic [ref=e18]:
        - generic [ref=e19]: Unrated
        - generic [ref=e20]: ·Untimed
    - generic [ref=e21]:
      - generic [ref=e23]:
        - paragraph [ref=e24]: Your turn. First to e5 wins.
        - generic [ref=e25]:
          - list "Moves played" [ref=e30]:
            - listitem [ref=e31]:
              - generic [ref=e32]: Move 1
              - generic [ref=e33]:
                - generic [ref=e35]: ●
                - 'button "Move 1, South red circle: e2" [ref=e36] [cursor=pointer]': e2
              - generic [ref=e37]:
                - generic [ref=e39]: ◆
                - 'button "Move 2, West gold diamond: a4" [ref=e40] [cursor=pointer]': a4
              - generic [ref=e41]:
                - generic [ref=e43]: ▲
                - 'button "Move 3, North green triangle: e8" [ref=e44] [cursor=pointer]': e8
              - generic [ref=e45]:
                - generic [ref=e47]: ■
                - 'button "Move 4, East black square: i6" [ref=e48] [cursor=pointer]': i6
          - button "All moves" [ref=e49] [cursor=pointer]:
            - img [ref=e53]
      - generic [ref=e55]:
        - generic [ref=e57]:
          - list "Players" [ref=e58]:
            - listitem [ref=e59]:
              - generic [ref=e64]:
                - generic [ref=e65]: avery
                - generic [ref=e66]:
                  - generic [ref=e68]: ●
                  - generic [ref=e69]: Walls 5
                  - generic [ref=e71]: You
            - listitem [ref=e72]:
              - generic [ref=e76]:
                - generic [ref=e77]: jordan_plays
                - generic [ref=e78]:
                  - generic [ref=e80]: ◆
                  - generic [ref=e81]: Walls 5
            - listitem [ref=e82]:
              - generic [ref=e86]:
                - generic [ref=e87]: morgan
                - generic [ref=e88]:
                  - generic [ref=e90]: ▲
                  - generic [ref=e91]: Walls 5
            - listitem [ref=e92]:
              - generic [ref=e96]:
                - generic [ref=e97]: robin_42
                - generic [ref=e98]:
                  - generic [ref=e100]: ■
                  - generic [ref=e101]: Walls 5
          - generic [ref=e103]:
            - generic [ref=e104]:
              - button "Move pawn" [ref=e105] [cursor=pointer]:
                - paragraph [ref=e108]: Move pawn
              - button "Horizontal wall" [pressed] [ref=e109] [cursor=pointer]:
                - paragraph [ref=e112]: Wall across
              - button "Vertical wall" [ref=e113] [cursor=pointer]:
                - paragraph [ref=e116]: Wall down
            - group "Quoridor board, nine columns and nine rows" [ref=e117]:
              - generic [ref=e119]: a
              - generic [ref=e120]: b
              - generic [ref=e121]: c
              - generic [ref=e122]: d
              - generic [ref=e123]: e
              - generic [ref=e124]: f
              - generic [ref=e125]: g
              - generic [ref=e126]: h
              - generic [ref=e127]: i
              - generic [ref=e128]: "9"
              - 'button "a9: Empty" [disabled] [ref=e129]'
              - 'button "b9: Empty" [disabled] [ref=e130]'
              - 'button "c9: Empty" [disabled] [ref=e131]'
              - 'button "d9: Empty" [disabled] [ref=e132]'
              - 'button "e9: Empty" [disabled] [ref=e133]'
              - 'button "f9: Empty" [disabled] [ref=e134]'
              - 'button "g9: Empty" [disabled] [ref=e135]'
              - 'button "h9: Empty" [disabled] [ref=e136]'
              - 'button "i9: Empty" [disabled] [ref=e137]'
              - generic [ref=e138]: "8"
              - 'button "a8: Empty" [ref=e139] [cursor=pointer]'
              - 'button "b8: Empty" [ref=e140] [cursor=pointer]'
              - 'button "c8: Empty" [ref=e141] [cursor=pointer]'
              - 'button "d8: Empty" [ref=e142] [cursor=pointer]'
              - 'button "e8: North green triangle" [ref=e143] [cursor=pointer]':
                - generic: ▲
              - 'button "f8: Empty" [ref=e144] [cursor=pointer]'
              - 'button "g8: Empty" [ref=e145] [cursor=pointer]'
              - 'button "h8: Empty" [ref=e146] [cursor=pointer]'
              - 'button "i8: Empty" [disabled] [ref=e147]'
              - generic [ref=e148]: "7"
              - 'button "a7: Empty" [ref=e149] [cursor=pointer]'
              - 'button "b7: Empty" [ref=e150] [cursor=pointer]'
              - 'button "c7: Empty" [ref=e151] [cursor=pointer]'
              - 'button "d7: Empty" [ref=e152] [cursor=pointer]'
              - 'button "e7: Empty" [ref=e153] [cursor=pointer]'
              - 'button "f7: Empty" [ref=e154] [cursor=pointer]'
              - 'button "g7: Empty" [ref=e155] [cursor=pointer]'
              - 'button "h7: Empty" [ref=e156] [cursor=pointer]'
              - 'button "i7: Empty" [disabled] [ref=e157]'
              - generic [ref=e158]: "6"
              - 'button "a6: Empty" [ref=e159] [cursor=pointer]'
              - 'button "b6: Empty" [ref=e160] [cursor=pointer]'
              - 'button "c6: Empty" [ref=e161] [cursor=pointer]'
              - 'button "d6: Empty" [ref=e162] [cursor=pointer]'
              - 'button "e6: Empty" [ref=e163] [cursor=pointer]'
              - 'button "f6: Empty" [ref=e164] [cursor=pointer]'
              - 'button "g6: Empty" [ref=e165] [cursor=pointer]'
              - 'button "h6: Empty" [ref=e166] [cursor=pointer]'
              - 'button "i6: East black square" [disabled] [ref=e167]':
                - generic: ■
              - generic [ref=e168]: "5"
              - 'button "a5: Empty" [ref=e169] [cursor=pointer]'
              - 'button "b5: Empty" [ref=e170] [cursor=pointer]'
              - 'button "c5: Empty" [ref=e171] [cursor=pointer]'
              - 'button "d5: Empty" [ref=e172] [cursor=pointer]'
              - 'button "e5: Central hill" [ref=e173] [cursor=pointer]':
                - generic: ◎
              - 'button "f5: Empty" [ref=e174] [cursor=pointer]'
              - 'button "g5: Empty" [ref=e175] [cursor=pointer]'
              - 'button "h5: Empty" [ref=e176] [cursor=pointer]'
              - 'button "i5: Empty" [disabled] [ref=e177]'
              - generic [ref=e178]: "4"
              - 'button "a4: West gold diamond" [ref=e179] [cursor=pointer]':
                - generic: ◆
              - 'button "b4: Empty" [ref=e180] [cursor=pointer]'
              - 'button "c4: Empty" [ref=e181] [cursor=pointer]'
              - 'button "d4: Empty" [ref=e182] [cursor=pointer]'
              - 'button "e4: Empty" [ref=e183] [cursor=pointer]'
              - 'button "f4: Empty" [ref=e184] [cursor=pointer]'
              - 'button "g4: Empty" [ref=e185] [cursor=pointer]'
              - 'button "h4: Empty" [ref=e186] [cursor=pointer]'
              - 'button "i4: Empty" [disabled] [ref=e187]'
              - generic [ref=e188]: "3"
              - 'button "a3: Empty" [ref=e189] [cursor=pointer]'
              - 'button "b3: Empty" [ref=e190] [cursor=pointer]'
              - 'button "c3: Empty" [ref=e191] [cursor=pointer]'
              - 'button "d3: Empty" [ref=e192] [cursor=pointer]'
              - 'button "e3: Empty" [ref=e193] [cursor=pointer]'
              - 'button "f3: Empty" [ref=e194] [cursor=pointer]'
              - 'button "g3: Empty" [ref=e195] [cursor=pointer]'
              - 'button "h3: Empty" [ref=e196] [cursor=pointer]'
              - 'button "i3: Empty" [disabled] [ref=e197]'
              - generic [ref=e198]: "2"
              - 'button "a2: Empty" [ref=e199] [cursor=pointer]'
              - 'button "b2: Empty" [ref=e200] [cursor=pointer]'
              - 'button "c2: Empty" [ref=e201] [cursor=pointer]'
              - 'button "d2: Empty" [ref=e202] [cursor=pointer]'
              - 'button "e2: South red circle" [ref=e203] [cursor=pointer]':
                - generic: ●
              - 'button "f2: Empty" [ref=e204] [cursor=pointer]'
              - 'button "g2: Empty" [ref=e205] [cursor=pointer]'
              - 'button "h2: Empty" [ref=e206] [cursor=pointer]'
              - 'button "i2: Empty" [disabled] [ref=e207]'
              - generic [ref=e208]: "1"
              - 'button "a1: Empty" [ref=e209] [cursor=pointer]'
              - 'button "b1: Empty" [ref=e210] [cursor=pointer]'
              - 'button "c1: Empty" [ref=e211] [cursor=pointer]'
              - 'button "d1: Empty" [ref=e212] [cursor=pointer]'
              - 'button "e1: Empty" [ref=e213] [cursor=pointer]'
              - 'button "f1: Empty" [ref=e214] [cursor=pointer]'
              - 'button "g1: Empty" [ref=e215] [cursor=pointer]'
              - 'button "h1: Empty" [ref=e216] [cursor=pointer]'
              - 'button "i1: Empty" [disabled] [ref=e217]'
            - generic [ref=e218]:
              - paragraph [ref=e219]: Preview a wall at a coordinate
              - button "Preview a wall at a coordinate" [active] [ref=e220] [cursor=pointer]:
                - paragraph [ref=e221]: "d4: Between d4–d5 and e4–e5."
                - img [ref=e223]
            - generic [ref=e225]:
              - button "Place wall" [ref=e226] [cursor=pointer]:
                - paragraph [ref=e229]: Place wall
              - button "Cancel" [ref=e230] [cursor=pointer]:
                - paragraph [ref=e233]: Cancel
            - status [ref=e234]: Between d4–d5 and e4–e5. Proposed wall. Choose Place wall to confirm, or Cancel.
          - status [ref=e236]:
            - generic [ref=e237]:
              - generic [ref=e238]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
              - text: Your turn. First to e5 wins.
        - generic [ref=e241]:
          - group "Game actions" [ref=e242]:
            - button "Offer draw" [ref=e243] [cursor=pointer]:
              - paragraph [ref=e246]: Offer draw
            - button "Resign game" [ref=e247] [cursor=pointer]:
              - paragraph [ref=e250]:
                - text: Resign
                - generic [ref=e251]: game
          - button "History and stats" [ref=e252] [cursor=pointer]:
            - generic [ref=e254]:
              - paragraph [ref=e255]: History and stats
              - img [ref=e258]
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