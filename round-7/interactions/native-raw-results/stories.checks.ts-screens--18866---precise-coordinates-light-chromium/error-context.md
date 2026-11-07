# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--precise-coordinates light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/precise-coordinates-light.png.
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
              - generic [ref=e32]: Move 2
              - generic [ref=e33]:
                - generic [ref=e35]: ●
                - 'button "Move 5, South red circle: d4h" [ref=e36] [cursor=pointer]': d4h
          - button "All moves" [ref=e37] [cursor=pointer]:
            - img [ref=e41]
      - generic [ref=e43]:
        - generic [ref=e45]:
          - list "Players" [ref=e47]:
            - generic "jordan_plays" [ref=e48]:
              - listitem [ref=e49]:
                - generic [ref=e52]:
                  - generic [ref=e53]: jordan_plays
                  - generic [ref=e54]:
                    - generic [ref=e56]: ◆
                    - generic [ref=e57]: Walls 5
                    - generic [ref=e59]: You
            - generic "avery" [ref=e60]:
              - listitem [ref=e61]:
                - generic [ref=e63]:
                  - generic [ref=e64]: avery
                  - generic [ref=e65]:
                    - generic [ref=e67]: ●
                    - generic [ref=e68]: Walls 4
            - generic "morgan" [ref=e69]:
              - listitem [ref=e70]:
                - generic [ref=e72]:
                  - generic [ref=e73]: morgan
                  - generic [ref=e74]:
                    - generic [ref=e76]: ▲
                    - generic [ref=e77]: Walls 5
            - generic "robin_42" [ref=e78]:
              - listitem [ref=e79]:
                - generic [ref=e81]:
                  - generic [ref=e82]: robin_42
                  - generic [ref=e83]:
                    - generic [ref=e85]: ■
                    - generic [ref=e86]: Walls 5
          - generic [ref=e88]:
            - generic [ref=e89]:
              - button "Move pawn" [ref=e90] [cursor=pointer]:
                - paragraph [ref=e93]: Move
              - button "Horizontal wall" [pressed] [ref=e94] [cursor=pointer]:
                - paragraph [ref=e97]: Horizontal wall
              - button "Vertical wall" [ref=e98] [cursor=pointer]:
                - paragraph [ref=e101]: Vertical wall
            - group "Quoridor board, nine columns and nine rows" [ref=e102]:
              - generic [ref=e104]: a
              - generic [ref=e105]: b
              - generic [ref=e106]: c
              - generic [ref=e107]: d
              - generic [ref=e108]: e
              - generic [ref=e109]: f
              - generic [ref=e110]: g
              - generic [ref=e111]: h
              - generic [ref=e112]: i
              - generic [ref=e113]: "9"
              - 'button "a9: Empty" [disabled] [ref=e114]'
              - 'button "b9: Empty" [disabled] [ref=e115]'
              - 'button "c9: Empty" [disabled] [ref=e116]'
              - 'button "d9: Empty" [disabled] [ref=e117]'
              - 'button "e9: Empty" [disabled] [ref=e118]'
              - 'button "f9: Empty" [disabled] [ref=e119]'
              - 'button "g9: Empty" [disabled] [ref=e120]'
              - 'button "h9: Empty" [disabled] [ref=e121]'
              - 'button "i9: Empty" [disabled] [ref=e122]'
              - generic [ref=e123]: "8"
              - 'button "a8: Empty" [ref=e124] [cursor=pointer]'
              - 'button "b8: Empty" [ref=e125] [cursor=pointer]'
              - 'button "c8: Empty" [ref=e126] [cursor=pointer]'
              - 'button "d8: Empty" [ref=e127] [cursor=pointer]'
              - 'button "e8: North green triangle" [ref=e128] [cursor=pointer]':
                - generic: ▲
              - 'button "f8: Empty" [ref=e129] [cursor=pointer]'
              - 'button "g8: Empty" [ref=e130] [cursor=pointer]'
              - 'button "h8: Empty" [ref=e131] [cursor=pointer]'
              - 'button "i8: Empty" [disabled] [ref=e132]'
              - generic [ref=e133]: "7"
              - 'button "a7: Empty" [ref=e134] [cursor=pointer]'
              - 'button "b7: Empty" [ref=e135] [cursor=pointer]'
              - 'button "c7: Empty" [ref=e136] [cursor=pointer]'
              - 'button "d7: Empty" [ref=e137] [cursor=pointer]'
              - 'button "e7: Empty" [ref=e138] [cursor=pointer]'
              - 'button "f7: Empty" [ref=e139] [cursor=pointer]'
              - 'button "g7: Empty" [ref=e140] [cursor=pointer]'
              - 'button "h7: Empty" [ref=e141] [cursor=pointer]'
              - 'button "i7: Empty" [disabled] [ref=e142]'
              - generic [ref=e143]: "6"
              - 'button "a6: Empty" [ref=e144] [cursor=pointer]'
              - 'button "b6: Empty" [ref=e145] [cursor=pointer]'
              - 'button "c6: Empty" [ref=e146] [cursor=pointer]'
              - 'button "d6: Empty" [ref=e147] [cursor=pointer]'
              - 'button "e6: Empty" [ref=e148] [cursor=pointer]'
              - 'button "f6: Empty" [ref=e149] [cursor=pointer]'
              - 'button "g6: Empty" [ref=e150] [cursor=pointer]'
              - 'button "h6: Empty" [ref=e151] [cursor=pointer]'
              - 'button "i6: East black square" [disabled] [ref=e152]':
                - generic: ■
              - generic [ref=e153]: "5"
              - 'button "a5: Empty" [ref=e154] [cursor=pointer]'
              - 'button "b5: Empty" [ref=e155] [cursor=pointer]'
              - 'button "c5: Empty" [ref=e156] [cursor=pointer]'
              - 'button "d5: Empty, wall boundaries: bottom" [ref=e157] [cursor=pointer]'
              - 'button "e5: Central hill, center goal, wall boundaries: bottom" [ref=e158] [cursor=pointer]':
                - generic: ★
              - 'button "f5: Empty" [ref=e159] [cursor=pointer]'
              - 'button "g5: Empty" [ref=e160] [cursor=pointer]'
              - 'button "h5: Empty" [ref=e161] [cursor=pointer]'
              - 'button "i5: Empty" [disabled] [ref=e162]'
              - generic [ref=e163]: "4"
              - 'button "a4: West gold diamond" [ref=e164] [cursor=pointer]':
                - generic: ◆
              - 'button "b4: Empty" [ref=e165] [cursor=pointer]'
              - 'button "c4: Empty" [ref=e166] [cursor=pointer]'
              - 'button "d4: Empty, wall boundaries: top" [ref=e167] [cursor=pointer]'
              - 'button "e4: Empty, wall boundaries: top" [ref=e168] [cursor=pointer]'
              - 'button "f4: Empty" [ref=e169] [cursor=pointer]'
              - 'button "g4: Empty" [ref=e170] [cursor=pointer]'
              - 'button "h4: Empty" [ref=e171] [cursor=pointer]'
              - 'button "i4: Empty" [disabled] [ref=e172]'
              - generic [ref=e173]: "3"
              - 'button "a3: Empty" [ref=e174] [cursor=pointer]'
              - 'button "b3: Empty" [ref=e175] [cursor=pointer]'
              - 'button "c3: Empty" [ref=e176] [cursor=pointer]'
              - 'button "d3: Empty" [ref=e177] [cursor=pointer]'
              - 'button "e3: Empty" [ref=e178] [cursor=pointer]'
              - 'button "f3: Empty" [ref=e179] [cursor=pointer]'
              - 'button "g3: Empty" [ref=e180] [cursor=pointer]'
              - 'button "h3: Empty" [ref=e181] [cursor=pointer]'
              - 'button "i3: Empty" [disabled] [ref=e182]'
              - generic [ref=e183]: "2"
              - 'button "a2: Empty" [ref=e184] [cursor=pointer]'
              - 'button "b2: Empty" [ref=e185] [cursor=pointer]'
              - 'button "c2: Empty" [ref=e186] [cursor=pointer]'
              - 'button "d2: Empty" [ref=e187] [cursor=pointer]'
              - 'button "e2: South red circle" [ref=e188] [cursor=pointer]':
                - generic: ●
              - 'button "f2: Empty" [ref=e189] [cursor=pointer]'
              - 'button "g2: Empty" [ref=e190] [cursor=pointer]'
              - 'button "h2: Empty" [ref=e191] [cursor=pointer]'
              - 'button "i2: Empty" [disabled] [ref=e192]'
              - generic [ref=e193]: "1"
              - 'button "a1: Empty" [ref=e194] [cursor=pointer]'
              - 'button "b1: Empty" [ref=e195] [cursor=pointer]'
              - 'button "c1: Empty" [ref=e196] [cursor=pointer]'
              - 'button "d1: Empty" [ref=e197] [cursor=pointer]'
              - 'button "e1: Empty" [ref=e198] [cursor=pointer]'
              - 'button "f1: Empty" [ref=e199] [cursor=pointer]'
              - 'button "g1: Empty" [ref=e200] [cursor=pointer]'
              - 'button "h1: Empty" [ref=e201] [cursor=pointer]'
              - 'button "i1: Empty" [disabled] [ref=e202]'
            - generic [ref=e203]:
              - paragraph [ref=e204]: Wall anchor
              - button "Wall anchor" [ref=e205] [cursor=pointer]:
                - paragraph [ref=e206]: Select…
                - img [ref=e208]
            - status [ref=e210]: "Tap a square: preview a wall above it."
          - status [ref=e212]:
            - generic [ref=e213]:
              - generic [ref=e214]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
              - text: Your turn. Reach the center hill (e5) first.
        - generic [ref=e217]:
          - group "Game actions" [ref=e218]:
            - button "Offer draw" [ref=e219] [cursor=pointer]:
              - paragraph [ref=e222]: Offer draw
            - button "Resign game" [ref=e223] [cursor=pointer]:
              - paragraph [ref=e226]:
                - text: Resign
                - generic [ref=e227]: game
          - button "History and stats" [ref=e228] [cursor=pointer]:
            - generic [ref=e230]:
              - paragraph [ref=e231]: History and stats
              - img [ref=e234]
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/precise-coordinates-light.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```