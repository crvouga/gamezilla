# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--pass-and-continue light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  29199 pixels (ratio 0.09 of all image pixels) are different.

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
  - 29199 pixels (ratio 0.09 of all image pixels) are different.
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
  - 29199 pixels (ratio 0.09 of all image pixels) are different.

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
      - generic [ref=e24]:
        - paragraph [ref=e27]: Live
        - list "Moves played" [ref=e32]:
          - listitem [ref=e33]:
            - generic [ref=e34]: Move 9
            - generic [ref=e35]:
              - generic [ref=e37]: ●
              - 'button "Move 33, South red circle: pass" [ref=e38] [cursor=pointer]': pass
            - generic [ref=e39]:
              - generic [ref=e41]: ◆
              - 'button "Move 34, West gold diamond: e5" [ref=e42] [cursor=pointer]': e5
        - button "All moves" [ref=e43] [cursor=pointer]:
          - img [ref=e47]
      - generic [ref=e49]:
        - generic [ref=e51]:
          - list "Players" [ref=e52]:
            - listitem [ref=e53]:
              - generic [ref=e58]:
                - generic [ref=e59]: morgan
                - generic [ref=e60]:
                  - generic [ref=e62]: ▲
                  - generic [ref=e63]: Walls 4
                  - generic [ref=e65]: You
            - listitem [ref=e66]:
              - generic [ref=e70]:
                - generic [ref=e71]: avery
                - generic [ref=e72]:
                  - generic [ref=e74]: ●
                  - generic [ref=e75]: Walls 0
            - listitem [ref=e76]:
              - generic [ref=e80]:
                - generic [ref=e81]: jordan_plays
                - generic [ref=e82]:
                  - generic [ref=e84]: ◆
                  - generic [ref=e85]: Walls 3
            - listitem [ref=e86]:
              - generic [ref=e90]:
                - generic [ref=e91]: robin_42
                - generic [ref=e92]:
                  - generic [ref=e94]: ■
                  - generic [ref=e95]: Walls 1
          - generic [ref=e97]:
            - generic [ref=e98]:
              - button "Move pawn" [disabled] [pressed] [ref=e99]:
                - paragraph [ref=e102]: Move pawn
              - button "Horizontal wall" [disabled] [ref=e103]:
                - paragraph [ref=e106]: Wall across
              - button "Vertical wall" [disabled] [ref=e107]:
                - paragraph [ref=e110]: Wall down
            - group "Quoridor board, nine columns and nine rows" [ref=e111]:
              - generic [ref=e113]: a
              - generic [ref=e114]: b
              - generic [ref=e115]: c
              - generic [ref=e116]: d
              - generic [ref=e117]: e
              - generic [ref=e118]: f
              - generic [ref=e119]: g
              - generic [ref=e120]: h
              - generic [ref=e121]: i
              - generic [ref=e122]: "9"
              - 'button "a9: Empty" [disabled] [ref=e123]'
              - 'button "b9: Empty" [disabled] [ref=e124]'
              - 'button "c9: Empty" [disabled] [ref=e125]'
              - 'button "d9: Empty" [disabled] [ref=e126]'
              - 'button "e9: Empty" [disabled] [ref=e127]'
              - 'button "f9: Empty" [disabled] [ref=e128]'
              - 'button "g9: Empty" [disabled] [ref=e129]'
              - 'button "h9: Empty" [disabled] [ref=e130]'
              - 'button "i9: Empty" [disabled] [ref=e131]'
              - generic [ref=e132]: "8"
              - 'button "a8: Empty, wall boundaries: right" [disabled] [ref=e133]'
              - 'button "b8: Empty, wall boundaries: left" [disabled] [ref=e134]'
              - 'button "c8: Empty, wall boundaries: bottom" [disabled] [ref=e135]'
              - 'button "d8: Empty, wall boundaries: bottom" [disabled] [ref=e136]'
              - 'button "e8: Empty" [disabled] [ref=e137]'
              - 'button "f8: Empty, wall boundaries: bottom" [disabled] [ref=e138]'
              - 'button "g8: Empty, wall boundaries: bottom" [disabled] [ref=e139]'
              - 'button "h8: Empty" [disabled] [ref=e140]'
              - 'button "i8: Empty" [disabled] [ref=e141]'
              - generic [ref=e142]: "7"
              - 'button "a7: Empty, wall boundaries: right" [disabled] [ref=e143]'
              - 'button "b7: Empty, wall boundaries: left" [disabled] [ref=e144]'
              - 'button "c7: Empty, wall boundaries: top" [disabled] [ref=e145]'
              - 'button "d7: Empty, wall boundaries: top" [disabled] [ref=e146]'
              - 'button "e7: Empty" [disabled] [ref=e147]'
              - 'button "f7: Empty, wall boundaries: top" [disabled] [ref=e148]'
              - 'button "g7: Empty, wall boundaries: top" [disabled] [ref=e149]'
              - 'button "h7: Empty" [disabled] [ref=e150]'
              - 'button "i7: Empty" [disabled] [ref=e151]'
              - generic [ref=e152]: "6"
              - 'button "a6: Empty, wall boundaries: right" [disabled] [ref=e153]'
              - 'button "b6: Empty, wall boundaries: left" [disabled] [ref=e154]'
              - 'button "c6: Empty, wall boundaries: bottom" [disabled] [ref=e155]'
              - 'button "d6: Empty, wall boundaries: bottom" [disabled] [ref=e156]'
              - 'button "e6: Empty" [disabled] [ref=e157]'
              - 'button "f6: Empty" [disabled] [ref=e158]'
              - 'button "g6: Empty" [disabled] [ref=e159]'
              - 'button "h6: Empty" [disabled] [ref=e160]'
              - 'button "i6: Empty" [disabled] [ref=e161]'
              - generic [ref=e162]: "5"
              - 'button "a5: Empty, wall boundaries: right" [disabled] [ref=e163]'
              - 'button "b5: Empty, wall boundaries: left" [disabled] [ref=e164]'
              - 'button "c5: Empty, wall boundaries: top" [disabled] [ref=e165]'
              - 'button "d5: Empty, wall boundaries: top" [disabled] [ref=e166]'
              - 'button "e5: West gold diamond" [disabled] [ref=e167]':
                - generic: ◆
              - 'button "f5: Empty" [disabled] [ref=e168]'
              - 'button "g5: Empty" [disabled] [ref=e169]'
              - 'button "h5: Empty" [disabled] [ref=e170]'
              - 'button "i5: East black square" [disabled] [ref=e171]':
                - generic: ■
              - generic [ref=e172]: "4"
              - 'button "a4: Empty, wall boundaries: bottom" [disabled] [ref=e173]'
              - 'button "b4: Empty, wall boundaries: bottom" [disabled] [ref=e174]'
              - 'button "c4: Empty" [disabled] [ref=e175]'
              - 'button "d4: Empty" [disabled] [ref=e176]'
              - 'button "e4: North green triangle" [disabled] [ref=e177]':
                - generic: ▲
              - 'button "f4: Empty" [disabled] [ref=e178]'
              - 'button "g4: Empty, wall boundaries: bottom" [disabled] [ref=e179]'
              - 'button "h4: Empty, wall boundaries: bottom" [disabled] [ref=e180]'
              - 'button "i4: Empty" [disabled] [ref=e181]'
              - generic [ref=e182]: "3"
              - 'button "a3: Empty, wall boundaries: top" [disabled] [ref=e183]'
              - 'button "b3: Empty, wall boundaries: top" [disabled] [ref=e184]'
              - 'button "c3: Empty" [disabled] [ref=e185]'
              - 'button "d3: Empty, wall boundaries: right" [disabled] [ref=e186]'
              - 'button "e3: Empty, wall boundaries: left, right" [disabled] [ref=e187]'
              - 'button "f3: Empty, wall boundaries: left" [disabled] [ref=e188]'
              - 'button "g3: Empty, wall boundaries: top" [disabled] [ref=e189]'
              - 'button "h3: Empty, wall boundaries: top" [disabled] [ref=e190]'
              - 'button "i3: Empty" [disabled] [ref=e191]'
              - generic [ref=e192]: "2"
              - 'button "a2: Empty, wall boundaries: bottom" [disabled] [ref=e193]'
              - 'button "b2: Empty, wall boundaries: bottom" [disabled] [ref=e194]'
              - 'button "c2: Empty" [disabled] [ref=e195]'
              - 'button "d2: Empty, wall boundaries: right, bottom" [disabled] [ref=e196]'
              - 'button "e2: South red circle, wall boundaries: left, right, bottom" [disabled] [ref=e197]':
                - generic: ●
              - 'button "f2: Empty, wall boundaries: left" [disabled] [ref=e198]'
              - 'button "g2: Empty, wall boundaries: bottom" [disabled] [ref=e199]'
              - 'button "h2: Empty, wall boundaries: bottom" [disabled] [ref=e200]'
              - 'button "i2: Empty" [disabled] [ref=e201]'
              - generic [ref=e202]: "1"
              - 'button "a1: Empty, wall boundaries: top" [disabled] [ref=e203]'
              - 'button "b1: Empty, wall boundaries: top" [disabled] [ref=e204]'
              - 'button "c1: Empty" [disabled] [ref=e205]'
              - 'button "d1: Empty, wall boundaries: top" [disabled] [ref=e206]'
              - 'button "e1: Empty, wall boundaries: top" [disabled] [ref=e207]'
              - 'button "f1: Empty" [disabled] [ref=e208]'
              - 'button "g1: Empty, wall boundaries: top" [disabled] [ref=e209]'
              - 'button "h1: Empty, wall boundaries: top" [disabled] [ref=e210]'
              - 'button "i1: Empty" [disabled] [ref=e211]'
            - status [ref=e212]: Game finished. Use the game controls to review earlier moves.
          - status [ref=e216]:
            - generic [ref=e217]:
              - generic [ref=e218]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
              - text: The central hill was reached. Game won.
        - generic [ref=e219]:
          - generic [ref=e220]:
            - heading "jordan_plays wins" [level=2] [ref=e222]
            - list "Standings" [ref=e223]:
              - listitem [ref=e224]:
                - generic [ref=e225]:
                  - generic [ref=e226]: 1st
                  - generic [ref=e229]: jordan_plays
              - listitem [ref=e230]:
                - generic [ref=e231]:
                  - generic [ref=e232]: 2nd
                  - generic [ref=e235]: avery
              - listitem [ref=e236]:
                - generic [ref=e237]:
                  - generic [ref=e238]: 2nd
                  - generic [ref=e241]: morgan
              - listitem [ref=e242]:
                - generic [ref=e243]:
                  - generic [ref=e244]: 2nd
                  - generic [ref=e247]: robin_42
          - generic [ref=e249]:
            - group "What next" [ref=e250]:
              - button "Rematch" [ref=e251] [cursor=pointer]:
                - paragraph [ref=e254]: Rematch
              - button "Change game" [ref=e255] [cursor=pointer]:
                - paragraph [ref=e258]: Change game
              - button "Review" [ref=e259] [cursor=pointer]:
                - paragraph [ref=e262]: Review
            - button "History and stats" [ref=e263] [cursor=pointer]:
              - generic [ref=e265]:
                - paragraph [ref=e266]: History and stats
                - img [ref=e269]
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