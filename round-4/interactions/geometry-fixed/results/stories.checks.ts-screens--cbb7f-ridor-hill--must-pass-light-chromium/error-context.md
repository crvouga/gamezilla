# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--must-pass light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  41610 pixels (ratio 0.13 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/must-pass-light.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/must-pass-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 41610 pixels (ratio 0.13 of all image pixels) are different.
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
  - 41610 pixels (ratio 0.13 of all image pixels) are different.

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
                  - generic [ref=e51]: Walls 0
                  - generic [ref=e53]: You
            - listitem [ref=e54]:
              - generic [ref=e58]:
                - generic [ref=e59]: jordan_plays
                - generic [ref=e60]:
                  - generic [ref=e62]: ◆
                  - generic [ref=e63]: Walls 3
            - listitem [ref=e64]:
              - generic [ref=e68]:
                - generic [ref=e69]: morgan
                - generic [ref=e70]:
                  - generic [ref=e72]: ▲
                  - generic [ref=e73]: Walls 4
            - listitem [ref=e74]:
              - generic [ref=e78]:
                - generic [ref=e79]: robin_42
                - generic [ref=e80]:
                  - generic [ref=e82]: ■
                  - generic [ref=e83]: Walls 1
          - generic [ref=e85]:
            - button "No legal move or wall — pass turn" [ref=e87] [cursor=pointer]:
              - paragraph [ref=e90]: No legal move or wall — pass turn
            - group "Quoridor board, nine columns and nine rows" [ref=e91]:
              - generic [ref=e93]: a
              - generic [ref=e94]: b
              - generic [ref=e95]: c
              - generic [ref=e96]: d
              - generic [ref=e97]: e
              - generic [ref=e98]: f
              - generic [ref=e99]: g
              - generic [ref=e100]: h
              - generic [ref=e101]: i
              - generic [ref=e102]: "9"
              - 'button "a9: Empty" [disabled] [ref=e103]'
              - 'button "b9: Empty" [disabled] [ref=e104]'
              - 'button "c9: Empty" [disabled] [ref=e105]'
              - 'button "d9: Empty" [disabled] [ref=e106]'
              - 'button "e9: Empty" [disabled] [ref=e107]'
              - 'button "f9: Empty" [disabled] [ref=e108]'
              - 'button "g9: Empty" [disabled] [ref=e109]'
              - 'button "h9: Empty" [disabled] [ref=e110]'
              - 'button "i9: Empty" [disabled] [ref=e111]'
              - generic [ref=e112]: "8"
              - 'button "a8: Empty, wall boundaries: right" [disabled] [ref=e113]'
              - 'button "b8: Empty, wall boundaries: left" [disabled] [ref=e114]'
              - 'button "c8: Empty, wall boundaries: bottom" [disabled] [ref=e115]'
              - 'button "d8: Empty, wall boundaries: bottom" [disabled] [ref=e116]'
              - 'button "e8: Empty" [disabled] [ref=e117]'
              - 'button "f8: Empty, wall boundaries: bottom" [disabled] [ref=e118]'
              - 'button "g8: Empty, wall boundaries: bottom" [disabled] [ref=e119]'
              - 'button "h8: Empty" [disabled] [ref=e120]'
              - 'button "i8: Empty" [disabled] [ref=e121]'
              - generic [ref=e122]: "7"
              - 'button "a7: Empty, wall boundaries: right" [disabled] [ref=e123]'
              - 'button "b7: Empty, wall boundaries: left" [disabled] [ref=e124]'
              - 'button "c7: Empty, wall boundaries: top" [disabled] [ref=e125]'
              - 'button "d7: Empty, wall boundaries: top" [disabled] [ref=e126]'
              - 'button "e7: Empty" [disabled] [ref=e127]'
              - 'button "f7: Empty, wall boundaries: top" [disabled] [ref=e128]'
              - 'button "g7: Empty, wall boundaries: top" [disabled] [ref=e129]'
              - 'button "h7: Empty" [disabled] [ref=e130]'
              - 'button "i7: Empty" [disabled] [ref=e131]'
              - generic [ref=e132]: "6"
              - 'button "a6: Empty, wall boundaries: right" [disabled] [ref=e133]'
              - 'button "b6: Empty, wall boundaries: left" [disabled] [ref=e134]'
              - 'button "c6: Empty, wall boundaries: bottom" [disabled] [ref=e135]'
              - 'button "d6: Empty, wall boundaries: bottom" [disabled] [ref=e136]'
              - 'button "e6: Empty" [disabled] [ref=e137]'
              - 'button "f6: Empty" [disabled] [ref=e138]'
              - 'button "g6: Empty" [disabled] [ref=e139]'
              - 'button "h6: Empty" [disabled] [ref=e140]'
              - 'button "i6: Empty" [disabled] [ref=e141]'
              - generic [ref=e142]: "5"
              - 'button "a5: Empty, wall boundaries: right" [disabled] [ref=e143]'
              - 'button "b5: Empty, wall boundaries: left" [disabled] [ref=e144]'
              - 'button "c5: Empty, wall boundaries: top" [disabled] [ref=e145]'
              - 'button "d5: Empty, wall boundaries: top" [disabled] [ref=e146]'
              - 'button "e5: Central hill" [disabled] [ref=e147]':
                - generic: ◎
              - 'button "f5: Empty" [disabled] [ref=e148]'
              - 'button "g5: Empty" [disabled] [ref=e149]'
              - 'button "h5: Empty" [disabled] [ref=e150]'
              - 'button "i5: East black square" [disabled] [ref=e151]':
                - generic: ■
              - generic [ref=e152]: "4"
              - 'button "a4: Empty, wall boundaries: bottom" [disabled] [ref=e153]'
              - 'button "b4: Empty, wall boundaries: bottom" [disabled] [ref=e154]'
              - 'button "c4: Empty" [disabled] [ref=e155]'
              - 'button "d4: Empty" [disabled] [ref=e156]'
              - 'button "e4: North green triangle" [disabled] [ref=e157]':
                - generic: ▲
              - 'button "f4: Empty" [disabled] [ref=e158]'
              - 'button "g4: Empty, wall boundaries: bottom" [disabled] [ref=e159]'
              - 'button "h4: Empty, wall boundaries: bottom" [disabled] [ref=e160]'
              - 'button "i4: Empty" [disabled] [ref=e161]'
              - generic [ref=e162]: "3"
              - 'button "a3: Empty, wall boundaries: top" [disabled] [ref=e163]'
              - 'button "b3: Empty, wall boundaries: top" [disabled] [ref=e164]'
              - 'button "c3: Empty" [disabled] [ref=e165]'
              - 'button "d3: Empty, wall boundaries: right" [disabled] [ref=e166]'
              - 'button "e3: West gold diamond, wall boundaries: left, right" [disabled] [ref=e167]':
                - generic: ◆
              - 'button "f3: Empty, wall boundaries: left" [disabled] [ref=e168]'
              - 'button "g3: Empty, wall boundaries: top" [disabled] [ref=e169]'
              - 'button "h3: Empty, wall boundaries: top" [disabled] [ref=e170]'
              - 'button "i3: Empty" [disabled] [ref=e171]'
              - generic [ref=e172]: "2"
              - 'button "a2: Empty, wall boundaries: bottom" [disabled] [ref=e173]'
              - 'button "b2: Empty, wall boundaries: bottom" [disabled] [ref=e174]'
              - 'button "c2: Empty" [disabled] [ref=e175]'
              - 'button "d2: Empty, wall boundaries: right, bottom" [disabled] [ref=e176]'
              - 'button "e2: South red circle, wall boundaries: left, right, bottom" [disabled] [ref=e177]':
                - generic: ●
              - 'button "f2: Empty, wall boundaries: left" [disabled] [ref=e178]'
              - 'button "g2: Empty, wall boundaries: bottom" [disabled] [ref=e179]'
              - 'button "h2: Empty, wall boundaries: bottom" [disabled] [ref=e180]'
              - 'button "i2: Empty" [disabled] [ref=e181]'
              - generic [ref=e182]: "1"
              - 'button "a1: Empty, wall boundaries: top" [disabled] [ref=e183]'
              - 'button "b1: Empty, wall boundaries: top" [disabled] [ref=e184]'
              - 'button "c1: Empty" [disabled] [ref=e185]'
              - 'button "d1: Empty, wall boundaries: top" [disabled] [ref=e186]'
              - 'button "e1: Empty, wall boundaries: top" [disabled] [ref=e187]'
              - 'button "f1: Empty" [disabled] [ref=e188]'
              - 'button "g1: Empty, wall boundaries: top" [disabled] [ref=e189]'
              - 'button "h1: Empty, wall boundaries: top" [disabled] [ref=e190]'
              - 'button "i1: Empty" [disabled] [ref=e191]'
            - status [ref=e192]: No legal move or wall. Pass to continue.
          - status [ref=e194]:
            - generic [ref=e195]:
              - generic [ref=e196]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
              - text: Your turn. First to e5 wins.
        - generic [ref=e199]:
          - group "Game actions" [ref=e200]:
            - button "Offer draw" [ref=e201] [cursor=pointer]:
              - paragraph [ref=e204]: Offer draw
            - button "Resign game" [ref=e205] [cursor=pointer]:
              - paragraph [ref=e208]:
                - text: Resign
                - generic [ref=e209]: game
          - button "History and stats" [ref=e210] [cursor=pointer]:
            - generic [ref=e212]:
              - paragraph [ref=e213]: History and stats
              - img [ref=e216]
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