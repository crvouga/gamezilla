# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--opening dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  41485 pixels (ratio 0.13 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/opening-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/opening-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 41485 pixels (ratio 0.13 of all image pixels) are different.
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
  - 41485 pixels (ratio 0.13 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e10]:
    - generic [ref=e12]:
      - button "Spaces" [ref=e14] [cursor=pointer]:
        - img [ref=e17]
      - generic [ref=e21]:
        - paragraph [ref=e22]: Spaces
        - paragraph [ref=e23]: Friday game night
      - generic [ref=e25]:
        - button "2 people in this space" [ref=e27] [cursor=pointer]:
          - img [ref=e31]
        - button "More" [ref=e37] [cursor=pointer]:
          - img [ref=e40]
      - button "Account menu" [ref=e45] [cursor=pointer]
    - generic [ref=e50]:
      - generic [ref=e51]:
        - 'heading "Quoridor: King of the Hill" [level=1] [ref=e54]'
        - generic [ref=e56]:
          - generic [ref=e57]: Unrated
          - generic [ref=e58]: ·Untimed
      - generic [ref=e59]:
        - generic [ref=e62]:
          - paragraph [ref=e64]: Your turn. Reach the center hill (e5) first.
          - paragraph [ref=e69]: No moves yet.
          - button "All moves" [ref=e70] [cursor=pointer]:
            - img [ref=e74]
        - generic [ref=e76]:
          - generic [ref=e78]:
            - list "Players" [ref=e80]:
              - generic "avery" [ref=e81]:
                - listitem [ref=e82]:
                  - generic [ref=e85]:
                    - generic [ref=e86]: avery
                    - generic [ref=e87]:
                      - generic [ref=e89]: ●
                      - generic [ref=e90]: Walls 5
                      - generic [ref=e92]: You
              - generic "jordan_plays" [ref=e93]:
                - listitem [ref=e94]:
                  - generic [ref=e96]:
                    - generic [ref=e97]: jordan_plays
                    - generic [ref=e98]:
                      - generic [ref=e100]: ◆
                      - generic [ref=e101]: Walls 5
              - generic "morgan" [ref=e102]:
                - listitem [ref=e103]:
                  - generic [ref=e105]:
                    - generic [ref=e106]: morgan
                    - generic [ref=e107]:
                      - generic [ref=e109]: ▲
                      - generic [ref=e110]: Walls 5
              - generic "robin_42" [ref=e111]:
                - listitem [ref=e112]:
                  - generic [ref=e114]:
                    - generic [ref=e115]: robin_42
                    - generic [ref=e116]:
                      - generic [ref=e118]: ■
                      - generic [ref=e119]: Walls 5
            - generic [ref=e121]:
              - group "Quoridor board, nine columns and nine rows" [ref=e122]:
                - generic [ref=e124]: a
                - generic [ref=e125]: b
                - generic [ref=e126]: c
                - generic [ref=e127]: d
                - generic [ref=e128]: e
                - generic [ref=e129]: f
                - generic [ref=e130]: g
                - generic [ref=e131]: h
                - generic [ref=e132]: i
                - generic [ref=e133]: "9"
                - 'button "a9: Empty" [disabled] [ref=e134]'
                - 'button "b9: Empty" [disabled] [ref=e135]'
                - 'button "c9: Empty" [disabled] [ref=e136]'
                - 'button "d9: Empty" [disabled] [ref=e137]'
                - 'button "e9: North green triangle" [disabled] [ref=e138]':
                  - generic: ▲
                - 'button "f9: Empty" [disabled] [ref=e139]'
                - 'button "g9: Empty" [disabled] [ref=e140]'
                - 'button "h9: Empty" [disabled] [ref=e141]'
                - 'button "i9: Empty" [disabled] [ref=e142]'
                - generic [ref=e143]: "8"
                - 'button "a8: Empty" [disabled] [ref=e144]'
                - 'button "b8: Empty" [disabled] [ref=e145]'
                - 'button "c8: Empty" [disabled] [ref=e146]'
                - 'button "d8: Empty" [disabled] [ref=e147]'
                - 'button "e8: Empty" [disabled] [ref=e148]'
                - 'button "f8: Empty" [disabled] [ref=e149]'
                - 'button "g8: Empty" [disabled] [ref=e150]'
                - 'button "h8: Empty" [disabled] [ref=e151]'
                - 'button "i8: Empty" [disabled] [ref=e152]'
                - generic [ref=e153]: "7"
                - 'button "a7: Empty" [disabled] [ref=e154]'
                - 'button "b7: Empty" [disabled] [ref=e155]'
                - 'button "c7: Empty" [disabled] [ref=e156]'
                - 'button "d7: Empty" [disabled] [ref=e157]'
                - 'button "e7: Empty" [disabled] [ref=e158]'
                - 'button "f7: Empty" [disabled] [ref=e159]'
                - 'button "g7: Empty" [disabled] [ref=e160]'
                - 'button "h7: Empty" [disabled] [ref=e161]'
                - 'button "i7: Empty" [disabled] [ref=e162]'
                - generic [ref=e163]: "6"
                - 'button "a6: Empty" [disabled] [ref=e164]'
                - 'button "b6: Empty" [disabled] [ref=e165]'
                - 'button "c6: Empty" [disabled] [ref=e166]'
                - 'button "d6: Empty" [disabled] [ref=e167]'
                - 'button "e6: Empty" [disabled] [ref=e168]'
                - 'button "f6: Empty" [disabled] [ref=e169]'
                - 'button "g6: Empty" [disabled] [ref=e170]'
                - 'button "h6: Empty" [disabled] [ref=e171]'
                - 'button "i6: Empty" [disabled] [ref=e172]'
                - generic [ref=e173]: "5"
                - 'button "a5: West gold diamond" [disabled] [ref=e174]':
                  - generic: ◆
                - 'button "b5: Empty" [disabled] [ref=e175]'
                - 'button "c5: Empty" [disabled] [ref=e176]'
                - 'button "d5: Empty" [disabled] [ref=e177]'
                - 'button "e5: Central hill, center goal" [disabled] [ref=e178]':
                  - generic: ★
                - 'button "f5: Empty" [disabled] [ref=e179]'
                - 'button "g5: Empty" [disabled] [ref=e180]'
                - 'button "h5: Empty" [disabled] [ref=e181]'
                - 'button "i5: East black square" [disabled] [ref=e182]':
                  - generic: ■
                - generic [ref=e183]: "4"
                - 'button "a4: Empty" [disabled] [ref=e184]'
                - 'button "b4: Empty" [disabled] [ref=e185]'
                - 'button "c4: Empty" [disabled] [ref=e186]'
                - 'button "d4: Empty" [disabled] [ref=e187]'
                - 'button "e4: Empty" [disabled] [ref=e188]'
                - 'button "f4: Empty" [disabled] [ref=e189]'
                - 'button "g4: Empty" [disabled] [ref=e190]'
                - 'button "h4: Empty" [disabled] [ref=e191]'
                - 'button "i4: Empty" [disabled] [ref=e192]'
                - generic [ref=e193]: "3"
                - 'button "a3: Empty" [disabled] [ref=e194]'
                - 'button "b3: Empty" [disabled] [ref=e195]'
                - 'button "c3: Empty" [disabled] [ref=e196]'
                - 'button "d3: Empty" [disabled] [ref=e197]'
                - 'button "e3: Empty" [disabled] [ref=e198]'
                - 'button "f3: Empty" [disabled] [ref=e199]'
                - 'button "g3: Empty" [disabled] [ref=e200]'
                - 'button "h3: Empty" [disabled] [ref=e201]'
                - 'button "i3: Empty" [disabled] [ref=e202]'
                - generic [ref=e203]: "2"
                - 'button "a2: Empty" [disabled] [ref=e204]'
                - 'button "b2: Empty" [disabled] [ref=e205]'
                - 'button "c2: Empty" [disabled] [ref=e206]'
                - 'button "d2: Empty" [disabled] [ref=e207]'
                - 'button "e2: Empty, legal move" [ref=e208] [cursor=pointer]':
                  - generic: ○
                - 'button "f2: Empty" [disabled] [ref=e209]'
                - 'button "g2: Empty" [disabled] [ref=e210]'
                - 'button "h2: Empty" [disabled] [ref=e211]'
                - 'button "i2: Empty" [disabled] [ref=e212]'
                - generic [ref=e213]: "1"
                - 'button "a1: Empty" [disabled] [ref=e214]'
                - 'button "b1: Empty" [disabled] [ref=e215]'
                - 'button "c1: Empty" [disabled] [ref=e216]'
                - 'button "d1: Empty, legal move" [ref=e217] [cursor=pointer]':
                  - generic: ○
                - 'button "e1: South red circle" [disabled] [ref=e218]':
                  - generic: ●
                - 'button "f1: Empty, legal move" [ref=e219] [cursor=pointer]':
                  - generic: ○
                - 'button "g1: Empty" [disabled] [ref=e220]'
                - 'button "h1: Empty" [disabled] [ref=e221]'
                - 'button "i1: Empty" [disabled] [ref=e222]'
              - generic [ref=e223]:
                - button "Move pawn" [pressed] [ref=e224] [cursor=pointer]:
                  - paragraph [ref=e227]: Move
                - button "Horizontal wall" [ref=e228] [cursor=pointer]:
                  - paragraph [ref=e231]: Horizontal wall
                - button "Vertical wall" [ref=e232] [cursor=pointer]:
                  - paragraph [ref=e235]: Vertical wall
              - button "Move to a coordinate" [ref=e237] [cursor=pointer]:
                - paragraph [ref=e238]: Choose destination
                - img [ref=e240]
              - status [ref=e242]: Move to a marked square.
            - status [ref=e244]:
              - generic [ref=e245]:
                - generic [ref=e246]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
                - text: Your turn. Reach the center hill (e5) first.
          - generic [ref=e249]:
            - group "Game actions" [ref=e250]:
              - button "Offer draw" [ref=e251] [cursor=pointer]:
                - paragraph [ref=e254]: Offer draw
              - button "Resign game" [ref=e255] [cursor=pointer]:
                - paragraph [ref=e258]:
                  - text: Resign
                  - generic [ref=e259]: game
            - button "History and stats" [ref=e260] [cursor=pointer]:
              - generic [ref=e262]:
                - paragraph [ref=e263]: History and stats
                - img [ref=e266]
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