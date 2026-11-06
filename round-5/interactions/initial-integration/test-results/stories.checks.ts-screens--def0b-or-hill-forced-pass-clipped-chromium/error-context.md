# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--pass-and-continue regression quoridor-hill-forced-pass-clipped
- Location: tests/storybook/stories.checks.ts:156:1

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  58415 pixels (ratio 0.18 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/pass-and-continue-light.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/pass-and-continue-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 58415 pixels (ratio 0.18 of all image pixels) are different.
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
  - 58415 pixels (ratio 0.18 of all image pixels) are different.

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
        - heading "jordan_plays wins" [level=2] [ref=e25]
        - group "What next" [ref=e26]:
          - button "Rematch" [ref=e27] [cursor=pointer]:
            - paragraph [ref=e30]: Rematch
          - button "Change game" [ref=e31] [cursor=pointer]:
            - paragraph [ref=e34]: Change game
          - button "Review" [ref=e35] [cursor=pointer]:
            - paragraph [ref=e38]: Review
      - generic [ref=e41]:
        - paragraph [ref=e44]: Final
        - list "Moves played" [ref=e49]:
          - listitem [ref=e50]:
            - generic [ref=e51]: Move 9
            - generic [ref=e52]:
              - generic [ref=e54]: ●
              - 'button "Move 33, South red circle: pass" [ref=e55] [cursor=pointer]': pass
            - generic [ref=e56]:
              - generic [ref=e58]: ◆
              - 'button "Move 34, West gold diamond: e5" [ref=e59] [cursor=pointer]': e5
        - button "All moves" [ref=e60] [cursor=pointer]:
          - img [ref=e64]
      - generic [ref=e66]:
        - generic [ref=e68]:
          - list "Players" [ref=e70]:
            - generic "morgan" [ref=e71]:
              - listitem [ref=e72]:
                - generic [ref=e75]:
                  - generic [ref=e76]: morgan
                  - generic [ref=e77]:
                    - generic [ref=e79]: ▲
                    - generic [ref=e80]: Walls 4
                    - generic [ref=e82]: You
            - generic "avery" [ref=e83]:
              - listitem [ref=e84]:
                - generic [ref=e86]:
                  - generic [ref=e87]: avery
                  - generic [ref=e88]:
                    - generic [ref=e90]: ●
                    - generic [ref=e91]: Walls 0
            - generic "jordan_plays" [ref=e92]:
              - listitem [ref=e93]:
                - generic [ref=e95]:
                  - generic [ref=e96]: jordan_plays
                  - generic [ref=e97]:
                    - generic [ref=e99]: ◆
                    - generic [ref=e100]: Walls 3
            - generic "robin_42" [ref=e101]:
              - listitem [ref=e102]:
                - generic [ref=e104]:
                  - generic [ref=e105]: robin_42
                  - generic [ref=e106]:
                    - generic [ref=e108]: ■
                    - generic [ref=e109]: Walls 1
          - generic [ref=e111]:
            - generic [ref=e112]:
              - button "Move pawn" [disabled] [pressed] [ref=e113]:
                - paragraph [ref=e116]: Move pawn
              - button "Horizontal wall" [disabled] [ref=e117]:
                - paragraph [ref=e120]: Horizontal wall
              - button "Vertical wall" [disabled] [ref=e121]:
                - paragraph [ref=e124]: Vertical wall
            - group "Quoridor board, nine columns and nine rows" [ref=e125]:
              - generic [ref=e127]: a
              - generic [ref=e128]: b
              - generic [ref=e129]: c
              - generic [ref=e130]: d
              - generic [ref=e131]: e
              - generic [ref=e132]: f
              - generic [ref=e133]: g
              - generic [ref=e134]: h
              - generic [ref=e135]: i
              - generic [ref=e136]: "9"
              - 'button "a9: Empty" [disabled] [ref=e137]'
              - 'button "b9: Empty" [disabled] [ref=e138]'
              - 'button "c9: Empty" [disabled] [ref=e139]'
              - 'button "d9: Empty" [disabled] [ref=e140]'
              - 'button "e9: Empty" [disabled] [ref=e141]'
              - 'button "f9: Empty" [disabled] [ref=e142]'
              - 'button "g9: Empty" [disabled] [ref=e143]'
              - 'button "h9: Empty" [disabled] [ref=e144]'
              - 'button "i9: Empty" [disabled] [ref=e145]'
              - generic [ref=e146]: "8"
              - 'button "a8: Empty, wall boundaries: right" [disabled] [ref=e147]'
              - 'button "b8: Empty, wall boundaries: left" [disabled] [ref=e148]'
              - 'button "c8: Empty, wall boundaries: bottom" [disabled] [ref=e149]'
              - 'button "d8: Empty, wall boundaries: bottom" [disabled] [ref=e150]'
              - 'button "e8: Empty" [disabled] [ref=e151]'
              - 'button "f8: Empty, wall boundaries: bottom" [disabled] [ref=e152]'
              - 'button "g8: Empty, wall boundaries: bottom" [disabled] [ref=e153]'
              - 'button "h8: Empty" [disabled] [ref=e154]'
              - 'button "i8: Empty" [disabled] [ref=e155]'
              - generic [ref=e156]: "7"
              - 'button "a7: Empty, wall boundaries: right" [disabled] [ref=e157]'
              - 'button "b7: Empty, wall boundaries: left" [disabled] [ref=e158]'
              - 'button "c7: Empty, wall boundaries: top" [disabled] [ref=e159]'
              - 'button "d7: Empty, wall boundaries: top" [disabled] [ref=e160]'
              - 'button "e7: Empty" [disabled] [ref=e161]'
              - 'button "f7: Empty, wall boundaries: top" [disabled] [ref=e162]'
              - 'button "g7: Empty, wall boundaries: top" [disabled] [ref=e163]'
              - 'button "h7: Empty" [disabled] [ref=e164]'
              - 'button "i7: Empty" [disabled] [ref=e165]'
              - generic [ref=e166]: "6"
              - 'button "a6: Empty, wall boundaries: right" [disabled] [ref=e167]'
              - 'button "b6: Empty, wall boundaries: left" [disabled] [ref=e168]'
              - 'button "c6: Empty, wall boundaries: bottom" [disabled] [ref=e169]'
              - 'button "d6: Empty, wall boundaries: bottom" [disabled] [ref=e170]'
              - 'button "e6: Empty" [disabled] [ref=e171]'
              - 'button "f6: Empty" [disabled] [ref=e172]'
              - 'button "g6: Empty" [disabled] [ref=e173]'
              - 'button "h6: Empty" [disabled] [ref=e174]'
              - 'button "i6: Empty" [disabled] [ref=e175]'
              - generic [ref=e176]: "5"
              - 'button "a5: Empty, wall boundaries: right" [disabled] [ref=e177]'
              - 'button "b5: Empty, wall boundaries: left" [disabled] [ref=e178]'
              - 'button "c5: Empty, wall boundaries: top" [disabled] [ref=e179]'
              - 'button "d5: Empty, wall boundaries: top" [disabled] [ref=e180]'
              - 'button "e5: West gold diamond, center goal" [disabled] [ref=e181]':
                - generic: ◆
              - 'button "f5: Empty" [disabled] [ref=e182]'
              - 'button "g5: Empty" [disabled] [ref=e183]'
              - 'button "h5: Empty" [disabled] [ref=e184]'
              - 'button "i5: East black square" [disabled] [ref=e185]':
                - generic: ■
              - generic [ref=e186]: "4"
              - 'button "a4: Empty, wall boundaries: bottom" [disabled] [ref=e187]'
              - 'button "b4: Empty, wall boundaries: bottom" [disabled] [ref=e188]'
              - 'button "c4: Empty" [disabled] [ref=e189]'
              - 'button "d4: Empty" [disabled] [ref=e190]'
              - 'button "e4: North green triangle" [disabled] [ref=e191]':
                - generic: ▲
              - 'button "f4: Empty" [disabled] [ref=e192]'
              - 'button "g4: Empty, wall boundaries: bottom" [disabled] [ref=e193]'
              - 'button "h4: Empty, wall boundaries: bottom" [disabled] [ref=e194]'
              - 'button "i4: Empty" [disabled] [ref=e195]'
              - generic [ref=e196]: "3"
              - 'button "a3: Empty, wall boundaries: top" [disabled] [ref=e197]'
              - 'button "b3: Empty, wall boundaries: top" [disabled] [ref=e198]'
              - 'button "c3: Empty" [disabled] [ref=e199]'
              - 'button "d3: Empty, wall boundaries: right" [disabled] [ref=e200]'
              - 'button "e3: Empty, wall boundaries: left, right" [disabled] [ref=e201]'
              - 'button "f3: Empty, wall boundaries: left" [disabled] [ref=e202]'
              - 'button "g3: Empty, wall boundaries: top" [disabled] [ref=e203]'
              - 'button "h3: Empty, wall boundaries: top" [disabled] [ref=e204]'
              - 'button "i3: Empty" [disabled] [ref=e205]'
              - generic [ref=e206]: "2"
              - 'button "a2: Empty, wall boundaries: bottom" [disabled] [ref=e207]'
              - 'button "b2: Empty, wall boundaries: bottom" [disabled] [ref=e208]'
              - 'button "c2: Empty" [disabled] [ref=e209]'
              - 'button "d2: Empty, wall boundaries: right, bottom" [disabled] [ref=e210]'
              - 'button "e2: South red circle, wall boundaries: left, right, bottom" [disabled] [ref=e211]':
                - generic: ●
              - 'button "f2: Empty, wall boundaries: left" [disabled] [ref=e212]'
              - 'button "g2: Empty, wall boundaries: bottom" [disabled] [ref=e213]'
              - 'button "h2: Empty, wall boundaries: bottom" [disabled] [ref=e214]'
              - 'button "i2: Empty" [disabled] [ref=e215]'
              - generic [ref=e216]: "1"
              - 'button "a1: Empty, wall boundaries: top" [disabled] [ref=e217]'
              - 'button "b1: Empty, wall boundaries: top" [disabled] [ref=e218]'
              - 'button "c1: Empty" [disabled] [ref=e219]'
              - 'button "d1: Empty, wall boundaries: top" [disabled] [ref=e220]'
              - 'button "e1: Empty, wall boundaries: top" [disabled] [ref=e221]'
              - 'button "f1: Empty" [disabled] [ref=e222]'
              - 'button "g1: Empty, wall boundaries: top" [disabled] [ref=e223]'
              - 'button "h1: Empty, wall boundaries: top" [disabled] [ref=e224]'
              - 'button "i1: Empty" [disabled] [ref=e225]'
            - status [ref=e226]: Game finished. Use the game controls to review earlier moves.
          - status [ref=e228]:
            - generic [ref=e229]:
              - generic [ref=e230]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
              - text: The central hill was reached. Game won.
        - generic [ref=e231]:
          - list "Standings" [ref=e233]:
            - listitem [ref=e234]:
              - generic [ref=e235]:
                - generic [ref=e236]: 1st
                - generic [ref=e239]: jordan_plays
            - listitem [ref=e240]:
              - generic [ref=e241]:
                - generic [ref=e242]: 2nd
                - generic [ref=e245]: avery
            - listitem [ref=e246]:
              - generic [ref=e247]:
                - generic [ref=e248]: 2nd
                - generic [ref=e251]: morgan
            - listitem [ref=e252]:
              - generic [ref=e253]:
                - generic [ref=e254]: 2nd
                - generic [ref=e257]: robin_42
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