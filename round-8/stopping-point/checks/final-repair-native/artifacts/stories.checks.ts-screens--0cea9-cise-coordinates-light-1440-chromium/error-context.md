# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--precise-coordinates light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/precise-coordinates-light-1440.png.
```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e9]:
    - generic [ref=e11]:
      - img "Unnamed App" [ref=e13]:
        - img [ref=e14]
        - generic [ref=e15]: Unnamed App
      - navigation "Navigation" [ref=e16]:
        - button "Spaces" [ref=e17] [cursor=pointer]:
          - img [ref=e19]
          - generic [ref=e21]: Spaces
        - button "Search" [ref=e22] [cursor=pointer]:
          - img [ref=e24]
          - generic [ref=e27]: Search
        - button "Notifications" [ref=e28] [cursor=pointer]:
          - img [ref=e30]
          - generic [ref=e33]: Notifications
        - button "Profile" [ref=e34] [cursor=pointer]:
          - img [ref=e36]
          - generic [ref=e39]: Profile
      - button "@avery, account menu" [ref=e43] [cursor=pointer]:
        - generic [ref=e46]: "@avery"
    - generic [ref=e50]:
      - generic [ref=e52]:
        - navigation "Breadcrumb" [ref=e55]:
          - list [ref=e56]:
            - listitem [ref=e57]:
              - generic [ref=e58]:
                - generic [ref=e59]: F
                - generic [ref=e60]: Friday game night
        - generic [ref=e63]:
          - button "People in this space" [ref=e65] [cursor=pointer]:
            - img [ref=e69]
          - button "Minimize space" [ref=e75] [cursor=pointer]:
            - img [ref=e79]
          - button "More" [ref=e83] [cursor=pointer]:
            - img [ref=e86]
      - generic [ref=e93]:
        - generic [ref=e94]:
          - 'heading "Quoridor: King of the Hill" [level=1] [ref=e97]'
          - generic [ref=e99]:
            - generic [ref=e100]: Unrated
            - generic [ref=e101]: ·Untimed
        - generic [ref=e103]:
          - generic [ref=e105]:
            - list "Other players" [ref=e107]:
              - generic "avery" [ref=e108]:
                - listitem [ref=e109]:
                  - generic [ref=e113]:
                    - generic [ref=e114]: avery
                    - generic [ref=e115]:
                      - generic [ref=e117]: ●
                      - generic [ref=e118]: Walls 4
              - generic "morgan" [ref=e119]:
                - listitem [ref=e120]:
                  - generic [ref=e124]:
                    - generic [ref=e125]: morgan
                    - generic [ref=e126]:
                      - generic [ref=e128]: ▲
                      - generic [ref=e129]: Walls 5
              - generic "robin_42" [ref=e130]:
                - listitem [ref=e131]:
                  - generic [ref=e135]:
                    - generic [ref=e136]: robin_42
                    - generic [ref=e137]:
                      - generic [ref=e139]: ■
                      - generic [ref=e140]: Walls 5
            - generic [ref=e142]:
              - group "Quoridor board, nine columns and nine rows" [ref=e143]:
                - generic [ref=e145]: a
                - generic [ref=e146]: b
                - generic [ref=e147]: c
                - generic [ref=e148]: d
                - generic [ref=e149]: e
                - generic [ref=e150]: f
                - generic [ref=e151]: g
                - generic [ref=e152]: h
                - generic [ref=e153]: i
                - generic [ref=e154]: "9"
                - 'button "a9: Empty" [disabled] [ref=e155]'
                - 'button "b9: Empty" [disabled] [ref=e156]'
                - 'button "c9: Empty" [disabled] [ref=e157]'
                - 'button "d9: Empty" [disabled] [ref=e158]'
                - 'button "e9: Empty" [disabled] [ref=e159]'
                - 'button "f9: Empty" [disabled] [ref=e160]'
                - 'button "g9: Empty" [disabled] [ref=e161]'
                - 'button "h9: Empty" [disabled] [ref=e162]'
                - 'button "i9: Empty" [disabled] [ref=e163]'
                - generic [ref=e164]: "8"
                - 'button "a8: Empty" [ref=e165] [cursor=pointer]'
                - 'button "b8: Empty" [ref=e166] [cursor=pointer]'
                - 'button "c8: Empty" [ref=e167] [cursor=pointer]'
                - 'button "d8: Empty" [ref=e168] [cursor=pointer]'
                - 'button "e8: North green triangle" [ref=e169] [cursor=pointer]':
                  - generic: ▲
                - 'button "f8: Empty" [ref=e170] [cursor=pointer]'
                - 'button "g8: Empty" [ref=e171] [cursor=pointer]'
                - 'button "h8: Empty" [ref=e172] [cursor=pointer]'
                - 'button "i8: Empty" [disabled] [ref=e173]'
                - generic [ref=e174]: "7"
                - 'button "a7: Empty" [ref=e175] [cursor=pointer]'
                - 'button "b7: Empty" [ref=e176] [cursor=pointer]'
                - 'button "c7: Empty" [ref=e177] [cursor=pointer]'
                - 'button "d7: Empty" [ref=e178] [cursor=pointer]'
                - 'button "e7: Empty" [ref=e179] [cursor=pointer]'
                - 'button "f7: Empty" [ref=e180] [cursor=pointer]'
                - 'button "g7: Empty" [ref=e181] [cursor=pointer]'
                - 'button "h7: Empty" [ref=e182] [cursor=pointer]'
                - 'button "i7: Empty" [disabled] [ref=e183]'
                - generic [ref=e184]: "6"
                - 'button "a6: Empty" [ref=e185] [cursor=pointer]'
                - 'button "b6: Empty" [ref=e186] [cursor=pointer]'
                - 'button "c6: Empty" [ref=e187] [cursor=pointer]'
                - 'button "d6: Empty" [ref=e188] [cursor=pointer]'
                - 'button "e6: Empty" [ref=e189] [cursor=pointer]'
                - 'button "f6: Empty" [ref=e190] [cursor=pointer]'
                - 'button "g6: Empty" [ref=e191] [cursor=pointer]'
                - 'button "h6: Empty" [ref=e192] [cursor=pointer]'
                - 'button "i6: East black square" [disabled] [ref=e193]':
                  - generic: ■
                - generic [ref=e194]: "5"
                - 'button "a5: Empty" [ref=e195] [cursor=pointer]'
                - 'button "b5: Empty" [ref=e196] [cursor=pointer]'
                - 'button "c5: Empty" [ref=e197] [cursor=pointer]'
                - 'button "d5: Empty, wall boundaries: bottom" [ref=e198] [cursor=pointer]'
                - 'button "e5: Central hill, center goal, wall boundaries: bottom" [ref=e199] [cursor=pointer]':
                  - generic: ★
                - 'button "f5: Empty" [ref=e200] [cursor=pointer]'
                - 'button "g5: Empty" [ref=e201] [cursor=pointer]'
                - 'button "h5: Empty" [ref=e202] [cursor=pointer]'
                - 'button "i5: Empty" [disabled] [ref=e203]'
                - generic [ref=e204]: "4"
                - 'button "a4: West gold diamond" [ref=e205] [cursor=pointer]':
                  - generic: ◆
                - 'button "b4: Empty" [ref=e206] [cursor=pointer]'
                - 'button "c4: Empty" [ref=e207] [cursor=pointer]'
                - 'button "d4: Empty, wall boundaries: top" [ref=e208] [cursor=pointer]'
                - 'button "e4: Empty, wall boundaries: top" [ref=e209] [cursor=pointer]'
                - 'button "f4: Empty" [ref=e210] [cursor=pointer]'
                - 'button "g4: Empty" [ref=e211] [cursor=pointer]'
                - 'button "h4: Empty" [ref=e212] [cursor=pointer]'
                - 'button "i4: Empty" [disabled] [ref=e213]'
                - generic [ref=e214]: "3"
                - 'button "a3: Empty" [ref=e215] [cursor=pointer]'
                - 'button "b3: Empty" [ref=e216] [cursor=pointer]'
                - 'button "c3: Empty" [ref=e217] [cursor=pointer]'
                - 'button "d3: Empty" [ref=e218] [cursor=pointer]'
                - 'button "e3: Empty" [ref=e219] [cursor=pointer]'
                - 'button "f3: Empty" [ref=e220] [cursor=pointer]'
                - 'button "g3: Empty" [ref=e221] [cursor=pointer]'
                - 'button "h3: Empty" [ref=e222] [cursor=pointer]'
                - 'button "i3: Empty" [disabled] [ref=e223]'
                - generic [ref=e224]: "2"
                - 'button "a2: Empty" [ref=e225] [cursor=pointer]'
                - 'button "b2: Empty" [ref=e226] [cursor=pointer]'
                - 'button "c2: Empty" [ref=e227] [cursor=pointer]'
                - 'button "d2: Empty" [ref=e228] [cursor=pointer]'
                - 'button "e2: South red circle" [ref=e229] [cursor=pointer]':
                  - generic: ●
                - 'button "f2: Empty" [ref=e230] [cursor=pointer]'
                - 'button "g2: Empty" [ref=e231] [cursor=pointer]'
                - 'button "h2: Empty" [ref=e232] [cursor=pointer]'
                - 'button "i2: Empty" [disabled] [ref=e233]'
                - generic [ref=e234]: "1"
                - 'button "a1: Empty" [ref=e235] [cursor=pointer]'
                - 'button "b1: Empty" [ref=e236] [cursor=pointer]'
                - 'button "c1: Empty" [ref=e237] [cursor=pointer]'
                - 'button "d1: Empty" [ref=e238] [cursor=pointer]'
                - 'button "e1: Empty" [ref=e239] [cursor=pointer]'
                - 'button "f1: Empty" [ref=e240] [cursor=pointer]'
                - 'button "g1: Empty" [ref=e241] [cursor=pointer]'
                - 'button "h1: Empty" [ref=e242] [cursor=pointer]'
                - 'button "i1: Empty" [disabled] [ref=e243]'
              - generic [ref=e244]:
                - button "Move pawn" [ref=e245] [cursor=pointer]:
                  - paragraph [ref=e248]: Move
                - button "Horizontal wall" [pressed] [ref=e249] [cursor=pointer]:
                  - paragraph [ref=e252]: Horizontal wall
                - button "Vertical wall" [ref=e253] [cursor=pointer]:
                  - paragraph [ref=e256]: Vertical wall
              - button "Wall starts above a square" [ref=e258] [cursor=pointer]:
                - paragraph [ref=e259]: Choose wall anchor
                - img [ref=e261]
              - status [ref=e263]: "Tap a square: preview a wall above it."
            - status [ref=e265]:
              - generic [ref=e266]:
                - generic [ref=e267]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
                - text: Your turn. Reach the center hill (e5) first.
            - generic [ref=e270]:
              - generic [ref=e275]:
                - img "West gold diamond" [ref=e276]:
                  - generic [ref=e277]: ◆
                - generic "jordan_plays" [ref=e280]
                - generic [ref=e281]: Your move
              - generic [ref=e282]:
                - generic [ref=e283]: Walls
                - generic [ref=e284]: "5"
          - region "Game record" [ref=e286]:
            - generic [ref=e287]:
              - heading "Game record" [level=2] [ref=e289]
              - paragraph [ref=e290]: Your turn. Reach the center hill (e5) first.
            - paragraph [ref=e293]: Live
            - generic [ref=e294]:
              - list "Moves played" [ref=e296]:
                - listitem [ref=e297]:
                  - generic [ref=e298]: "1"
                  - generic [ref=e299]:
                    - generic [ref=e301]: ●
                    - 'button "Move 1, South red circle: e2" [ref=e302] [cursor=pointer]': e2
                  - generic [ref=e303]:
                    - generic [ref=e305]: ◆
                    - 'button "Move 2, West gold diamond: a4" [ref=e306] [cursor=pointer]': a4
                  - generic [ref=e307]:
                    - generic [ref=e309]: ▲
                    - 'button "Move 3, North green triangle: e8" [ref=e310] [cursor=pointer]': e8
                  - generic [ref=e311]:
                    - generic [ref=e313]: ■
                    - 'button "Move 4, East black square: i6" [ref=e314] [cursor=pointer]': i6
                - listitem [ref=e315]:
                  - generic [ref=e316]: "2"
                  - generic [ref=e317]:
                    - generic [ref=e319]: ●
                    - 'button "Move 5, South red circle: d4h" [ref=e320] [cursor=pointer]': d4h
              - generic [ref=e321]:
                - generic [ref=e322]:
                  - button "Go to the start" [ref=e323] [cursor=pointer]:
                    - img [ref=e326]
                  - button "Previous move" [ref=e329] [cursor=pointer]:
                    - img [ref=e332]
                  - button "Next move" [disabled] [ref=e334]:
                    - img [ref=e337]
                  - button "Return to current position" [ref=e339] [cursor=pointer]:
                    - img [ref=e342]
                - button "Go to move" [ref=e345] [cursor=pointer]:
                  - generic [ref=e347]:
                    - paragraph [ref=e348]: Go to move
                    - img [ref=e351]
            - generic [ref=e354]:
              - group "Game actions" [ref=e355]:
                - button "Offer draw" [ref=e356] [cursor=pointer]:
                  - paragraph [ref=e359]: Offer draw
                - button "Resign game" [ref=e360] [cursor=pointer]:
                  - paragraph [ref=e363]:
                    - text: Resign
                    - generic [ref=e364]: game
              - button "History and stats" [ref=e365] [cursor=pointer]:
                - paragraph [ref=e368]: History and stats
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/precise-coordinates-light-1440.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```