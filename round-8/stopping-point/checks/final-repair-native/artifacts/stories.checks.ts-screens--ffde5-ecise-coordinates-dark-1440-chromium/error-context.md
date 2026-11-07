# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-classic--precise-coordinates dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/precise-coordinates-dark-1440.png.
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
          - heading "Classic Quoridor" [level=1] [ref=e97]
          - generic [ref=e99]:
            - generic [ref=e100]: Unrated
            - generic [ref=e101]: ·Untimed
        - generic [ref=e103]:
          - generic [ref=e105]:
            - generic [ref=e107]:
              - generic [ref=e112]:
                - img "North gold diamond" [ref=e113]:
                  - generic [ref=e114]: ◆
                - generic "jordan_plays" [ref=e117]
              - generic [ref=e118]:
                - generic [ref=e119]: Walls
                - generic [ref=e120]: "9"
            - generic [ref=e122]:
              - group "Quoridor board, nine columns and nine rows" [ref=e123]:
                - generic [ref=e125]: a
                - generic [ref=e126]: b
                - generic [ref=e127]: c
                - generic [ref=e128]: d
                - generic [ref=e129]: e
                - generic [ref=e130]: f
                - generic [ref=e131]: g
                - generic [ref=e132]: h
                - generic [ref=e133]: i
                - generic [ref=e134]: "9"
                - 'button "a9: Empty, goal edge" [disabled] [ref=e135]'
                - 'button "b9: Empty, goal edge" [disabled] [ref=e136]'
                - 'button "c9: Empty, goal edge" [disabled] [ref=e137]'
                - 'button "d9: Empty, goal edge" [disabled] [ref=e138]'
                - 'button "e9: North gold diamond, goal edge" [disabled] [ref=e139]':
                  - generic: ◆
                - 'button "f9: Empty, goal edge" [disabled] [ref=e140]'
                - 'button "g9: Empty, goal edge" [disabled] [ref=e141]'
                - 'button "h9: Empty, goal edge" [disabled] [ref=e142]'
                - 'button "i9: Empty, goal edge" [disabled] [ref=e143]'
                - generic [ref=e144]: "8"
                - 'button "a8: Empty" [ref=e145] [cursor=pointer]'
                - 'button "b8: Empty" [ref=e146] [cursor=pointer]'
                - 'button "c8: Empty" [ref=e147] [cursor=pointer]'
                - 'button "d8: Empty" [ref=e148] [cursor=pointer]'
                - 'button "e8: Empty" [ref=e149] [cursor=pointer]'
                - 'button "f8: Empty" [ref=e150] [cursor=pointer]'
                - 'button "g8: Empty" [ref=e151] [cursor=pointer]'
                - 'button "h8: Empty" [ref=e152] [cursor=pointer]'
                - 'button "i8: Empty" [disabled] [ref=e153]'
                - generic [ref=e154]: "7"
                - 'button "a7: Empty" [ref=e155] [cursor=pointer]'
                - 'button "b7: Empty" [ref=e156] [cursor=pointer]'
                - 'button "c7: Empty" [ref=e157] [cursor=pointer]'
                - 'button "d7: Empty" [ref=e158] [cursor=pointer]'
                - 'button "e7: Empty" [ref=e159] [cursor=pointer]'
                - 'button "f7: Empty" [ref=e160] [cursor=pointer]'
                - 'button "g7: Empty" [ref=e161] [cursor=pointer]'
                - 'button "h7: Empty" [ref=e162] [cursor=pointer]'
                - 'button "i7: Empty" [disabled] [ref=e163]'
                - generic [ref=e164]: "6"
                - 'button "a6: Empty" [ref=e165] [cursor=pointer]'
                - 'button "b6: Empty" [ref=e166] [cursor=pointer]'
                - 'button "c6: Empty" [ref=e167] [cursor=pointer]'
                - 'button "d6: Empty" [ref=e168] [cursor=pointer]'
                - 'button "e6: Empty" [ref=e169] [cursor=pointer]'
                - 'button "f6: Empty" [ref=e170] [cursor=pointer]'
                - 'button "g6: Empty" [ref=e171] [cursor=pointer]'
                - 'button "h6: Empty" [ref=e172] [cursor=pointer]'
                - 'button "i6: Empty" [disabled] [ref=e173]'
                - generic [ref=e174]: "5"
                - 'button "a5: Empty" [ref=e175] [cursor=pointer]'
                - 'button "b5: Empty" [ref=e176] [cursor=pointer]'
                - 'button "c5: Empty" [ref=e177] [cursor=pointer]'
                - 'button "d5: Empty, wall boundaries: bottom" [ref=e178] [cursor=pointer]'
                - 'button "e5: Empty, wall boundaries: bottom" [ref=e179] [cursor=pointer]'
                - 'button "f5: Empty" [ref=e180] [cursor=pointer]'
                - 'button "g5: Empty" [ref=e181] [cursor=pointer]'
                - 'button "h5: Empty" [ref=e182] [cursor=pointer]'
                - 'button "i5: Empty" [disabled] [ref=e183]'
                - generic [ref=e184]: "4"
                - 'button "a4: Empty" [ref=e185] [cursor=pointer]'
                - 'button "b4: Empty" [ref=e186] [cursor=pointer]'
                - 'button "c4: Empty" [ref=e187] [cursor=pointer]'
                - 'button "d4: Empty, wall boundaries: top" [ref=e188] [cursor=pointer]'
                - 'button "e4: Empty, wall boundaries: top" [ref=e189] [cursor=pointer]'
                - 'button "f4: Empty" [ref=e190] [cursor=pointer]'
                - 'button "g4: Empty" [ref=e191] [cursor=pointer]'
                - 'button "h4: Empty" [ref=e192] [cursor=pointer]'
                - 'button "i4: Empty" [disabled] [ref=e193]'
                - generic [ref=e194]: "3"
                - 'button "a3: Empty" [ref=e195] [cursor=pointer]'
                - 'button "b3: Empty" [ref=e196] [cursor=pointer]'
                - 'button "c3: Empty" [ref=e197] [cursor=pointer]'
                - 'button "d3: Empty" [ref=e198] [cursor=pointer]'
                - 'button "e3: Empty" [ref=e199] [cursor=pointer]'
                - 'button "f3: Empty" [ref=e200] [cursor=pointer]'
                - 'button "g3: Empty" [ref=e201] [cursor=pointer]'
                - 'button "h3: Empty" [ref=e202] [cursor=pointer]'
                - 'button "i3: Empty" [disabled] [ref=e203]'
                - generic [ref=e204]: "2"
                - 'button "a2: Empty" [ref=e205] [cursor=pointer]'
                - 'button "b2: Empty" [ref=e206] [cursor=pointer]'
                - 'button "c2: Empty" [ref=e207] [cursor=pointer]'
                - 'button "d2: Empty" [ref=e208] [cursor=pointer]'
                - 'button "e2: South red circle" [ref=e209] [cursor=pointer]':
                  - generic: ●
                - 'button "f2: Empty" [ref=e210] [cursor=pointer]'
                - 'button "g2: Empty" [ref=e211] [cursor=pointer]'
                - 'button "h2: Empty" [ref=e212] [cursor=pointer]'
                - 'button "i2: Empty" [disabled] [ref=e213]'
                - generic [ref=e214]: "1"
                - 'button "a1: Empty" [ref=e215] [cursor=pointer]'
                - 'button "b1: Empty" [ref=e216] [cursor=pointer]'
                - 'button "c1: Empty" [ref=e217] [cursor=pointer]'
                - 'button "d1: Empty" [ref=e218] [cursor=pointer]'
                - 'button "e1: Empty" [ref=e219] [cursor=pointer]'
                - 'button "f1: Empty" [ref=e220] [cursor=pointer]'
                - 'button "g1: Empty" [ref=e221] [cursor=pointer]'
                - 'button "h1: Empty" [ref=e222] [cursor=pointer]'
                - 'button "i1: Empty" [disabled] [ref=e223]'
              - generic [ref=e224]:
                - button "Move pawn" [ref=e225] [cursor=pointer]:
                  - paragraph [ref=e228]: Move
                - button "Horizontal wall" [pressed] [ref=e229] [cursor=pointer]:
                  - paragraph [ref=e232]: Horizontal wall
                - button "Vertical wall" [ref=e233] [cursor=pointer]:
                  - paragraph [ref=e236]: Vertical wall
              - button "Wall starts above a square" [ref=e238] [cursor=pointer]:
                - paragraph [ref=e239]: Choose wall anchor
                - img [ref=e241]
              - status [ref=e243]: "Tap a square: preview a wall above it."
            - status [ref=e245]:
              - generic [ref=e246]:
                - generic [ref=e247]: "South red circle: avery. North gold diamond: jordan_plays."
                - text: Your turn. Reach row 9.
            - generic [ref=e250]:
              - generic [ref=e255]:
                - img "South red circle" [ref=e256]:
                  - generic [ref=e257]: ●
                - generic "avery" [ref=e260]
                - generic [ref=e261]: Your move
              - generic [ref=e262]:
                - generic [ref=e263]: Walls
                - generic [ref=e264]: "10"
          - region "Game record" [ref=e267]:
            - generic [ref=e268]:
              - heading "Game record" [level=2] [ref=e270]
              - paragraph [ref=e271]: Your turn. Reach row 9.
            - paragraph [ref=e274]: Live
            - generic [ref=e276]:
              - group "Game actions" [ref=e277]:
                - button "Offer draw" [ref=e278] [cursor=pointer]:
                  - paragraph [ref=e281]: Offer draw
                - button "Resign game" [ref=e282] [cursor=pointer]:
                  - paragraph [ref=e285]:
                    - text: Resign
                    - generic [ref=e286]: game
              - button "History and stats" [ref=e287] [cursor=pointer]:
                - paragraph [ref=e290]: History and stats
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/precise-coordinates-dark-1440.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```