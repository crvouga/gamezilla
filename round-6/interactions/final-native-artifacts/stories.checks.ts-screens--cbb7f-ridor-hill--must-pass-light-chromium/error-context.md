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
  45068 pixels (ratio 0.14 of all image pixels) are different.

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
  - 45068 pixels (ratio 0.14 of all image pixels) are different.
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
  - 45068 pixels (ratio 0.14 of all image pixels) are different.

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
          - paragraph [ref=e30]: No moves yet.
          - button "All moves" [ref=e31] [cursor=pointer]:
            - img [ref=e35]
      - generic [ref=e37]:
        - generic [ref=e39]:
          - list "Players" [ref=e41]:
            - generic "avery" [ref=e42]:
              - listitem [ref=e43]:
                - generic [ref=e46]:
                  - generic [ref=e47]: avery
                  - generic [ref=e48]:
                    - generic [ref=e50]: ●
                    - generic [ref=e51]: Walls 0
                    - generic [ref=e53]: You
            - generic "jordan_plays" [ref=e54]:
              - listitem [ref=e55]:
                - generic [ref=e57]:
                  - generic [ref=e58]: jordan_plays
                  - generic [ref=e59]:
                    - generic [ref=e61]: ◆
                    - generic [ref=e62]: Walls 3
            - generic "morgan" [ref=e63]:
              - listitem [ref=e64]:
                - generic [ref=e66]:
                  - generic [ref=e67]: morgan
                  - generic [ref=e68]:
                    - generic [ref=e70]: ▲
                    - generic [ref=e71]: Walls 4
            - generic "robin_42" [ref=e72]:
              - listitem [ref=e73]:
                - generic [ref=e75]:
                  - generic [ref=e76]: robin_42
                  - generic [ref=e77]:
                    - generic [ref=e79]: ■
                    - generic [ref=e80]: Walls 1
          - generic [ref=e82]:
            - button "No legal move or wall — pass turn" [ref=e84] [cursor=pointer]:
              - paragraph [ref=e87]: No legal move or wall — pass turn
            - group "Quoridor board, nine columns and nine rows" [ref=e88]:
              - generic [ref=e90]: a
              - generic [ref=e91]: b
              - generic [ref=e92]: c
              - generic [ref=e93]: d
              - generic [ref=e94]: e
              - generic [ref=e95]: f
              - generic [ref=e96]: g
              - generic [ref=e97]: h
              - generic [ref=e98]: i
              - generic [ref=e99]: "9"
              - 'button "a9: Empty" [disabled] [ref=e100]'
              - 'button "b9: Empty" [disabled] [ref=e101]'
              - 'button "c9: Empty" [disabled] [ref=e102]'
              - 'button "d9: Empty" [disabled] [ref=e103]'
              - 'button "e9: Empty" [disabled] [ref=e104]'
              - 'button "f9: Empty" [disabled] [ref=e105]'
              - 'button "g9: Empty" [disabled] [ref=e106]'
              - 'button "h9: Empty" [disabled] [ref=e107]'
              - 'button "i9: Empty" [disabled] [ref=e108]'
              - generic [ref=e109]: "8"
              - 'button "a8: Empty, wall boundaries: right" [disabled] [ref=e110]'
              - 'button "b8: Empty, wall boundaries: left" [disabled] [ref=e111]'
              - 'button "c8: Empty, wall boundaries: bottom" [disabled] [ref=e112]'
              - 'button "d8: Empty, wall boundaries: bottom" [disabled] [ref=e113]'
              - 'button "e8: Empty" [disabled] [ref=e114]'
              - 'button "f8: Empty, wall boundaries: bottom" [disabled] [ref=e115]'
              - 'button "g8: Empty, wall boundaries: bottom" [disabled] [ref=e116]'
              - 'button "h8: Empty" [disabled] [ref=e117]'
              - 'button "i8: Empty" [disabled] [ref=e118]'
              - generic [ref=e119]: "7"
              - 'button "a7: Empty, wall boundaries: right" [disabled] [ref=e120]'
              - 'button "b7: Empty, wall boundaries: left" [disabled] [ref=e121]'
              - 'button "c7: Empty, wall boundaries: top" [disabled] [ref=e122]'
              - 'button "d7: Empty, wall boundaries: top" [disabled] [ref=e123]'
              - 'button "e7: Empty" [disabled] [ref=e124]'
              - 'button "f7: Empty, wall boundaries: top" [disabled] [ref=e125]'
              - 'button "g7: Empty, wall boundaries: top" [disabled] [ref=e126]'
              - 'button "h7: Empty" [disabled] [ref=e127]'
              - 'button "i7: Empty" [disabled] [ref=e128]'
              - generic [ref=e129]: "6"
              - 'button "a6: Empty, wall boundaries: right" [disabled] [ref=e130]'
              - 'button "b6: Empty, wall boundaries: left" [disabled] [ref=e131]'
              - 'button "c6: Empty, wall boundaries: bottom" [disabled] [ref=e132]'
              - 'button "d6: Empty, wall boundaries: bottom" [disabled] [ref=e133]'
              - 'button "e6: Empty" [disabled] [ref=e134]'
              - 'button "f6: Empty" [disabled] [ref=e135]'
              - 'button "g6: Empty" [disabled] [ref=e136]'
              - 'button "h6: Empty" [disabled] [ref=e137]'
              - 'button "i6: Empty" [disabled] [ref=e138]'
              - generic [ref=e139]: "5"
              - 'button "a5: Empty, wall boundaries: right" [disabled] [ref=e140]'
              - 'button "b5: Empty, wall boundaries: left" [disabled] [ref=e141]'
              - 'button "c5: Empty, wall boundaries: top" [disabled] [ref=e142]'
              - 'button "d5: Empty, wall boundaries: top" [disabled] [ref=e143]'
              - 'button "e5: Central hill, center goal" [disabled] [ref=e144]':
                - generic: ★
              - 'button "f5: Empty" [disabled] [ref=e145]'
              - 'button "g5: Empty" [disabled] [ref=e146]'
              - 'button "h5: Empty" [disabled] [ref=e147]'
              - 'button "i5: East black square" [disabled] [ref=e148]':
                - generic: ■
              - generic [ref=e149]: "4"
              - 'button "a4: Empty, wall boundaries: bottom" [disabled] [ref=e150]'
              - 'button "b4: Empty, wall boundaries: bottom" [disabled] [ref=e151]'
              - 'button "c4: Empty" [disabled] [ref=e152]'
              - 'button "d4: Empty" [disabled] [ref=e153]'
              - 'button "e4: North green triangle" [disabled] [ref=e154]':
                - generic: ▲
              - 'button "f4: Empty" [disabled] [ref=e155]'
              - 'button "g4: Empty, wall boundaries: bottom" [disabled] [ref=e156]'
              - 'button "h4: Empty, wall boundaries: bottom" [disabled] [ref=e157]'
              - 'button "i4: Empty" [disabled] [ref=e158]'
              - generic [ref=e159]: "3"
              - 'button "a3: Empty, wall boundaries: top" [disabled] [ref=e160]'
              - 'button "b3: Empty, wall boundaries: top" [disabled] [ref=e161]'
              - 'button "c3: Empty" [disabled] [ref=e162]'
              - 'button "d3: Empty, wall boundaries: right" [disabled] [ref=e163]'
              - 'button "e3: West gold diamond, wall boundaries: left, right" [disabled] [ref=e164]':
                - generic: ◆
              - 'button "f3: Empty, wall boundaries: left" [disabled] [ref=e165]'
              - 'button "g3: Empty, wall boundaries: top" [disabled] [ref=e166]'
              - 'button "h3: Empty, wall boundaries: top" [disabled] [ref=e167]'
              - 'button "i3: Empty" [disabled] [ref=e168]'
              - generic [ref=e169]: "2"
              - 'button "a2: Empty, wall boundaries: bottom" [disabled] [ref=e170]'
              - 'button "b2: Empty, wall boundaries: bottom" [disabled] [ref=e171]'
              - 'button "c2: Empty" [disabled] [ref=e172]'
              - 'button "d2: Empty, wall boundaries: right, bottom" [disabled] [ref=e173]'
              - 'button "e2: South red circle, wall boundaries: left, right, bottom" [disabled] [ref=e174]':
                - generic: ●
              - 'button "f2: Empty, wall boundaries: left" [disabled] [ref=e175]'
              - 'button "g2: Empty, wall boundaries: bottom" [disabled] [ref=e176]'
              - 'button "h2: Empty, wall boundaries: bottom" [disabled] [ref=e177]'
              - 'button "i2: Empty" [disabled] [ref=e178]'
              - generic [ref=e179]: "1"
              - 'button "a1: Empty, wall boundaries: top" [disabled] [ref=e180]'
              - 'button "b1: Empty, wall boundaries: top" [disabled] [ref=e181]'
              - 'button "c1: Empty" [disabled] [ref=e182]'
              - 'button "d1: Empty, wall boundaries: top" [disabled] [ref=e183]'
              - 'button "e1: Empty, wall boundaries: top" [disabled] [ref=e184]'
              - 'button "f1: Empty" [disabled] [ref=e185]'
              - 'button "g1: Empty, wall boundaries: top" [disabled] [ref=e186]'
              - 'button "h1: Empty, wall boundaries: top" [disabled] [ref=e187]'
              - 'button "i1: Empty" [disabled] [ref=e188]'
            - status [ref=e189]: No legal move or wall. Pass to continue.
          - status [ref=e191]:
            - generic [ref=e192]:
              - generic [ref=e193]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
              - text: Your turn. Reach the center hill (e5) first.
        - generic [ref=e196]:
          - group "Game actions" [ref=e197]:
            - button "Offer draw" [ref=e198] [cursor=pointer]:
              - paragraph [ref=e201]: Offer draw
            - button "Resign game" [ref=e202] [cursor=pointer]:
              - paragraph [ref=e205]:
                - text: Resign
                - generic [ref=e206]: game
          - button "History and stats" [ref=e207] [cursor=pointer]:
            - generic [ref=e209]:
              - paragraph [ref=e210]: History and stats
              - img [ref=e213]
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