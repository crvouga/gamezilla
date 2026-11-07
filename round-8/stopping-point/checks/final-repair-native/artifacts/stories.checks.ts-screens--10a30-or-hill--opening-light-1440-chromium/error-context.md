# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--opening light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  68404 pixels (ratio 0.06 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/opening-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/opening-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 68404 pixels (ratio 0.06 of all image pixels) are different.
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
  - 68404 pixels (ratio 0.06 of all image pixels) are different.

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
              - generic "jordan_plays" [ref=e108]:
                - listitem [ref=e109]:
                  - generic [ref=e113]:
                    - generic [ref=e114]: jordan_plays
                    - generic [ref=e115]:
                      - generic [ref=e117]: ◆
                      - generic [ref=e118]: Walls 5
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
                - 'button "e9: North green triangle" [disabled] [ref=e159]':
                  - generic: ▲
                - 'button "f9: Empty" [disabled] [ref=e160]'
                - 'button "g9: Empty" [disabled] [ref=e161]'
                - 'button "h9: Empty" [disabled] [ref=e162]'
                - 'button "i9: Empty" [disabled] [ref=e163]'
                - generic [ref=e164]: "8"
                - 'button "a8: Empty" [disabled] [ref=e165]'
                - 'button "b8: Empty" [disabled] [ref=e166]'
                - 'button "c8: Empty" [disabled] [ref=e167]'
                - 'button "d8: Empty" [disabled] [ref=e168]'
                - 'button "e8: Empty" [disabled] [ref=e169]'
                - 'button "f8: Empty" [disabled] [ref=e170]'
                - 'button "g8: Empty" [disabled] [ref=e171]'
                - 'button "h8: Empty" [disabled] [ref=e172]'
                - 'button "i8: Empty" [disabled] [ref=e173]'
                - generic [ref=e174]: "7"
                - 'button "a7: Empty" [disabled] [ref=e175]'
                - 'button "b7: Empty" [disabled] [ref=e176]'
                - 'button "c7: Empty" [disabled] [ref=e177]'
                - 'button "d7: Empty" [disabled] [ref=e178]'
                - 'button "e7: Empty" [disabled] [ref=e179]'
                - 'button "f7: Empty" [disabled] [ref=e180]'
                - 'button "g7: Empty" [disabled] [ref=e181]'
                - 'button "h7: Empty" [disabled] [ref=e182]'
                - 'button "i7: Empty" [disabled] [ref=e183]'
                - generic [ref=e184]: "6"
                - 'button "a6: Empty" [disabled] [ref=e185]'
                - 'button "b6: Empty" [disabled] [ref=e186]'
                - 'button "c6: Empty" [disabled] [ref=e187]'
                - 'button "d6: Empty" [disabled] [ref=e188]'
                - 'button "e6: Empty" [disabled] [ref=e189]'
                - 'button "f6: Empty" [disabled] [ref=e190]'
                - 'button "g6: Empty" [disabled] [ref=e191]'
                - 'button "h6: Empty" [disabled] [ref=e192]'
                - 'button "i6: Empty" [disabled] [ref=e193]'
                - generic [ref=e194]: "5"
                - 'button "a5: West gold diamond" [disabled] [ref=e195]':
                  - generic: ◆
                - 'button "b5: Empty" [disabled] [ref=e196]'
                - 'button "c5: Empty" [disabled] [ref=e197]'
                - 'button "d5: Empty" [disabled] [ref=e198]'
                - 'button "e5: Central hill, center goal" [disabled] [ref=e199]':
                  - generic: ★
                - 'button "f5: Empty" [disabled] [ref=e200]'
                - 'button "g5: Empty" [disabled] [ref=e201]'
                - 'button "h5: Empty" [disabled] [ref=e202]'
                - 'button "i5: East black square" [disabled] [ref=e203]':
                  - generic: ■
                - generic [ref=e204]: "4"
                - 'button "a4: Empty" [disabled] [ref=e205]'
                - 'button "b4: Empty" [disabled] [ref=e206]'
                - 'button "c4: Empty" [disabled] [ref=e207]'
                - 'button "d4: Empty" [disabled] [ref=e208]'
                - 'button "e4: Empty" [disabled] [ref=e209]'
                - 'button "f4: Empty" [disabled] [ref=e210]'
                - 'button "g4: Empty" [disabled] [ref=e211]'
                - 'button "h4: Empty" [disabled] [ref=e212]'
                - 'button "i4: Empty" [disabled] [ref=e213]'
                - generic [ref=e214]: "3"
                - 'button "a3: Empty" [disabled] [ref=e215]'
                - 'button "b3: Empty" [disabled] [ref=e216]'
                - 'button "c3: Empty" [disabled] [ref=e217]'
                - 'button "d3: Empty" [disabled] [ref=e218]'
                - 'button "e3: Empty" [disabled] [ref=e219]'
                - 'button "f3: Empty" [disabled] [ref=e220]'
                - 'button "g3: Empty" [disabled] [ref=e221]'
                - 'button "h3: Empty" [disabled] [ref=e222]'
                - 'button "i3: Empty" [disabled] [ref=e223]'
                - generic [ref=e224]: "2"
                - 'button "a2: Empty" [disabled] [ref=e225]'
                - 'button "b2: Empty" [disabled] [ref=e226]'
                - 'button "c2: Empty" [disabled] [ref=e227]'
                - 'button "d2: Empty" [disabled] [ref=e228]'
                - 'button "e2: Empty, legal move" [ref=e229] [cursor=pointer]':
                  - generic: ○
                - 'button "f2: Empty" [disabled] [ref=e230]'
                - 'button "g2: Empty" [disabled] [ref=e231]'
                - 'button "h2: Empty" [disabled] [ref=e232]'
                - 'button "i2: Empty" [disabled] [ref=e233]'
                - generic [ref=e234]: "1"
                - 'button "a1: Empty" [disabled] [ref=e235]'
                - 'button "b1: Empty" [disabled] [ref=e236]'
                - 'button "c1: Empty" [disabled] [ref=e237]'
                - 'button "d1: Empty, legal move" [ref=e238] [cursor=pointer]':
                  - generic: ○
                - 'button "e1: South red circle" [disabled] [ref=e239]':
                  - generic: ●
                - 'button "f1: Empty, legal move" [ref=e240] [cursor=pointer]':
                  - generic: ○
                - 'button "g1: Empty" [disabled] [ref=e241]'
                - 'button "h1: Empty" [disabled] [ref=e242]'
                - 'button "i1: Empty" [disabled] [ref=e243]'
              - generic [ref=e244]:
                - button "Move pawn" [pressed] [ref=e245] [cursor=pointer]:
                  - paragraph [ref=e248]: Move
                - button "Horizontal wall" [ref=e249] [cursor=pointer]:
                  - paragraph [ref=e252]: Horizontal wall
                - button "Vertical wall" [ref=e253] [cursor=pointer]:
                  - paragraph [ref=e256]: Vertical wall
              - button "Move to a coordinate" [ref=e258] [cursor=pointer]:
                - paragraph [ref=e259]: Choose destination
                - img [ref=e261]
              - status [ref=e263]: Move to a marked square.
            - status [ref=e265]:
              - generic [ref=e266]:
                - generic [ref=e267]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
                - text: Your turn. Reach the center hill (e5) first.
            - generic [ref=e270]:
              - generic [ref=e275]:
                - img "South red circle" [ref=e276]:
                  - generic [ref=e277]: ●
                - generic "avery" [ref=e280]
                - generic [ref=e281]: Your move
              - generic [ref=e282]:
                - generic [ref=e283]: Walls
                - generic [ref=e284]: "5"
          - region "Game record" [ref=e287]:
            - generic [ref=e288]:
              - heading "Game record" [level=2] [ref=e290]
              - paragraph [ref=e291]: Your turn. Reach the center hill (e5) first.
            - paragraph [ref=e294]: Live
            - generic [ref=e296]:
              - group "Game actions" [ref=e297]:
                - button "Offer draw" [ref=e298] [cursor=pointer]:
                  - paragraph [ref=e301]: Offer draw
                - button "Resign game" [ref=e302] [cursor=pointer]:
                  - paragraph [ref=e305]:
                    - text: Resign
                    - generic [ref=e306]: game
              - button "History and stats" [ref=e307] [cursor=pointer]:
                - paragraph [ref=e310]: History and stats
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