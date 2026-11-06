# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--reach-the-hill light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  90054 pixels (ratio 0.08 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/reach-the-hill-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/reach-the-hill-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 90054 pixels (ratio 0.08 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - captured a stable screenshot
  - 90054 pixels (ratio 0.08 of all image pixels) are different.

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
    - generic [ref=e24]:
      - generic [ref=e26]:
        - heading "avery wins" [level=2] [ref=e28]
        - group "What next" [ref=e29]:
          - button "Rematch" [ref=e30] [cursor=pointer]:
            - paragraph [ref=e33]: Rematch
          - button "Change game" [ref=e34] [cursor=pointer]:
            - paragraph [ref=e37]: Change game
          - button "Review" [ref=e38] [cursor=pointer]:
            - paragraph [ref=e41]: Review
      - generic [ref=e42]:
        - generic [ref=e44]:
          - list "Other players" [ref=e46]:
            - generic "avery" [ref=e47]:
              - listitem [ref=e48]:
                - generic [ref=e52]:
                  - generic [ref=e53]: avery
                  - generic [ref=e54]:
                    - generic [ref=e56]: ●
                    - generic [ref=e57]: Walls 5
            - generic "morgan" [ref=e58]:
              - listitem [ref=e59]:
                - generic [ref=e63]:
                  - generic [ref=e64]: morgan
                  - generic [ref=e65]:
                    - generic [ref=e67]: ▲
                    - generic [ref=e68]: Walls 5
            - generic "robin_42" [ref=e69]:
              - listitem [ref=e70]:
                - generic [ref=e74]:
                  - generic [ref=e75]: robin_42
                  - generic [ref=e76]:
                    - generic [ref=e78]: ■
                    - generic [ref=e79]: Walls 5
          - generic [ref=e81]:
            - generic [ref=e82]:
              - button "Move pawn" [disabled] [pressed] [ref=e83]:
                - paragraph [ref=e86]: Move pawn
              - button "Horizontal wall" [disabled] [ref=e87]:
                - paragraph [ref=e90]: Horizontal wall
              - button "Vertical wall" [disabled] [ref=e91]:
                - paragraph [ref=e94]: Vertical wall
            - group "Quoridor board, nine columns and nine rows" [ref=e95]:
              - generic [ref=e97]: a
              - generic [ref=e98]: b
              - generic [ref=e99]: c
              - generic [ref=e100]: d
              - generic [ref=e101]: e
              - generic [ref=e102]: f
              - generic [ref=e103]: g
              - generic [ref=e104]: h
              - generic [ref=e105]: i
              - generic [ref=e106]: "9"
              - 'button "a9: Empty" [disabled] [ref=e107]'
              - 'button "b9: Empty" [disabled] [ref=e108]'
              - 'button "c9: Empty" [disabled] [ref=e109]'
              - 'button "d9: Empty" [disabled] [ref=e110]'
              - 'button "e9: Empty" [disabled] [ref=e111]'
              - 'button "f9: Empty" [disabled] [ref=e112]'
              - 'button "g9: Empty" [disabled] [ref=e113]'
              - 'button "h9: Empty" [disabled] [ref=e114]'
              - 'button "i9: Empty" [disabled] [ref=e115]'
              - generic [ref=e116]: "8"
              - 'button "a8: Empty" [disabled] [ref=e117]'
              - 'button "b8: Empty" [disabled] [ref=e118]'
              - 'button "c8: North green triangle" [disabled] [ref=e119]':
                - generic: ▲
              - 'button "d8: Empty" [disabled] [ref=e120]'
              - 'button "e8: Empty" [disabled] [ref=e121]'
              - 'button "f8: Empty" [disabled] [ref=e122]'
              - 'button "g8: Empty" [disabled] [ref=e123]'
              - 'button "h8: Empty" [disabled] [ref=e124]'
              - 'button "i8: East black square" [disabled] [ref=e125]':
                - generic: ■
              - generic [ref=e126]: "7"
              - 'button "a7: Empty" [disabled] [ref=e127]'
              - 'button "b7: Empty" [disabled] [ref=e128]'
              - 'button "c7: Empty" [disabled] [ref=e129]'
              - 'button "d7: Empty" [disabled] [ref=e130]'
              - 'button "e7: Empty" [disabled] [ref=e131]'
              - 'button "f7: Empty" [disabled] [ref=e132]'
              - 'button "g7: Empty" [disabled] [ref=e133]'
              - 'button "h7: Empty" [disabled] [ref=e134]'
              - 'button "i7: Empty" [disabled] [ref=e135]'
              - generic [ref=e136]: "6"
              - 'button "a6: Empty" [disabled] [ref=e137]'
              - 'button "b6: Empty" [disabled] [ref=e138]'
              - 'button "c6: Empty" [disabled] [ref=e139]'
              - 'button "d6: Empty" [disabled] [ref=e140]'
              - 'button "e6: Empty" [disabled] [ref=e141]'
              - 'button "f6: Empty" [disabled] [ref=e142]'
              - 'button "g6: Empty" [disabled] [ref=e143]'
              - 'button "h6: Empty" [disabled] [ref=e144]'
              - 'button "i6: Empty" [disabled] [ref=e145]'
              - generic [ref=e146]: "5"
              - 'button "a5: Empty" [disabled] [ref=e147]'
              - 'button "b5: Empty" [disabled] [ref=e148]'
              - 'button "c5: Empty" [disabled] [ref=e149]'
              - 'button "d5: Empty" [disabled] [ref=e150]'
              - 'button "e5: South red circle, center goal" [disabled] [ref=e151]':
                - generic: ●
              - 'button "f5: Empty" [disabled] [ref=e152]'
              - 'button "g5: Empty" [disabled] [ref=e153]'
              - 'button "h5: Empty" [disabled] [ref=e154]'
              - 'button "i5: Empty" [disabled] [ref=e155]'
              - generic [ref=e156]: "4"
              - 'button "a4: Empty" [disabled] [ref=e157]'
              - 'button "b4: Empty" [disabled] [ref=e158]'
              - 'button "c4: Empty" [disabled] [ref=e159]'
              - 'button "d4: Empty" [disabled] [ref=e160]'
              - 'button "e4: Empty" [disabled] [ref=e161]'
              - 'button "f4: Empty" [disabled] [ref=e162]'
              - 'button "g4: Empty" [disabled] [ref=e163]'
              - 'button "h4: Empty" [disabled] [ref=e164]'
              - 'button "i4: Empty" [disabled] [ref=e165]'
              - generic [ref=e166]: "3"
              - 'button "a3: Empty" [disabled] [ref=e167]'
              - 'button "b3: Empty" [disabled] [ref=e168]'
              - 'button "c3: Empty" [disabled] [ref=e169]'
              - 'button "d3: Empty" [disabled] [ref=e170]'
              - 'button "e3: Empty" [disabled] [ref=e171]'
              - 'button "f3: Empty" [disabled] [ref=e172]'
              - 'button "g3: Empty" [disabled] [ref=e173]'
              - 'button "h3: Empty" [disabled] [ref=e174]'
              - 'button "i3: Empty" [disabled] [ref=e175]'
              - generic [ref=e176]: "2"
              - 'button "a2: West gold diamond" [disabled] [ref=e177]':
                - generic: ◆
              - 'button "b2: Empty" [disabled] [ref=e178]'
              - 'button "c2: Empty" [disabled] [ref=e179]'
              - 'button "d2: Empty" [disabled] [ref=e180]'
              - 'button "e2: Empty" [disabled] [ref=e181]'
              - 'button "f2: Empty" [disabled] [ref=e182]'
              - 'button "g2: Empty" [disabled] [ref=e183]'
              - 'button "h2: Empty" [disabled] [ref=e184]'
              - 'button "i2: Empty" [disabled] [ref=e185]'
              - generic [ref=e186]: "1"
              - 'button "a1: Empty" [disabled] [ref=e187]'
              - 'button "b1: Empty" [disabled] [ref=e188]'
              - 'button "c1: Empty" [disabled] [ref=e189]'
              - 'button "d1: Empty" [disabled] [ref=e190]'
              - 'button "e1: Empty" [disabled] [ref=e191]'
              - 'button "f1: Empty" [disabled] [ref=e192]'
              - 'button "g1: Empty" [disabled] [ref=e193]'
              - 'button "h1: Empty" [disabled] [ref=e194]'
              - 'button "i1: Empty" [disabled] [ref=e195]'
            - status [ref=e196]: Game finished. Use the game controls to review earlier moves.
          - status [ref=e198]:
            - generic [ref=e199]:
              - generic [ref=e200]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
              - text: The central hill was reached. Game won.
          - generic [ref=e203]:
            - generic [ref=e208]:
              - img "West gold diamond" [ref=e209]:
                - generic [ref=e210]: ◆
              - generic "jordan_plays" [ref=e213]
            - generic [ref=e214]:
              - generic [ref=e215]: Walls
              - generic [ref=e216]: "5"
        - list "Standings" [ref=e219]:
          - listitem [ref=e220]:
            - generic [ref=e221]:
              - generic [ref=e222]: 1st
              - generic [ref=e225]: avery
          - listitem [ref=e226]:
            - generic [ref=e227]:
              - generic [ref=e228]: 2nd
              - generic [ref=e231]: jordan_plays
          - listitem [ref=e232]:
            - generic [ref=e233]:
              - generic [ref=e234]: 2nd
              - generic [ref=e237]: morgan
          - listitem [ref=e238]:
            - generic [ref=e239]:
              - generic [ref=e240]: 2nd
              - generic [ref=e243]: robin_42
        - region "Game record" [ref=e245]:
          - heading "Game record" [level=2] [ref=e248]
          - generic [ref=e249]:
            - list "Moves played" [ref=e251]:
              - listitem [ref=e252]:
                - generic [ref=e253]: "1"
                - generic [ref=e254]:
                  - generic [ref=e256]: ●
                  - 'button "Move 1, South red circle: e2" [ref=e257] [cursor=pointer]': e2
                - generic [ref=e258]:
                  - generic [ref=e260]: ◆
                  - 'button "Move 2, West gold diamond: a4" [ref=e261] [cursor=pointer]': a4
                - generic [ref=e262]:
                  - generic [ref=e264]: ▲
                  - 'button "Move 3, North green triangle: e8" [ref=e265] [cursor=pointer]': e8
                - generic [ref=e266]:
                  - generic [ref=e268]: ■
                  - 'button "Move 4, East black square: i6" [ref=e269] [cursor=pointer]': i6
              - listitem [ref=e270]:
                - generic [ref=e271]: "2"
                - generic [ref=e272]:
                  - generic [ref=e274]: ●
                  - 'button "Move 5, South red circle: e3" [ref=e275] [cursor=pointer]': e3
                - generic [ref=e276]:
                  - generic [ref=e278]: ◆
                  - 'button "Move 6, West gold diamond: a3" [ref=e279] [cursor=pointer]': a3
                - generic [ref=e280]:
                  - generic [ref=e282]: ▲
                  - 'button "Move 7, North green triangle: d8" [ref=e283] [cursor=pointer]': d8
                - generic [ref=e284]:
                  - generic [ref=e286]: ■
                  - 'button "Move 8, East black square: i7" [ref=e287] [cursor=pointer]': i7
              - listitem [ref=e288]:
                - generic [ref=e289]: "3"
                - generic [ref=e290]:
                  - generic [ref=e292]: ●
                  - 'button "Move 9, South red circle: e4" [ref=e293] [cursor=pointer]': e4
                - generic [ref=e294]:
                  - generic [ref=e296]: ◆
                  - 'button "Move 10, West gold diamond: a2" [ref=e297] [cursor=pointer]': a2
                - generic [ref=e298]:
                  - generic [ref=e300]: ▲
                  - 'button "Move 11, North green triangle: c8" [ref=e301] [cursor=pointer]': c8
                - generic [ref=e302]:
                  - generic [ref=e304]: ■
                  - 'button "Move 12, East black square: i8" [ref=e305] [cursor=pointer]': i8
              - listitem [ref=e306]:
                - generic [ref=e307]: "4"
                - generic [ref=e308]:
                  - generic [ref=e310]: ●
                  - 'button "Move 13, South red circle: e5" [ref=e311] [cursor=pointer]': e5
            - generic [ref=e312]:
              - generic [ref=e313]:
                - button "Go to the start" [ref=e314] [cursor=pointer]:
                  - img [ref=e317]
                - button "Previous move" [ref=e320] [cursor=pointer]:
                  - img [ref=e323]
                - button "Next move" [disabled] [ref=e325]:
                  - img [ref=e328]
                - button "Return to current position" [ref=e330] [cursor=pointer]:
                  - img [ref=e333]
              - button "Go to move" [ref=e336] [cursor=pointer]:
                - generic [ref=e338]:
                  - paragraph [ref=e339]: Go to move
                  - img [ref=e342]
          - button "History and stats" [ref=e346] [cursor=pointer]:
            - paragraph [ref=e349]: History and stats
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
     |                                                 ^ Error: expect(locator).toHaveScreenshot(expected) failed
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```