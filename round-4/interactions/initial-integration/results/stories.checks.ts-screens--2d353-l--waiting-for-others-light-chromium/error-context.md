# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--waiting-for-others light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  18628 pixels (ratio 0.06 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/waiting-for-others-light.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/waiting-for-others-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 18628 pixels (ratio 0.06 of all image pixels) are different.
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
  - 18628 pixels (ratio 0.06 of all image pixels) are different.

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
        - paragraph [ref=e24]: East black square to move. First to e5 wins.
        - generic [ref=e25]:
          - paragraph [ref=e30]: No moves yet.
          - button "All moves" [ref=e31] [cursor=pointer]:
            - img [ref=e35]
      - generic [ref=e37]:
        - generic [ref=e39]:
          - list "Players" [ref=e40]:
            - listitem [ref=e41]:
              - generic [ref=e46]:
                - generic [ref=e47]: avery
                - generic [ref=e48]:
                  - generic [ref=e50]: ●
                  - generic [ref=e51]: Walls 5
                  - generic [ref=e53]: You
            - listitem [ref=e54]:
              - generic [ref=e58]:
                - generic [ref=e59]: jordan_plays
                - generic [ref=e60]:
                  - generic [ref=e62]: ◆
                  - generic [ref=e63]: Walls 5
            - listitem [ref=e64]:
              - generic [ref=e68]:
                - generic [ref=e69]: morgan
                - generic [ref=e70]:
                  - generic [ref=e72]: ▲
                  - generic [ref=e73]: Walls 5
            - listitem [ref=e74]:
              - generic [ref=e78]:
                - generic [ref=e79]: robin_42
                - generic [ref=e80]:
                  - generic [ref=e82]: ■
                  - generic [ref=e83]: Walls 5
          - generic [ref=e85]:
            - generic [ref=e86]:
              - button "Move pawn" [disabled] [pressed] [ref=e87]:
                - paragraph [ref=e90]: Move pawn
              - button "Horizontal wall" [disabled] [ref=e91]:
                - paragraph [ref=e94]: Horizontal wall
              - button "Vertical wall" [disabled] [ref=e95]:
                - paragraph [ref=e98]: Vertical wall
            - group "Quoridor board, nine columns and nine rows" [ref=e99]:
              - generic [ref=e101]: a
              - generic [ref=e102]: b
              - generic [ref=e103]: c
              - generic [ref=e104]: d
              - generic [ref=e105]: e
              - generic [ref=e106]: f
              - generic [ref=e107]: g
              - generic [ref=e108]: h
              - generic [ref=e109]: i
              - generic [ref=e110]: "9"
              - 'button "a9: Empty" [disabled] [ref=e111]'
              - 'button "b9: Empty" [disabled] [ref=e112]'
              - 'button "c9: Empty" [disabled] [ref=e113]'
              - 'button "d9: Empty" [disabled] [ref=e114]'
              - 'button "e9: Empty" [disabled] [ref=e115]'
              - 'button "f9: Empty" [disabled] [ref=e116]'
              - 'button "g9: Empty" [disabled] [ref=e117]'
              - 'button "h9: Empty" [disabled] [ref=e118]'
              - 'button "i9: Empty" [disabled] [ref=e119]'
              - generic [ref=e120]: "8"
              - 'button "a8: Empty" [disabled] [ref=e121]'
              - 'button "b8: Empty" [disabled] [ref=e122]'
              - 'button "c8: Empty" [disabled] [ref=e123]'
              - 'button "d8: Empty" [disabled] [ref=e124]'
              - 'button "e8: North green triangle" [disabled] [ref=e125]':
                - generic: ▲
              - 'button "f8: Empty" [disabled] [ref=e126]'
              - 'button "g8: Empty" [disabled] [ref=e127]'
              - 'button "h8: Empty" [disabled] [ref=e128]'
              - 'button "i8: Empty" [disabled] [ref=e129]'
              - generic [ref=e130]: "7"
              - 'button "a7: Empty" [disabled] [ref=e131]'
              - 'button "b7: Empty" [disabled] [ref=e132]'
              - 'button "c7: Empty" [disabled] [ref=e133]'
              - 'button "d7: Empty" [disabled] [ref=e134]'
              - 'button "e7: Empty" [disabled] [ref=e135]'
              - 'button "f7: Empty" [disabled] [ref=e136]'
              - 'button "g7: Empty" [disabled] [ref=e137]'
              - 'button "h7: Empty" [disabled] [ref=e138]'
              - 'button "i7: Empty" [disabled] [ref=e139]'
              - generic [ref=e140]: "6"
              - 'button "a6: Empty" [disabled] [ref=e141]'
              - 'button "b6: Empty" [disabled] [ref=e142]'
              - 'button "c6: Empty" [disabled] [ref=e143]'
              - 'button "d6: Empty" [disabled] [ref=e144]'
              - 'button "e6: Empty" [disabled] [ref=e145]'
              - 'button "f6: Empty" [disabled] [ref=e146]'
              - 'button "g6: Empty" [disabled] [ref=e147]'
              - 'button "h6: Empty" [disabled] [ref=e148]'
              - 'button "i6: Empty, legal move" [disabled] [ref=e149]':
                - generic: ·
              - generic [ref=e150]: "5"
              - 'button "a5: Empty" [disabled] [ref=e151]'
              - 'button "b5: Empty" [disabled] [ref=e152]'
              - 'button "c5: Empty" [disabled] [ref=e153]'
              - 'button "d5: Empty" [disabled] [ref=e154]'
              - 'button "e5: Central hill" [disabled] [ref=e155]':
                - generic: ◎
              - 'button "f5: Empty" [disabled] [ref=e156]'
              - 'button "g5: Empty" [disabled] [ref=e157]'
              - 'button "h5: Empty, legal move" [disabled] [ref=e158]':
                - generic: ·
              - 'button "i5: East black square" [disabled] [ref=e159]':
                - generic: ■
              - generic [ref=e160]: "4"
              - 'button "a4: West gold diamond" [disabled] [ref=e161]':
                - generic: ◆
              - 'button "b4: Empty" [disabled] [ref=e162]'
              - 'button "c4: Empty" [disabled] [ref=e163]'
              - 'button "d4: Empty" [disabled] [ref=e164]'
              - 'button "e4: Empty" [disabled] [ref=e165]'
              - 'button "f4: Empty" [disabled] [ref=e166]'
              - 'button "g4: Empty" [disabled] [ref=e167]'
              - 'button "h4: Empty" [disabled] [ref=e168]'
              - 'button "i4: Empty, legal move" [disabled] [ref=e169]':
                - generic: ·
              - generic [ref=e170]: "3"
              - 'button "a3: Empty" [disabled] [ref=e171]'
              - 'button "b3: Empty" [disabled] [ref=e172]'
              - 'button "c3: Empty" [disabled] [ref=e173]'
              - 'button "d3: Empty" [disabled] [ref=e174]'
              - 'button "e3: Empty" [disabled] [ref=e175]'
              - 'button "f3: Empty" [disabled] [ref=e176]'
              - 'button "g3: Empty" [disabled] [ref=e177]'
              - 'button "h3: Empty" [disabled] [ref=e178]'
              - 'button "i3: Empty" [disabled] [ref=e179]'
              - generic [ref=e180]: "2"
              - 'button "a2: Empty" [disabled] [ref=e181]'
              - 'button "b2: Empty" [disabled] [ref=e182]'
              - 'button "c2: Empty" [disabled] [ref=e183]'
              - 'button "d2: Empty" [disabled] [ref=e184]'
              - 'button "e2: South red circle" [disabled] [ref=e185]':
                - generic: ●
              - 'button "f2: Empty" [disabled] [ref=e186]'
              - 'button "g2: Empty" [disabled] [ref=e187]'
              - 'button "h2: Empty" [disabled] [ref=e188]'
              - 'button "i2: Empty" [disabled] [ref=e189]'
              - generic [ref=e190]: "1"
              - 'button "a1: Empty" [disabled] [ref=e191]'
              - 'button "b1: Empty" [disabled] [ref=e192]'
              - 'button "c1: Empty" [disabled] [ref=e193]'
              - 'button "d1: Empty" [disabled] [ref=e194]'
              - 'button "e1: Empty" [disabled] [ref=e195]'
              - 'button "f1: Empty" [disabled] [ref=e196]'
              - 'button "g1: Empty" [disabled] [ref=e197]'
              - 'button "h1: Empty" [disabled] [ref=e198]'
              - 'button "i1: Empty" [disabled] [ref=e199]'
            - status [ref=e200]: This board is read-only. Follow the game or review earlier moves.
          - status [ref=e202]:
            - generic [ref=e203]:
              - generic [ref=e204]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
              - text: East black square to move. First to e5 wins.
        - generic [ref=e207]:
          - group "Game actions" [ref=e208]:
            - button "Offer draw" [ref=e209] [cursor=pointer]:
              - paragraph [ref=e212]: Offer draw
            - button "Resign game" [ref=e213] [cursor=pointer]:
              - paragraph [ref=e216]:
                - text: Resign
                - generic [ref=e217]: game
          - button "History and stats" [ref=e218] [cursor=pointer]:
            - generic [ref=e220]:
              - paragraph [ref=e221]: History and stats
              - img [ref=e224]
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