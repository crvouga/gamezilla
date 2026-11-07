# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--four-player-round regression quoridor-hill-four-seat-confirm-below-fold
- Location: tests/storybook/stories.checks.ts:373:1

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  34948 pixels (ratio 0.11 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/four-player-round-light.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/four-player-round-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 34948 pixels (ratio 0.11 of all image pixels) are different.
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
  - 34948 pixels (ratio 0.11 of all image pixels) are different.

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
        - generic [ref=e61]:
          - paragraph [ref=e62]: Your turn. Reach the center hill (e5) first.
          - generic [ref=e63]:
            - list "Moves played" [ref=e68]:
              - listitem [ref=e69]:
                - generic [ref=e70]: Move 2
                - generic [ref=e71]:
                  - generic [ref=e73]: ●
                  - 'button "Move 5, South red circle: e5h" [ref=e74] [cursor=pointer]': e5h
            - button "All moves" [ref=e75] [cursor=pointer]:
              - img [ref=e79]
        - generic [ref=e81]:
          - generic [ref=e83]:
            - list "Players" [ref=e85]:
              - generic "jordan_plays" [ref=e86]:
                - listitem [ref=e87]:
                  - generic [ref=e90]:
                    - generic [ref=e91]: jordan_plays
                    - generic [ref=e92]:
                      - generic [ref=e94]: ◆
                      - generic [ref=e95]: Walls 5
                      - generic [ref=e97]: You
              - generic "avery" [ref=e98]:
                - listitem [ref=e99]:
                  - generic [ref=e101]:
                    - generic [ref=e102]: avery
                    - generic [ref=e103]:
                      - generic [ref=e105]: ●
                      - generic [ref=e106]: Walls 4
              - generic "morgan" [ref=e107]:
                - listitem [ref=e108]:
                  - generic [ref=e110]:
                    - generic [ref=e111]: morgan
                    - generic [ref=e112]:
                      - generic [ref=e114]: ▲
                      - generic [ref=e115]: Walls 5
              - generic "robin_42" [ref=e116]:
                - listitem [ref=e117]:
                  - generic [ref=e119]:
                    - generic [ref=e120]: robin_42
                    - generic [ref=e121]:
                      - generic [ref=e123]: ■
                      - generic [ref=e124]: Walls 5
            - generic [ref=e126]:
              - group "Quoridor board, nine columns and nine rows" [ref=e127]:
                - generic [ref=e129]: a
                - generic [ref=e130]: b
                - generic [ref=e131]: c
                - generic [ref=e132]: d
                - generic [ref=e133]: e
                - generic [ref=e134]: f
                - generic [ref=e135]: g
                - generic [ref=e136]: h
                - generic [ref=e137]: i
                - generic [ref=e138]: "9"
                - 'button "a9: Empty" [disabled] [ref=e139]'
                - 'button "b9: Empty" [disabled] [ref=e140]'
                - 'button "c9: Empty" [disabled] [ref=e141]'
                - 'button "d9: Empty" [disabled] [ref=e142]'
                - 'button "e9: Empty" [disabled] [ref=e143]'
                - 'button "f9: Empty" [disabled] [ref=e144]'
                - 'button "g9: Empty" [disabled] [ref=e145]'
                - 'button "h9: Empty" [disabled] [ref=e146]'
                - 'button "i9: Empty" [disabled] [ref=e147]'
                - generic [ref=e148]: "8"
                - 'button "a8: Empty" [disabled] [ref=e149]'
                - 'button "b8: Empty" [disabled] [ref=e150]'
                - 'button "c8: Empty" [disabled] [ref=e151]'
                - 'button "d8: Empty" [disabled] [ref=e152]'
                - 'button "e8: North green triangle" [disabled] [ref=e153]':
                  - generic: ▲
                - 'button "f8: Empty" [disabled] [ref=e154]'
                - 'button "g8: Empty" [disabled] [ref=e155]'
                - 'button "h8: Empty" [disabled] [ref=e156]'
                - 'button "i8: Empty" [disabled] [ref=e157]'
                - generic [ref=e158]: "7"
                - 'button "a7: Empty" [disabled] [ref=e159]'
                - 'button "b7: Empty" [disabled] [ref=e160]'
                - 'button "c7: Empty" [disabled] [ref=e161]'
                - 'button "d7: Empty" [disabled] [ref=e162]'
                - 'button "e7: Empty" [disabled] [ref=e163]'
                - 'button "f7: Empty" [disabled] [ref=e164]'
                - 'button "g7: Empty" [disabled] [ref=e165]'
                - 'button "h7: Empty" [disabled] [ref=e166]'
                - 'button "i7: Empty" [disabled] [ref=e167]'
                - generic [ref=e168]: "6"
                - 'button "a6: Empty" [disabled] [ref=e169]'
                - 'button "b6: Empty" [disabled] [ref=e170]'
                - 'button "c6: Empty" [disabled] [ref=e171]'
                - 'button "d6: Empty" [disabled] [ref=e172]'
                - 'button "e6: Empty, wall boundaries: bottom" [disabled] [ref=e173]'
                - 'button "f6: Empty, wall boundaries: bottom" [disabled] [ref=e174]'
                - 'button "g6: Empty" [disabled] [ref=e175]'
                - 'button "h6: Empty" [disabled] [ref=e176]'
                - 'button "i6: East black square" [disabled] [ref=e177]':
                  - generic: ■
                - generic [ref=e178]: "5"
                - 'button "a5: Empty, legal move" [ref=e179] [cursor=pointer]':
                  - generic: ○
                - 'button "b5: Empty" [disabled] [ref=e180]'
                - 'button "c5: Empty" [disabled] [ref=e181]'
                - 'button "d5: Empty" [disabled] [ref=e182]'
                - 'button "e5: Central hill, center goal, wall boundaries: top" [disabled] [ref=e183]':
                  - generic: ★
                - 'button "f5: Empty, wall boundaries: top" [disabled] [ref=e184]'
                - 'button "g5: Empty" [disabled] [ref=e185]'
                - 'button "h5: Empty" [disabled] [ref=e186]'
                - 'button "i5: Empty" [disabled] [ref=e187]'
                - generic [ref=e188]: "4"
                - 'button "a4: West gold diamond" [disabled] [ref=e189]':
                  - generic: ◆
                - 'button "b4: Empty, legal move" [ref=e190] [cursor=pointer]':
                  - generic: ○
                - 'button "c4: Empty" [disabled] [ref=e191]'
                - 'button "d4: Empty" [disabled] [ref=e192]'
                - 'button "e4: Empty" [disabled] [ref=e193]'
                - 'button "f4: Empty" [disabled] [ref=e194]'
                - 'button "g4: Empty" [disabled] [ref=e195]'
                - 'button "h4: Empty" [disabled] [ref=e196]'
                - 'button "i4: Empty" [disabled] [ref=e197]'
                - generic [ref=e198]: "3"
                - 'button "a3: Empty, legal move" [ref=e199] [cursor=pointer]':
                  - generic: ○
                - 'button "b3: Empty" [disabled] [ref=e200]'
                - 'button "c3: Empty" [disabled] [ref=e201]'
                - 'button "d3: Empty" [disabled] [ref=e202]'
                - 'button "e3: Empty" [disabled] [ref=e203]'
                - 'button "f3: Empty" [disabled] [ref=e204]'
                - 'button "g3: Empty" [disabled] [ref=e205]'
                - 'button "h3: Empty" [disabled] [ref=e206]'
                - 'button "i3: Empty" [disabled] [ref=e207]'
                - generic [ref=e208]: "2"
                - 'button "a2: Empty" [disabled] [ref=e209]'
                - 'button "b2: Empty" [disabled] [ref=e210]'
                - 'button "c2: Empty" [disabled] [ref=e211]'
                - 'button "d2: Empty" [disabled] [ref=e212]'
                - 'button "e2: South red circle" [disabled] [ref=e213]':
                  - generic: ●
                - 'button "f2: Empty" [disabled] [ref=e214]'
                - 'button "g2: Empty" [disabled] [ref=e215]'
                - 'button "h2: Empty" [disabled] [ref=e216]'
                - 'button "i2: Empty" [disabled] [ref=e217]'
                - generic [ref=e218]: "1"
                - 'button "a1: Empty" [disabled] [ref=e219]'
                - 'button "b1: Empty" [disabled] [ref=e220]'
                - 'button "c1: Empty" [disabled] [ref=e221]'
                - 'button "d1: Empty" [disabled] [ref=e222]'
                - 'button "e1: Empty" [disabled] [ref=e223]'
                - 'button "f1: Empty" [disabled] [ref=e224]'
                - 'button "g1: Empty" [disabled] [ref=e225]'
                - 'button "h1: Empty" [disabled] [ref=e226]'
                - 'button "i1: Empty" [disabled] [ref=e227]'
              - generic [ref=e228]:
                - button "Move pawn" [pressed] [ref=e229] [cursor=pointer]:
                  - paragraph [ref=e232]: Move
                - button "Horizontal wall" [ref=e233] [cursor=pointer]:
                  - paragraph [ref=e236]: Horizontal wall
                - button "Vertical wall" [ref=e237] [cursor=pointer]:
                  - paragraph [ref=e240]: Vertical wall
              - button "Move to a coordinate" [ref=e242] [cursor=pointer]:
                - paragraph [ref=e243]: Choose destination
                - img [ref=e245]
              - status [ref=e247]: Move to a marked square.
            - status [ref=e249]:
              - generic [ref=e250]:
                - generic [ref=e251]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
                - text: Your turn. Reach the center hill (e5) first.
          - generic [ref=e254]:
            - group "Game actions" [ref=e255]:
              - button "Offer draw" [ref=e256] [cursor=pointer]:
                - paragraph [ref=e259]: Offer draw
              - button "Resign game" [ref=e260] [cursor=pointer]:
                - paragraph [ref=e263]:
                  - text: Resign
                  - generic [ref=e264]: game
            - button "History and stats" [ref=e265] [cursor=pointer]:
              - generic [ref=e267]:
                - paragraph [ref=e268]: History and stats
                - img [ref=e271]
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