# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--recover-wall-placement light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  28432 pixels (ratio 0.09 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/recover-wall-placement-light.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/recover-wall-placement-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 28432 pixels (ratio 0.09 of all image pixels) are different.
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
  - 28432 pixels (ratio 0.09 of all image pixels) are different.

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
              - generic [ref=e37]:
                - generic [ref=e39]: ◆
                - 'button "Move 2, West gold diamond: a1h" [ref=e40] [cursor=pointer]': a1h
          - button "All moves" [ref=e41] [cursor=pointer]:
            - img [ref=e45]
      - generic [ref=e47]:
        - generic [ref=e49]:
          - list "Players" [ref=e50]:
            - listitem [ref=e51]:
              - generic [ref=e56]:
                - generic [ref=e57]: morgan
                - generic [ref=e58]:
                  - generic [ref=e60]: ▲
                  - generic [ref=e61]: Walls 5
                  - generic [ref=e63]: You
            - listitem [ref=e64]:
              - generic [ref=e68]:
                - generic [ref=e69]: avery
                - generic [ref=e70]:
                  - generic [ref=e72]: ●
                  - generic [ref=e73]: Walls 4
            - listitem [ref=e74]:
              - generic [ref=e78]:
                - generic [ref=e79]: jordan_plays
                - generic [ref=e80]:
                  - generic [ref=e82]: ◆
                  - generic [ref=e83]: Walls 4
            - listitem [ref=e84]:
              - generic [ref=e88]:
                - generic [ref=e89]: robin_42
                - generic [ref=e90]:
                  - generic [ref=e92]: ■
                  - generic [ref=e93]: Walls 5
          - generic [ref=e95]:
            - generic [ref=e96]:
              - button "Move pawn" [pressed] [ref=e97] [cursor=pointer]:
                - paragraph [ref=e100]: Move pawn
              - button "Horizontal wall" [ref=e101] [cursor=pointer]:
                - paragraph [ref=e104]: Wall across
              - button "Vertical wall" [ref=e105] [cursor=pointer]:
                - paragraph [ref=e108]: Wall down
            - group "Quoridor board, nine columns and nine rows" [ref=e109]:
              - generic [ref=e111]: a
              - generic [ref=e112]: b
              - generic [ref=e113]: c
              - generic [ref=e114]: d
              - generic [ref=e115]: e
              - generic [ref=e116]: f
              - generic [ref=e117]: g
              - generic [ref=e118]: h
              - generic [ref=e119]: i
              - generic [ref=e120]: "9"
              - 'button "a9: Empty" [disabled] [ref=e121]'
              - 'button "b9: Empty" [disabled] [ref=e122]'
              - 'button "c9: Empty" [disabled] [ref=e123]'
              - 'button "d9: Empty, legal move" [ref=e124] [cursor=pointer]':
                - generic: ·
              - 'button "e9: North green triangle" [disabled] [ref=e125]':
                - generic: ▲
              - 'button "f9: Empty, legal move" [ref=e126] [cursor=pointer]':
                - generic: ·
              - 'button "g9: Empty" [disabled] [ref=e127]'
              - 'button "h9: Empty" [disabled] [ref=e128]'
              - 'button "i9: Empty" [disabled] [ref=e129]'
              - generic [ref=e130]: "8"
              - 'button "a8: Empty" [disabled] [ref=e131]'
              - 'button "b8: Empty" [disabled] [ref=e132]'
              - 'button "c8: Empty" [disabled] [ref=e133]'
              - 'button "d8: Empty" [disabled] [ref=e134]'
              - 'button "e8: Empty, legal move" [ref=e135] [cursor=pointer]':
                - generic: ·
              - 'button "f8: Empty" [disabled] [ref=e136]'
              - 'button "g8: Empty" [disabled] [ref=e137]'
              - 'button "h8: Empty" [disabled] [ref=e138]'
              - 'button "i8: Empty" [disabled] [ref=e139]'
              - generic [ref=e140]: "7"
              - 'button "a7: Empty" [disabled] [ref=e141]'
              - 'button "b7: Empty" [disabled] [ref=e142]'
              - 'button "c7: Empty" [disabled] [ref=e143]'
              - 'button "d7: Empty" [disabled] [ref=e144]'
              - 'button "e7: Empty" [disabled] [ref=e145]'
              - 'button "f7: Empty" [disabled] [ref=e146]'
              - 'button "g7: Empty" [disabled] [ref=e147]'
              - 'button "h7: Empty" [disabled] [ref=e148]'
              - 'button "i7: Empty" [disabled] [ref=e149]'
              - generic [ref=e150]: "6"
              - 'button "a6: Empty" [disabled] [ref=e151]'
              - 'button "b6: Empty" [disabled] [ref=e152]'
              - 'button "c6: Empty" [disabled] [ref=e153]'
              - 'button "d6: Empty" [disabled] [ref=e154]'
              - 'button "e6: Empty, wall boundaries: bottom" [disabled] [ref=e155]'
              - 'button "f6: Empty, wall boundaries: bottom" [disabled] [ref=e156]'
              - 'button "g6: Empty" [disabled] [ref=e157]'
              - 'button "h6: Empty" [disabled] [ref=e158]'
              - 'button "i6: Empty" [disabled] [ref=e159]'
              - generic [ref=e160]: "5"
              - 'button "a5: West gold diamond" [disabled] [ref=e161]':
                - generic: ◆
              - 'button "b5: Empty" [disabled] [ref=e162]'
              - 'button "c5: Empty" [disabled] [ref=e163]'
              - 'button "d5: Empty" [disabled] [ref=e164]'
              - 'button "e5: Central hill, wall boundaries: top" [disabled] [ref=e165]':
                - generic: ◎
              - 'button "f5: Empty, wall boundaries: top" [disabled] [ref=e166]'
              - 'button "g5: Empty" [disabled] [ref=e167]'
              - 'button "h5: Empty" [disabled] [ref=e168]'
              - 'button "i5: East black square" [disabled] [ref=e169]':
                - generic: ■
              - generic [ref=e170]: "4"
              - 'button "a4: Empty" [disabled] [ref=e171]'
              - 'button "b4: Empty" [disabled] [ref=e172]'
              - 'button "c4: Empty" [disabled] [ref=e173]'
              - 'button "d4: Empty" [disabled] [ref=e174]'
              - 'button "e4: Empty" [disabled] [ref=e175]'
              - 'button "f4: Empty" [disabled] [ref=e176]'
              - 'button "g4: Empty" [disabled] [ref=e177]'
              - 'button "h4: Empty" [disabled] [ref=e178]'
              - 'button "i4: Empty" [disabled] [ref=e179]'
              - generic [ref=e180]: "3"
              - 'button "a3: Empty" [disabled] [ref=e181]'
              - 'button "b3: Empty" [disabled] [ref=e182]'
              - 'button "c3: Empty" [disabled] [ref=e183]'
              - 'button "d3: Empty" [disabled] [ref=e184]'
              - 'button "e3: Empty" [disabled] [ref=e185]'
              - 'button "f3: Empty" [disabled] [ref=e186]'
              - 'button "g3: Empty" [disabled] [ref=e187]'
              - 'button "h3: Empty" [disabled] [ref=e188]'
              - 'button "i3: Empty" [disabled] [ref=e189]'
              - generic [ref=e190]: "2"
              - 'button "a2: Empty, wall boundaries: bottom" [disabled] [ref=e191]'
              - 'button "b2: Empty, wall boundaries: bottom" [disabled] [ref=e192]'
              - 'button "c2: Empty" [disabled] [ref=e193]'
              - 'button "d2: Empty" [disabled] [ref=e194]'
              - 'button "e2: Empty" [disabled] [ref=e195]'
              - 'button "f2: Empty" [disabled] [ref=e196]'
              - 'button "g2: Empty" [disabled] [ref=e197]'
              - 'button "h2: Empty" [disabled] [ref=e198]'
              - 'button "i2: Empty" [disabled] [ref=e199]'
              - generic [ref=e200]: "1"
              - 'button "a1: Empty, wall boundaries: top" [disabled] [ref=e201]'
              - 'button "b1: Empty, wall boundaries: top" [disabled] [ref=e202]'
              - 'button "c1: Empty" [disabled] [ref=e203]'
              - 'button "d1: Empty" [disabled] [ref=e204]'
              - 'button "e1: South red circle" [disabled] [ref=e205]':
                - generic: ●
              - 'button "f1: Empty" [disabled] [ref=e206]'
              - 'button "g1: Empty" [disabled] [ref=e207]'
              - 'button "h1: Empty" [disabled] [ref=e208]'
              - 'button "i1: Empty" [disabled] [ref=e209]'
            - generic [ref=e210]:
              - paragraph [ref=e211]: Move to a coordinate
              - button "Move to a coordinate" [ref=e212] [cursor=pointer]:
                - paragraph [ref=e213]: Select…
                - img [ref=e215]
            - status [ref=e217]: Choose a marked square to move your pawn.
          - status [ref=e219]:
            - generic [ref=e220]:
              - generic [ref=e221]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
              - text: Your turn. First to e5 wins.
        - generic [ref=e224]:
          - group "Game actions" [ref=e225]:
            - button "Offer draw" [ref=e226] [cursor=pointer]:
              - paragraph [ref=e229]: Offer draw
            - button "Resign game" [ref=e230] [cursor=pointer]:
              - paragraph [ref=e233]:
                - text: Resign
                - generic [ref=e234]: game
          - button "History and stats" [ref=e235] [cursor=pointer]:
            - generic [ref=e237]:
              - paragraph [ref=e238]: History and stats
              - img [ref=e241]
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