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
        - paragraph [ref=e24]: Your turn. Reach the center hill (e5) first.
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
          - list "Players" [ref=e59]:
            - generic "avery" [ref=e60]:
              - listitem [ref=e61]:
                - generic [ref=e64]:
                  - generic [ref=e65]: avery
                  - generic [ref=e66]:
                    - generic [ref=e68]: ●
                    - generic [ref=e69]: Walls 5
                    - generic [ref=e71]: You
            - generic "jordan_plays" [ref=e72]:
              - listitem [ref=e73]:
                - generic [ref=e75]:
                  - generic [ref=e76]: jordan_plays
                  - generic [ref=e77]:
                    - generic [ref=e79]: ◆
                    - generic [ref=e80]: Walls 5
            - generic "morgan" [ref=e81]:
              - listitem [ref=e82]:
                - generic [ref=e84]:
                  - generic [ref=e85]: morgan
                  - generic [ref=e86]:
                    - generic [ref=e88]: ▲
                    - generic [ref=e89]: Walls 5
            - generic "robin_42" [ref=e90]:
              - listitem [ref=e91]:
                - generic [ref=e93]:
                  - generic [ref=e94]: robin_42
                  - generic [ref=e95]:
                    - generic [ref=e97]: ■
                    - generic [ref=e98]: Walls 5
          - generic [ref=e100]:
            - generic [ref=e101]:
              - button "Move pawn" [pressed] [ref=e102] [cursor=pointer]:
                - paragraph [ref=e105]: Move pawn
              - button "Horizontal wall" [ref=e106] [cursor=pointer]:
                - paragraph [ref=e109]: Horizontal wall
              - button "Vertical wall" [ref=e110] [cursor=pointer]:
                - paragraph [ref=e113]: Vertical wall
            - group "Quoridor board, nine columns and nine rows" [ref=e114]:
              - generic [ref=e116]: a
              - generic [ref=e117]: b
              - generic [ref=e118]: c
              - generic [ref=e119]: d
              - generic [ref=e120]: e
              - generic [ref=e121]: f
              - generic [ref=e122]: g
              - generic [ref=e123]: h
              - generic [ref=e124]: i
              - generic [ref=e125]: "9"
              - 'button "a9: Empty" [disabled] [ref=e126]'
              - 'button "b9: Empty" [disabled] [ref=e127]'
              - 'button "c9: Empty" [disabled] [ref=e128]'
              - 'button "d9: Empty" [disabled] [ref=e129]'
              - 'button "e9: Empty" [disabled] [ref=e130]'
              - 'button "f9: Empty" [disabled] [ref=e131]'
              - 'button "g9: Empty" [disabled] [ref=e132]'
              - 'button "h9: Empty" [disabled] [ref=e133]'
              - 'button "i9: Empty" [disabled] [ref=e134]'
              - generic [ref=e135]: "8"
              - 'button "a8: Empty" [disabled] [ref=e136]'
              - 'button "b8: Empty" [disabled] [ref=e137]'
              - 'button "c8: Empty" [disabled] [ref=e138]'
              - 'button "d8: Empty" [disabled] [ref=e139]'
              - 'button "e8: North green triangle" [disabled] [ref=e140]':
                - generic: ▲
              - 'button "f8: Empty" [disabled] [ref=e141]'
              - 'button "g8: Empty" [disabled] [ref=e142]'
              - 'button "h8: Empty" [disabled] [ref=e143]'
              - 'button "i8: Empty" [disabled] [ref=e144]'
              - generic [ref=e145]: "7"
              - 'button "a7: Empty" [disabled] [ref=e146]'
              - 'button "b7: Empty" [disabled] [ref=e147]'
              - 'button "c7: Empty" [disabled] [ref=e148]'
              - 'button "d7: Empty" [disabled] [ref=e149]'
              - 'button "e7: Empty" [disabled] [ref=e150]'
              - 'button "f7: Empty" [disabled] [ref=e151]'
              - 'button "g7: Empty" [disabled] [ref=e152]'
              - 'button "h7: Empty" [disabled] [ref=e153]'
              - 'button "i7: Empty" [disabled] [ref=e154]'
              - generic [ref=e155]: "6"
              - 'button "a6: Empty" [disabled] [ref=e156]'
              - 'button "b6: Empty" [disabled] [ref=e157]'
              - 'button "c6: Empty" [disabled] [ref=e158]'
              - 'button "d6: Empty" [disabled] [ref=e159]'
              - 'button "e6: Empty" [disabled] [ref=e160]'
              - 'button "f6: Empty" [disabled] [ref=e161]'
              - 'button "g6: Empty" [disabled] [ref=e162]'
              - 'button "h6: Empty" [disabled] [ref=e163]'
              - 'button "i6: East black square" [disabled] [ref=e164]':
                - generic: ■
              - generic [ref=e165]: "5"
              - 'button "a5: Empty" [disabled] [ref=e166]'
              - 'button "b5: Empty" [disabled] [ref=e167]'
              - 'button "c5: Empty" [disabled] [ref=e168]'
              - 'button "d5: Empty" [disabled] [ref=e169]'
              - 'button "e5: Central hill, center goal" [disabled] [ref=e170]':
                - generic: ★
              - 'button "f5: Empty" [disabled] [ref=e171]'
              - 'button "g5: Empty" [disabled] [ref=e172]'
              - 'button "h5: Empty" [disabled] [ref=e173]'
              - 'button "i5: Empty" [disabled] [ref=e174]'
              - generic [ref=e175]: "4"
              - 'button "a4: West gold diamond" [disabled] [ref=e176]':
                - generic: ◆
              - 'button "b4: Empty" [disabled] [ref=e177]'
              - 'button "c4: Empty" [disabled] [ref=e178]'
              - 'button "d4: Empty" [disabled] [ref=e179]'
              - 'button "e4: Empty" [disabled] [ref=e180]'
              - 'button "f4: Empty" [disabled] [ref=e181]'
              - 'button "g4: Empty" [disabled] [ref=e182]'
              - 'button "h4: Empty" [disabled] [ref=e183]'
              - 'button "i4: Empty" [disabled] [ref=e184]'
              - generic [ref=e185]: "3"
              - 'button "a3: Empty" [disabled] [ref=e186]'
              - 'button "b3: Empty" [disabled] [ref=e187]'
              - 'button "c3: Empty" [disabled] [ref=e188]'
              - 'button "d3: Empty" [disabled] [ref=e189]'
              - 'button "e3: Empty, legal move" [ref=e190] [cursor=pointer]':
                - generic: ·
              - 'button "f3: Empty" [disabled] [ref=e191]'
              - 'button "g3: Empty" [disabled] [ref=e192]'
              - 'button "h3: Empty" [disabled] [ref=e193]'
              - 'button "i3: Empty" [disabled] [ref=e194]'
              - generic [ref=e195]: "2"
              - 'button "a2: Empty" [disabled] [ref=e196]'
              - 'button "b2: Empty" [disabled] [ref=e197]'
              - 'button "c2: Empty" [disabled] [ref=e198]'
              - 'button "d2: Empty, legal move" [ref=e199] [cursor=pointer]':
                - generic: ·
              - 'button "e2: South red circle" [disabled] [ref=e200]':
                - generic: ●
              - 'button "f2: Empty, legal move" [ref=e201] [cursor=pointer]':
                - generic: ·
              - 'button "g2: Empty" [disabled] [ref=e202]'
              - 'button "h2: Empty" [disabled] [ref=e203]'
              - 'button "i2: Empty" [disabled] [ref=e204]'
              - generic [ref=e205]: "1"
              - 'button "a1: Empty" [disabled] [ref=e206]'
              - 'button "b1: Empty" [disabled] [ref=e207]'
              - 'button "c1: Empty" [disabled] [ref=e208]'
              - 'button "d1: Empty" [disabled] [ref=e209]'
              - 'button "e1: Empty, legal move" [ref=e210] [cursor=pointer]':
                - generic: ·
              - 'button "f1: Empty" [disabled] [ref=e211]'
              - 'button "g1: Empty" [disabled] [ref=e212]'
              - 'button "h1: Empty" [disabled] [ref=e213]'
              - 'button "i1: Empty" [disabled] [ref=e214]'
            - generic [ref=e215]:
              - paragraph [ref=e216]: Move to a coordinate
              - button "Move to a coordinate" [ref=e217] [cursor=pointer]:
                - paragraph [ref=e218]: Select…
                - img [ref=e220]
            - status [ref=e222]: Move to a marked square.
          - status [ref=e224]:
            - generic [ref=e225]:
              - generic [ref=e226]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
              - text: Your turn. Reach the center hill (e5) first.
        - generic [ref=e229]:
          - group "Game actions" [ref=e230]:
            - button "Offer draw" [ref=e231] [cursor=pointer]:
              - paragraph [ref=e234]: Offer draw
            - button "Resign game" [ref=e235] [cursor=pointer]:
              - paragraph [ref=e238]:
                - text: Resign
                - generic [ref=e239]: game
          - button "History and stats" [ref=e240] [cursor=pointer]:
            - generic [ref=e242]:
              - paragraph [ref=e243]: History and stats
              - img [ref=e246]
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