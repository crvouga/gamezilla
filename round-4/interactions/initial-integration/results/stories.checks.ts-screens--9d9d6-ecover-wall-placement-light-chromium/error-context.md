# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--recover-wall-placement light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "success"
Received: "error: custom-game-board-precise-target: expected [ 'outside initial viewport', …(3) ] to deeply equal []"

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
                - 'button "Move 1, South red circle: e5h" [ref=e36] [cursor=pointer]': e5h
          - button "All moves" [ref=e37] [cursor=pointer]:
            - img [ref=e41]
      - generic [ref=e43]:
        - generic [ref=e45]:
          - list "Players" [ref=e46]:
            - listitem [ref=e47]:
              - generic [ref=e52]:
                - generic [ref=e53]: jordan_plays
                - generic [ref=e54]:
                  - generic [ref=e56]: ◆
                  - generic [ref=e57]: Walls 5
                  - generic [ref=e59]: You
            - listitem [ref=e60]:
              - generic [ref=e64]:
                - generic [ref=e65]: avery
                - generic [ref=e66]:
                  - generic [ref=e68]: ●
                  - generic [ref=e69]: Walls 4
            - listitem [ref=e70]:
              - generic [ref=e74]:
                - generic [ref=e75]: morgan
                - generic [ref=e76]:
                  - generic [ref=e78]: ▲
                  - generic [ref=e79]: Walls 5
            - listitem [ref=e80]:
              - generic [ref=e84]:
                - generic [ref=e85]: robin_42
                - generic [ref=e86]:
                  - generic [ref=e88]: ■
                  - generic [ref=e89]: Walls 5
          - generic [ref=e91]:
            - generic [ref=e92]:
              - button "Move pawn" [pressed] [ref=e93] [cursor=pointer]:
                - paragraph [ref=e96]: Move pawn
              - button "Horizontal wall" [ref=e97] [cursor=pointer]:
                - paragraph [ref=e100]: Horizontal wall
              - button "Vertical wall" [ref=e101] [cursor=pointer]:
                - paragraph [ref=e104]: Vertical wall
            - group "Quoridor board, nine columns and nine rows" [ref=e105]:
              - generic [ref=e107]: a
              - generic [ref=e108]: b
              - generic [ref=e109]: c
              - generic [ref=e110]: d
              - generic [ref=e111]: e
              - generic [ref=e112]: f
              - generic [ref=e113]: g
              - generic [ref=e114]: h
              - generic [ref=e115]: i
              - generic [ref=e116]: "9"
              - 'button "a9: Empty" [disabled] [ref=e117]'
              - 'button "b9: Empty" [disabled] [ref=e118]'
              - 'button "c9: Empty" [disabled] [ref=e119]'
              - 'button "d9: Empty" [disabled] [ref=e120]'
              - 'button "e9: North green triangle" [disabled] [ref=e121]':
                - generic: ▲
              - 'button "f9: Empty" [disabled] [ref=e122]'
              - 'button "g9: Empty" [disabled] [ref=e123]'
              - 'button "h9: Empty" [disabled] [ref=e124]'
              - 'button "i9: Empty" [disabled] [ref=e125]'
              - generic [ref=e126]: "8"
              - 'button "a8: Empty" [disabled] [ref=e127]'
              - 'button "b8: Empty" [disabled] [ref=e128]'
              - 'button "c8: Empty" [disabled] [ref=e129]'
              - 'button "d8: Empty" [disabled] [ref=e130]'
              - 'button "e8: Empty" [disabled] [ref=e131]'
              - 'button "f8: Empty" [disabled] [ref=e132]'
              - 'button "g8: Empty" [disabled] [ref=e133]'
              - 'button "h8: Empty" [disabled] [ref=e134]'
              - 'button "i8: Empty" [disabled] [ref=e135]'
              - generic [ref=e136]: "7"
              - 'button "a7: Empty" [disabled] [ref=e137]'
              - 'button "b7: Empty" [disabled] [ref=e138]'
              - 'button "c7: Empty" [disabled] [ref=e139]'
              - 'button "d7: Empty" [disabled] [ref=e140]'
              - 'button "e7: Empty" [disabled] [ref=e141]'
              - 'button "f7: Empty" [disabled] [ref=e142]'
              - 'button "g7: Empty" [disabled] [ref=e143]'
              - 'button "h7: Empty" [disabled] [ref=e144]'
              - 'button "i7: Empty" [disabled] [ref=e145]'
              - generic [ref=e146]: "6"
              - 'button "a6: Empty, legal move" [ref=e147] [cursor=pointer]':
                - generic: ·
              - 'button "b6: Empty" [disabled] [ref=e148]'
              - 'button "c6: Empty" [disabled] [ref=e149]'
              - 'button "d6: Empty" [disabled] [ref=e150]'
              - 'button "e6: Empty, wall boundaries: bottom" [disabled] [ref=e151]'
              - 'button "f6: Empty, wall boundaries: bottom" [disabled] [ref=e152]'
              - 'button "g6: Empty" [disabled] [ref=e153]'
              - 'button "h6: Empty" [disabled] [ref=e154]'
              - 'button "i6: Empty" [disabled] [ref=e155]'
              - generic [ref=e156]: "5"
              - 'button "a5: West gold diamond" [disabled] [ref=e157]':
                - generic: ◆
              - 'button "b5: Empty, legal move" [ref=e158] [cursor=pointer]':
                - generic: ·
              - 'button "c5: Empty" [disabled] [ref=e159]'
              - 'button "d5: Empty" [disabled] [ref=e160]'
              - 'button "e5: Central hill, wall boundaries: top" [disabled] [ref=e161]':
                - generic: ◎
              - 'button "f5: Empty, wall boundaries: top" [disabled] [ref=e162]'
              - 'button "g5: Empty" [disabled] [ref=e163]'
              - 'button "h5: Empty" [disabled] [ref=e164]'
              - 'button "i5: East black square" [disabled] [ref=e165]':
                - generic: ■
              - generic [ref=e166]: "4"
              - 'button "a4: Empty, legal move" [ref=e167] [cursor=pointer]':
                - generic: ·
              - 'button "b4: Empty" [disabled] [ref=e168]'
              - 'button "c4: Empty" [disabled] [ref=e169]'
              - 'button "d4: Empty" [disabled] [ref=e170]'
              - 'button "e4: Empty" [disabled] [ref=e171]'
              - 'button "f4: Empty" [disabled] [ref=e172]'
              - 'button "g4: Empty" [disabled] [ref=e173]'
              - 'button "h4: Empty" [disabled] [ref=e174]'
              - 'button "i4: Empty" [disabled] [ref=e175]'
              - generic [ref=e176]: "3"
              - 'button "a3: Empty" [disabled] [ref=e177]'
              - 'button "b3: Empty" [disabled] [ref=e178]'
              - 'button "c3: Empty" [disabled] [ref=e179]'
              - 'button "d3: Empty" [disabled] [ref=e180]'
              - 'button "e3: Empty" [disabled] [ref=e181]'
              - 'button "f3: Empty" [disabled] [ref=e182]'
              - 'button "g3: Empty" [disabled] [ref=e183]'
              - 'button "h3: Empty" [disabled] [ref=e184]'
              - 'button "i3: Empty" [disabled] [ref=e185]'
              - generic [ref=e186]: "2"
              - 'button "a2: Empty" [disabled] [ref=e187]'
              - 'button "b2: Empty" [disabled] [ref=e188]'
              - 'button "c2: Empty" [disabled] [ref=e189]'
              - 'button "d2: Empty" [disabled] [ref=e190]'
              - 'button "e2: Empty" [disabled] [ref=e191]'
              - 'button "f2: Empty" [disabled] [ref=e192]'
              - 'button "g2: Empty" [disabled] [ref=e193]'
              - 'button "h2: Empty" [disabled] [ref=e194]'
              - 'button "i2: Empty" [disabled] [ref=e195]'
              - generic [ref=e196]: "1"
              - 'button "a1: Empty" [disabled] [ref=e197]'
              - 'button "b1: Empty" [disabled] [ref=e198]'
              - 'button "c1: Empty" [disabled] [ref=e199]'
              - 'button "d1: Empty" [disabled] [ref=e200]'
              - 'button "e1: South red circle" [disabled] [ref=e201]':
                - generic: ●
              - 'button "f1: Empty" [disabled] [ref=e202]'
              - 'button "g1: Empty" [disabled] [ref=e203]'
              - 'button "h1: Empty" [disabled] [ref=e204]'
              - 'button "i1: Empty" [disabled] [ref=e205]'
            - generic [ref=e206]:
              - paragraph [ref=e207]: Move to a coordinate
              - button "Move to a coordinate" [ref=e208] [cursor=pointer]:
                - paragraph [ref=e209]: Select…
                - img [ref=e211]
            - status [ref=e213]: Choose a marked square to move your pawn.
          - status [ref=e215]:
            - generic [ref=e216]:
              - generic [ref=e217]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
              - text: Your turn. First to e5 wins.
        - generic [ref=e220]:
          - group "Game actions" [ref=e221]:
            - button "Offer draw" [ref=e222] [cursor=pointer]:
              - paragraph [ref=e225]: Offer draw
            - button "Resign game" [ref=e226] [cursor=pointer]:
              - paragraph [ref=e229]:
                - text: Resign
                - generic [ref=e230]: game
          - button "History and stats" [ref=e231] [cursor=pointer]:
            - generic [ref=e233]:
              - paragraph [ref=e234]: History and stats
              - img [ref=e237]
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