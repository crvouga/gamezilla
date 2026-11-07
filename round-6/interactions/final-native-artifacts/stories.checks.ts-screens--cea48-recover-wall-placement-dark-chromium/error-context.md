# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--recover-wall-placement dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  40084 pixels (ratio 0.13 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/recover-wall-placement-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/recover-wall-placement-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 40084 pixels (ratio 0.13 of all image pixels) are different.
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
  - 40084 pixels (ratio 0.13 of all image pixels) are different.

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
                - 'button "Move 1, South red circle: e5h" [ref=e36] [cursor=pointer]': e5h
              - generic [ref=e37]:
                - generic [ref=e39]: ◆
                - 'button "Move 2, West gold diamond: a1h" [ref=e40] [cursor=pointer]': a1h
          - button "All moves" [ref=e41] [cursor=pointer]:
            - img [ref=e45]
      - generic [ref=e47]:
        - generic [ref=e49]:
          - list "Players" [ref=e51]:
            - generic "morgan" [ref=e52]:
              - listitem [ref=e53]:
                - generic [ref=e56]:
                  - generic [ref=e57]: morgan
                  - generic [ref=e58]:
                    - generic [ref=e60]: ▲
                    - generic [ref=e61]: Walls 5
                    - generic [ref=e63]: You
            - generic "avery" [ref=e64]:
              - listitem [ref=e65]:
                - generic [ref=e67]:
                  - generic [ref=e68]: avery
                  - generic [ref=e69]:
                    - generic [ref=e71]: ●
                    - generic [ref=e72]: Walls 4
            - generic "jordan_plays" [ref=e73]:
              - listitem [ref=e74]:
                - generic [ref=e76]:
                  - generic [ref=e77]: jordan_plays
                  - generic [ref=e78]:
                    - generic [ref=e80]: ◆
                    - generic [ref=e81]: Walls 4
            - generic "robin_42" [ref=e82]:
              - listitem [ref=e83]:
                - generic [ref=e85]:
                  - generic [ref=e86]: robin_42
                  - generic [ref=e87]:
                    - generic [ref=e89]: ■
                    - generic [ref=e90]: Walls 5
          - generic [ref=e92]:
            - generic [ref=e93]:
              - button "Move pawn" [pressed] [ref=e94] [cursor=pointer]:
                - paragraph [ref=e97]: Move
              - button "Horizontal wall" [ref=e98] [cursor=pointer]:
                - paragraph [ref=e101]: Horizontal wall
              - button "Vertical wall" [ref=e102] [cursor=pointer]:
                - paragraph [ref=e105]: Vertical wall
            - group "Quoridor board, nine columns and nine rows" [ref=e106]:
              - generic [ref=e108]: a
              - generic [ref=e109]: b
              - generic [ref=e110]: c
              - generic [ref=e111]: d
              - generic [ref=e112]: e
              - generic [ref=e113]: f
              - generic [ref=e114]: g
              - generic [ref=e115]: h
              - generic [ref=e116]: i
              - generic [ref=e117]: "9"
              - 'button "a9: Empty" [disabled] [ref=e118]'
              - 'button "b9: Empty" [disabled] [ref=e119]'
              - 'button "c9: Empty" [disabled] [ref=e120]'
              - 'button "d9: Empty, legal move" [ref=e121] [cursor=pointer]':
                - generic: ·
              - 'button "e9: North green triangle" [disabled] [ref=e122]':
                - generic: ▲
              - 'button "f9: Empty, legal move" [ref=e123] [cursor=pointer]':
                - generic: ·
              - 'button "g9: Empty" [disabled] [ref=e124]'
              - 'button "h9: Empty" [disabled] [ref=e125]'
              - 'button "i9: Empty" [disabled] [ref=e126]'
              - generic [ref=e127]: "8"
              - 'button "a8: Empty" [disabled] [ref=e128]'
              - 'button "b8: Empty" [disabled] [ref=e129]'
              - 'button "c8: Empty" [disabled] [ref=e130]'
              - 'button "d8: Empty" [disabled] [ref=e131]'
              - 'button "e8: Empty, legal move" [ref=e132] [cursor=pointer]':
                - generic: ·
              - 'button "f8: Empty" [disabled] [ref=e133]'
              - 'button "g8: Empty" [disabled] [ref=e134]'
              - 'button "h8: Empty" [disabled] [ref=e135]'
              - 'button "i8: Empty" [disabled] [ref=e136]'
              - generic [ref=e137]: "7"
              - 'button "a7: Empty" [disabled] [ref=e138]'
              - 'button "b7: Empty" [disabled] [ref=e139]'
              - 'button "c7: Empty" [disabled] [ref=e140]'
              - 'button "d7: Empty" [disabled] [ref=e141]'
              - 'button "e7: Empty" [disabled] [ref=e142]'
              - 'button "f7: Empty" [disabled] [ref=e143]'
              - 'button "g7: Empty" [disabled] [ref=e144]'
              - 'button "h7: Empty" [disabled] [ref=e145]'
              - 'button "i7: Empty" [disabled] [ref=e146]'
              - generic [ref=e147]: "6"
              - 'button "a6: Empty" [disabled] [ref=e148]'
              - 'button "b6: Empty" [disabled] [ref=e149]'
              - 'button "c6: Empty" [disabled] [ref=e150]'
              - 'button "d6: Empty" [disabled] [ref=e151]'
              - 'button "e6: Empty, wall boundaries: bottom" [disabled] [ref=e152]'
              - 'button "f6: Empty, wall boundaries: bottom" [disabled] [ref=e153]'
              - 'button "g6: Empty" [disabled] [ref=e154]'
              - 'button "h6: Empty" [disabled] [ref=e155]'
              - 'button "i6: Empty" [disabled] [ref=e156]'
              - generic [ref=e157]: "5"
              - 'button "a5: West gold diamond" [disabled] [ref=e158]':
                - generic: ◆
              - 'button "b5: Empty" [disabled] [ref=e159]'
              - 'button "c5: Empty" [disabled] [ref=e160]'
              - 'button "d5: Empty" [disabled] [ref=e161]'
              - 'button "e5: Central hill, center goal, wall boundaries: top" [disabled] [ref=e162]':
                - generic: ★
              - 'button "f5: Empty, wall boundaries: top" [disabled] [ref=e163]'
              - 'button "g5: Empty" [disabled] [ref=e164]'
              - 'button "h5: Empty" [disabled] [ref=e165]'
              - 'button "i5: East black square" [disabled] [ref=e166]':
                - generic: ■
              - generic [ref=e167]: "4"
              - 'button "a4: Empty" [disabled] [ref=e168]'
              - 'button "b4: Empty" [disabled] [ref=e169]'
              - 'button "c4: Empty" [disabled] [ref=e170]'
              - 'button "d4: Empty" [disabled] [ref=e171]'
              - 'button "e4: Empty" [disabled] [ref=e172]'
              - 'button "f4: Empty" [disabled] [ref=e173]'
              - 'button "g4: Empty" [disabled] [ref=e174]'
              - 'button "h4: Empty" [disabled] [ref=e175]'
              - 'button "i4: Empty" [disabled] [ref=e176]'
              - generic [ref=e177]: "3"
              - 'button "a3: Empty" [disabled] [ref=e178]'
              - 'button "b3: Empty" [disabled] [ref=e179]'
              - 'button "c3: Empty" [disabled] [ref=e180]'
              - 'button "d3: Empty" [disabled] [ref=e181]'
              - 'button "e3: Empty" [disabled] [ref=e182]'
              - 'button "f3: Empty" [disabled] [ref=e183]'
              - 'button "g3: Empty" [disabled] [ref=e184]'
              - 'button "h3: Empty" [disabled] [ref=e185]'
              - 'button "i3: Empty" [disabled] [ref=e186]'
              - generic [ref=e187]: "2"
              - 'button "a2: Empty, wall boundaries: bottom" [disabled] [ref=e188]'
              - 'button "b2: Empty, wall boundaries: bottom" [disabled] [ref=e189]'
              - 'button "c2: Empty" [disabled] [ref=e190]'
              - 'button "d2: Empty" [disabled] [ref=e191]'
              - 'button "e2: Empty" [disabled] [ref=e192]'
              - 'button "f2: Empty" [disabled] [ref=e193]'
              - 'button "g2: Empty" [disabled] [ref=e194]'
              - 'button "h2: Empty" [disabled] [ref=e195]'
              - 'button "i2: Empty" [disabled] [ref=e196]'
              - generic [ref=e197]: "1"
              - 'button "a1: Empty, wall boundaries: top" [disabled] [ref=e198]'
              - 'button "b1: Empty, wall boundaries: top" [disabled] [ref=e199]'
              - 'button "c1: Empty" [disabled] [ref=e200]'
              - 'button "d1: Empty" [disabled] [ref=e201]'
              - 'button "e1: South red circle" [disabled] [ref=e202]':
                - generic: ●
              - 'button "f1: Empty" [disabled] [ref=e203]'
              - 'button "g1: Empty" [disabled] [ref=e204]'
              - 'button "h1: Empty" [disabled] [ref=e205]'
              - 'button "i1: Empty" [disabled] [ref=e206]'
            - generic [ref=e207]:
              - paragraph [ref=e208]: Move to a coordinate
              - button "Move to a coordinate" [ref=e209] [cursor=pointer]:
                - paragraph [ref=e210]: Select…
                - img [ref=e212]
            - status [ref=e214]: Move to a marked square.
          - status [ref=e216]:
            - generic [ref=e217]:
              - generic [ref=e218]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
              - text: Your turn. Reach the center hill (e5) first.
        - generic [ref=e221]:
          - group "Game actions" [ref=e222]:
            - button "Offer draw" [ref=e223] [cursor=pointer]:
              - paragraph [ref=e226]: Offer draw
            - button "Resign game" [ref=e227] [cursor=pointer]:
              - paragraph [ref=e230]:
                - text: Resign
                - generic [ref=e231]: game
          - button "History and stats" [ref=e232] [cursor=pointer]:
            - generic [ref=e234]:
              - paragraph [ref=e235]: History and stats
              - img [ref=e238]
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