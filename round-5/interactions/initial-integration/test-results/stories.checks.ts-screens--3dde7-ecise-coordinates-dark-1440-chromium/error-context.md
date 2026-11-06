# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--precise-coordinates dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/precise-coordinates-dark-1440.png.
```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e15]:
    - generic [ref=e16]:
      - 'heading "Quoridor: King of the Hill" [level=1] [ref=e19]'
      - generic [ref=e21]:
        - generic [ref=e22]: Unrated
        - generic [ref=e23]: ·Untimed
    - generic [ref=e25]:
      - generic [ref=e27]:
        - list "Other players" [ref=e29]:
          - generic "avery" [ref=e30]:
            - listitem [ref=e31]:
              - generic [ref=e35]:
                - generic [ref=e36]: avery
                - generic [ref=e37]:
                  - generic [ref=e39]: ●
                  - generic [ref=e40]: Walls 4
          - generic "morgan" [ref=e41]:
            - listitem [ref=e42]:
              - generic [ref=e46]:
                - generic [ref=e47]: morgan
                - generic [ref=e48]:
                  - generic [ref=e50]: ▲
                  - generic [ref=e51]: Walls 5
          - generic "robin_42" [ref=e52]:
            - listitem [ref=e53]:
              - generic [ref=e57]:
                - generic [ref=e58]: robin_42
                - generic [ref=e59]:
                  - generic [ref=e61]: ■
                  - generic [ref=e62]: Walls 5
        - generic [ref=e64]:
          - generic [ref=e65]:
            - button "Move pawn" [ref=e66] [cursor=pointer]:
              - paragraph [ref=e69]: Move pawn
            - button "Horizontal wall" [pressed] [ref=e70] [cursor=pointer]:
              - paragraph [ref=e73]: Horizontal wall
            - button "Vertical wall" [ref=e74] [cursor=pointer]:
              - paragraph [ref=e77]: Vertical wall
          - group "Quoridor board, nine columns and nine rows" [ref=e78]:
            - generic [ref=e80]: a
            - generic [ref=e81]: b
            - generic [ref=e82]: c
            - generic [ref=e83]: d
            - generic [ref=e84]: e
            - generic [ref=e85]: f
            - generic [ref=e86]: g
            - generic [ref=e87]: h
            - generic [ref=e88]: i
            - generic [ref=e89]: "9"
            - 'button "a9: Empty" [disabled] [ref=e90]'
            - 'button "b9: Empty" [disabled] [ref=e91]'
            - 'button "c9: Empty" [disabled] [ref=e92]'
            - 'button "d9: Empty" [disabled] [ref=e93]'
            - 'button "e9: Empty" [disabled] [ref=e94]'
            - 'button "f9: Empty" [disabled] [ref=e95]'
            - 'button "g9: Empty" [disabled] [ref=e96]'
            - 'button "h9: Empty" [disabled] [ref=e97]'
            - 'button "i9: Empty" [disabled] [ref=e98]'
            - generic [ref=e99]: "8"
            - 'button "a8: Empty" [ref=e100] [cursor=pointer]'
            - 'button "b8: Empty" [ref=e101] [cursor=pointer]'
            - 'button "c8: Empty" [ref=e102] [cursor=pointer]'
            - 'button "d8: Empty" [ref=e103] [cursor=pointer]'
            - 'button "e8: North green triangle" [ref=e104] [cursor=pointer]':
              - generic: ▲
            - 'button "f8: Empty" [ref=e105] [cursor=pointer]'
            - 'button "g8: Empty" [ref=e106] [cursor=pointer]'
            - 'button "h8: Empty" [ref=e107] [cursor=pointer]'
            - 'button "i8: Empty" [disabled] [ref=e108]'
            - generic [ref=e109]: "7"
            - 'button "a7: Empty" [ref=e110] [cursor=pointer]'
            - 'button "b7: Empty" [ref=e111] [cursor=pointer]'
            - 'button "c7: Empty" [ref=e112] [cursor=pointer]'
            - 'button "d7: Empty" [ref=e113] [cursor=pointer]'
            - 'button "e7: Empty" [ref=e114] [cursor=pointer]'
            - 'button "f7: Empty" [ref=e115] [cursor=pointer]'
            - 'button "g7: Empty" [ref=e116] [cursor=pointer]'
            - 'button "h7: Empty" [ref=e117] [cursor=pointer]'
            - 'button "i7: Empty" [disabled] [ref=e118]'
            - generic [ref=e119]: "6"
            - 'button "a6: Empty" [ref=e120] [cursor=pointer]'
            - 'button "b6: Empty" [ref=e121] [cursor=pointer]'
            - 'button "c6: Empty" [ref=e122] [cursor=pointer]'
            - 'button "d6: Empty" [ref=e123] [cursor=pointer]'
            - 'button "e6: Empty" [ref=e124] [cursor=pointer]'
            - 'button "f6: Empty" [ref=e125] [cursor=pointer]'
            - 'button "g6: Empty" [ref=e126] [cursor=pointer]'
            - 'button "h6: Empty" [ref=e127] [cursor=pointer]'
            - 'button "i6: East black square" [disabled] [ref=e128]':
              - generic: ■
            - generic [ref=e129]: "5"
            - 'button "a5: Empty" [ref=e130] [cursor=pointer]'
            - 'button "b5: Empty" [ref=e131] [cursor=pointer]'
            - 'button "c5: Empty" [ref=e132] [cursor=pointer]'
            - 'button "d5: Empty, wall boundaries: bottom" [ref=e133] [cursor=pointer]'
            - 'button "e5: Central hill, center goal, wall boundaries: bottom" [ref=e134] [cursor=pointer]':
              - generic: ★
            - 'button "f5: Empty" [ref=e135] [cursor=pointer]'
            - 'button "g5: Empty" [ref=e136] [cursor=pointer]'
            - 'button "h5: Empty" [ref=e137] [cursor=pointer]'
            - 'button "i5: Empty" [disabled] [ref=e138]'
            - generic [ref=e139]: "4"
            - 'button "a4: West gold diamond" [ref=e140] [cursor=pointer]':
              - generic: ◆
            - 'button "b4: Empty" [ref=e141] [cursor=pointer]'
            - 'button "c4: Empty" [ref=e142] [cursor=pointer]'
            - 'button "d4: Empty, wall boundaries: top" [ref=e143] [cursor=pointer]'
            - 'button "e4: Empty, wall boundaries: top" [ref=e144] [cursor=pointer]'
            - 'button "f4: Empty" [ref=e145] [cursor=pointer]'
            - 'button "g4: Empty" [ref=e146] [cursor=pointer]'
            - 'button "h4: Empty" [ref=e147] [cursor=pointer]'
            - 'button "i4: Empty" [disabled] [ref=e148]'
            - generic [ref=e149]: "3"
            - 'button "a3: Empty" [ref=e150] [cursor=pointer]'
            - 'button "b3: Empty" [ref=e151] [cursor=pointer]'
            - 'button "c3: Empty" [ref=e152] [cursor=pointer]'
            - 'button "d3: Empty" [ref=e153] [cursor=pointer]'
            - 'button "e3: Empty" [ref=e154] [cursor=pointer]'
            - 'button "f3: Empty" [ref=e155] [cursor=pointer]'
            - 'button "g3: Empty" [ref=e156] [cursor=pointer]'
            - 'button "h3: Empty" [ref=e157] [cursor=pointer]'
            - 'button "i3: Empty" [disabled] [ref=e158]'
            - generic [ref=e159]: "2"
            - 'button "a2: Empty" [ref=e160] [cursor=pointer]'
            - 'button "b2: Empty" [ref=e161] [cursor=pointer]'
            - 'button "c2: Empty" [ref=e162] [cursor=pointer]'
            - 'button "d2: Empty" [ref=e163] [cursor=pointer]'
            - 'button "e2: South red circle" [ref=e164] [cursor=pointer]':
              - generic: ●
            - 'button "f2: Empty" [ref=e165] [cursor=pointer]'
            - 'button "g2: Empty" [ref=e166] [cursor=pointer]'
            - 'button "h2: Empty" [ref=e167] [cursor=pointer]'
            - 'button "i2: Empty" [disabled] [ref=e168]'
            - generic [ref=e169]: "1"
            - 'button "a1: Empty" [ref=e170] [cursor=pointer]'
            - 'button "b1: Empty" [ref=e171] [cursor=pointer]'
            - 'button "c1: Empty" [ref=e172] [cursor=pointer]'
            - 'button "d1: Empty" [ref=e173] [cursor=pointer]'
            - 'button "e1: Empty" [ref=e174] [cursor=pointer]'
            - 'button "f1: Empty" [ref=e175] [cursor=pointer]'
            - 'button "g1: Empty" [ref=e176] [cursor=pointer]'
            - 'button "h1: Empty" [ref=e177] [cursor=pointer]'
            - 'button "i1: Empty" [disabled] [ref=e178]'
          - generic [ref=e179]:
            - paragraph [ref=e180]: Wall anchor
            - button "Wall anchor" [ref=e181] [cursor=pointer]:
              - paragraph [ref=e182]: Select…
              - img [ref=e184]
          - status [ref=e186]: "Tap a square: preview a wall above it."
        - status [ref=e188]:
          - generic [ref=e189]:
            - generic [ref=e190]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
            - text: Your turn. Reach the center hill (e5) first.
        - generic [ref=e193]:
          - generic [ref=e198]:
            - img "West gold diamond" [ref=e199]:
              - generic [ref=e200]: ◆
            - generic "jordan_plays" [ref=e203]
            - generic [ref=e204]: Your move
          - generic [ref=e205]:
            - generic [ref=e206]: Walls
            - generic [ref=e207]: "5"
      - region "Game record" [ref=e209]:
        - generic [ref=e210]:
          - heading "Game record" [level=2] [ref=e212]
          - paragraph [ref=e213]: Your turn. Reach the center hill (e5) first.
        - generic [ref=e214]:
          - list "Moves played" [ref=e216]:
            - listitem [ref=e217]:
              - generic [ref=e218]: "1"
              - generic [ref=e219]:
                - generic [ref=e221]: ●
                - 'button "Move 1, South red circle: e2" [ref=e222] [cursor=pointer]': e2
              - generic [ref=e223]:
                - generic [ref=e225]: ◆
                - 'button "Move 2, West gold diamond: a4" [ref=e226] [cursor=pointer]': a4
              - generic [ref=e227]:
                - generic [ref=e229]: ▲
                - 'button "Move 3, North green triangle: e8" [ref=e230] [cursor=pointer]': e8
              - generic [ref=e231]:
                - generic [ref=e233]: ■
                - 'button "Move 4, East black square: i6" [ref=e234] [cursor=pointer]': i6
            - listitem [ref=e235]:
              - generic [ref=e236]: "2"
              - generic [ref=e237]:
                - generic [ref=e239]: ●
                - 'button "Move 5, South red circle: d4h" [ref=e240] [cursor=pointer]': d4h
          - generic [ref=e241]:
            - generic [ref=e242]:
              - button "Go to the start" [ref=e243] [cursor=pointer]:
                - img [ref=e246]
              - button "Previous move" [ref=e249] [cursor=pointer]:
                - img [ref=e252]
              - button "Next move" [disabled] [ref=e254]:
                - img [ref=e257]
              - button "Return to current position" [ref=e259] [cursor=pointer]:
                - img [ref=e262]
            - button "Go to move" [ref=e265] [cursor=pointer]:
              - generic [ref=e267]:
                - paragraph [ref=e268]: Go to move
                - img [ref=e271]
        - generic [ref=e274]:
          - group "Game actions" [ref=e275]:
            - button "Offer draw" [ref=e276] [cursor=pointer]:
              - paragraph [ref=e279]: Offer draw
            - button "Resign game" [ref=e280] [cursor=pointer]:
              - paragraph [ref=e283]:
                - text: Resign
                - generic [ref=e284]: game
          - button "History and stats" [ref=e285] [cursor=pointer]:
            - paragraph [ref=e288]: History and stats
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/precise-coordinates-dark-1440.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```