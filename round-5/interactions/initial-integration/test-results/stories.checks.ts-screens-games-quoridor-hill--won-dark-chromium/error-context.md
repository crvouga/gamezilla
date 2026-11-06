# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--won dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  144172 pixels (ratio 0.44 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/won-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/won-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 144172 pixels (ratio 0.44 of all image pixels) are different.
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
  - 144172 pixels (ratio 0.44 of all image pixels) are different.

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
        - heading "You win" [level=2] [ref=e25]
        - group "What next" [ref=e26]:
          - button "Rematch" [ref=e27] [cursor=pointer]:
            - paragraph [ref=e30]: Rematch
          - button "Change game" [ref=e31] [cursor=pointer]:
            - paragraph [ref=e34]: Change game
          - button "Review" [ref=e35] [cursor=pointer]:
            - paragraph [ref=e38]: Review
      - generic [ref=e41]:
        - paragraph [ref=e46]: No moves yet.
        - button "All moves" [ref=e47] [cursor=pointer]:
          - img [ref=e51]
      - generic [ref=e53]:
        - generic [ref=e55]:
          - list "Players" [ref=e57]:
            - generic "avery" [ref=e58]:
              - listitem [ref=e59]:
                - generic [ref=e62]:
                  - generic [ref=e63]: avery
                  - generic [ref=e64]:
                    - generic [ref=e66]: ●
                    - generic [ref=e67]: Walls 5
                    - generic [ref=e69]: You
            - generic "jordan_plays" [ref=e70]:
              - listitem [ref=e71]:
                - generic [ref=e73]:
                  - generic [ref=e74]: jordan_plays
                  - generic [ref=e75]:
                    - generic [ref=e77]: ◆
                    - generic [ref=e78]: Walls 5
            - generic "morgan" [ref=e79]:
              - listitem [ref=e80]:
                - generic [ref=e82]:
                  - generic [ref=e83]: morgan
                  - generic [ref=e84]:
                    - generic [ref=e86]: ▲
                    - generic [ref=e87]: Walls 5
            - generic "robin_42" [ref=e88]:
              - listitem [ref=e89]:
                - generic [ref=e91]:
                  - generic [ref=e92]: robin_42
                  - generic [ref=e93]:
                    - generic [ref=e95]: ■
                    - generic [ref=e96]: Walls 5
          - generic [ref=e98]:
            - generic [ref=e99]:
              - button "Move pawn" [disabled] [pressed] [ref=e100]:
                - paragraph [ref=e103]: Move pawn
              - button "Horizontal wall" [disabled] [ref=e104]:
                - paragraph [ref=e107]: Horizontal wall
              - button "Vertical wall" [disabled] [ref=e108]:
                - paragraph [ref=e111]: Vertical wall
            - group "Quoridor board, nine columns and nine rows" [ref=e112]:
              - generic [ref=e114]: a
              - generic [ref=e115]: b
              - generic [ref=e116]: c
              - generic [ref=e117]: d
              - generic [ref=e118]: e
              - generic [ref=e119]: f
              - generic [ref=e120]: g
              - generic [ref=e121]: h
              - generic [ref=e122]: i
              - generic [ref=e123]: "9"
              - 'button "a9: Empty" [disabled] [ref=e124]'
              - 'button "b9: Empty" [disabled] [ref=e125]'
              - 'button "c9: Empty" [disabled] [ref=e126]'
              - 'button "d9: Empty" [disabled] [ref=e127]'
              - 'button "e9: Empty" [disabled] [ref=e128]'
              - 'button "f9: Empty" [disabled] [ref=e129]'
              - 'button "g9: Empty" [disabled] [ref=e130]'
              - 'button "h9: Empty" [disabled] [ref=e131]'
              - 'button "i9: Empty" [disabled] [ref=e132]'
              - generic [ref=e133]: "8"
              - 'button "a8: Empty" [disabled] [ref=e134]'
              - 'button "b8: Empty" [disabled] [ref=e135]'
              - 'button "c8: North green triangle" [disabled] [ref=e136]':
                - generic: ▲
              - 'button "d8: Empty" [disabled] [ref=e137]'
              - 'button "e8: Empty" [disabled] [ref=e138]'
              - 'button "f8: Empty" [disabled] [ref=e139]'
              - 'button "g8: Empty" [disabled] [ref=e140]'
              - 'button "h8: Empty" [disabled] [ref=e141]'
              - 'button "i8: East black square" [disabled] [ref=e142]':
                - generic: ■
              - generic [ref=e143]: "7"
              - 'button "a7: Empty" [disabled] [ref=e144]'
              - 'button "b7: Empty" [disabled] [ref=e145]'
              - 'button "c7: Empty" [disabled] [ref=e146]'
              - 'button "d7: Empty" [disabled] [ref=e147]'
              - 'button "e7: Empty" [disabled] [ref=e148]'
              - 'button "f7: Empty" [disabled] [ref=e149]'
              - 'button "g7: Empty" [disabled] [ref=e150]'
              - 'button "h7: Empty" [disabled] [ref=e151]'
              - 'button "i7: Empty" [disabled] [ref=e152]'
              - generic [ref=e153]: "6"
              - 'button "a6: Empty" [disabled] [ref=e154]'
              - 'button "b6: Empty" [disabled] [ref=e155]'
              - 'button "c6: Empty" [disabled] [ref=e156]'
              - 'button "d6: Empty" [disabled] [ref=e157]'
              - 'button "e6: Empty" [disabled] [ref=e158]'
              - 'button "f6: Empty" [disabled] [ref=e159]'
              - 'button "g6: Empty" [disabled] [ref=e160]'
              - 'button "h6: Empty" [disabled] [ref=e161]'
              - 'button "i6: Empty" [disabled] [ref=e162]'
              - generic [ref=e163]: "5"
              - 'button "a5: Empty" [disabled] [ref=e164]'
              - 'button "b5: Empty" [disabled] [ref=e165]'
              - 'button "c5: Empty" [disabled] [ref=e166]'
              - 'button "d5: Empty" [disabled] [ref=e167]'
              - 'button "e5: South red circle, center goal" [disabled] [ref=e168]':
                - generic: ●
              - 'button "f5: Empty" [disabled] [ref=e169]'
              - 'button "g5: Empty" [disabled] [ref=e170]'
              - 'button "h5: Empty" [disabled] [ref=e171]'
              - 'button "i5: Empty" [disabled] [ref=e172]'
              - generic [ref=e173]: "4"
              - 'button "a4: Empty" [disabled] [ref=e174]'
              - 'button "b4: Empty" [disabled] [ref=e175]'
              - 'button "c4: Empty" [disabled] [ref=e176]'
              - 'button "d4: Empty" [disabled] [ref=e177]'
              - 'button "e4: Empty" [disabled] [ref=e178]'
              - 'button "f4: Empty" [disabled] [ref=e179]'
              - 'button "g4: Empty" [disabled] [ref=e180]'
              - 'button "h4: Empty" [disabled] [ref=e181]'
              - 'button "i4: Empty" [disabled] [ref=e182]'
              - generic [ref=e183]: "3"
              - 'button "a3: Empty" [disabled] [ref=e184]'
              - 'button "b3: Empty" [disabled] [ref=e185]'
              - 'button "c3: Empty" [disabled] [ref=e186]'
              - 'button "d3: Empty" [disabled] [ref=e187]'
              - 'button "e3: Empty" [disabled] [ref=e188]'
              - 'button "f3: Empty" [disabled] [ref=e189]'
              - 'button "g3: Empty" [disabled] [ref=e190]'
              - 'button "h3: Empty" [disabled] [ref=e191]'
              - 'button "i3: Empty" [disabled] [ref=e192]'
              - generic [ref=e193]: "2"
              - 'button "a2: West gold diamond" [disabled] [ref=e194]':
                - generic: ◆
              - 'button "b2: Empty" [disabled] [ref=e195]'
              - 'button "c2: Empty" [disabled] [ref=e196]'
              - 'button "d2: Empty" [disabled] [ref=e197]'
              - 'button "e2: Empty" [disabled] [ref=e198]'
              - 'button "f2: Empty" [disabled] [ref=e199]'
              - 'button "g2: Empty" [disabled] [ref=e200]'
              - 'button "h2: Empty" [disabled] [ref=e201]'
              - 'button "i2: Empty" [disabled] [ref=e202]'
              - generic [ref=e203]: "1"
              - 'button "a1: Empty" [disabled] [ref=e204]'
              - 'button "b1: Empty" [disabled] [ref=e205]'
              - 'button "c1: Empty" [disabled] [ref=e206]'
              - 'button "d1: Empty" [disabled] [ref=e207]'
              - 'button "e1: Empty" [disabled] [ref=e208]'
              - 'button "f1: Empty" [disabled] [ref=e209]'
              - 'button "g1: Empty" [disabled] [ref=e210]'
              - 'button "h1: Empty" [disabled] [ref=e211]'
              - 'button "i1: Empty" [disabled] [ref=e212]'
            - status [ref=e213]: Game finished. Use the game controls to review earlier moves.
          - status [ref=e215]:
            - generic [ref=e216]:
              - generic [ref=e217]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
              - text: The central hill was reached. Game won.
        - generic [ref=e218]:
          - list "Standings" [ref=e220]:
            - listitem [ref=e221]:
              - generic [ref=e222]:
                - generic [ref=e223]: 1st
                - generic [ref=e226]: avery
            - listitem [ref=e227]:
              - generic [ref=e228]:
                - generic [ref=e229]: 2nd
                - generic [ref=e232]: jordan_plays
            - listitem [ref=e233]:
              - generic [ref=e234]:
                - generic [ref=e235]: 2nd
                - generic [ref=e238]: morgan
            - listitem [ref=e239]:
              - generic [ref=e240]:
                - generic [ref=e241]: 2nd
                - generic [ref=e244]: robin_42
          - button "History and stats" [ref=e247] [cursor=pointer]:
            - generic [ref=e249]:
              - paragraph [ref=e250]: History and stats
              - img [ref=e253]
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