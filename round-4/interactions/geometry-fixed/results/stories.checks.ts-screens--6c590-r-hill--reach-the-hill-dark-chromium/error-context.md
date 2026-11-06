# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--reach-the-hill dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  47440 pixels (ratio 0.15 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/reach-the-hill-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/reach-the-hill-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 47440 pixels (ratio 0.15 of all image pixels) are different.
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
  - 47440 pixels (ratio 0.15 of all image pixels) are different.

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
            - generic [ref=e34]: Move 4
            - generic [ref=e35]:
              - generic [ref=e37]: ●
              - 'button "Move 13, South red circle: e5" [ref=e38] [cursor=pointer]': e5
        - button "All moves" [ref=e39] [cursor=pointer]:
          - img [ref=e43]
      - generic [ref=e45]:
        - generic [ref=e47]:
          - list "Players" [ref=e48]:
            - listitem [ref=e49]:
              - generic [ref=e54]:
                - generic [ref=e55]: jordan_plays
                - generic [ref=e56]:
                  - generic [ref=e58]: ◆
                  - generic [ref=e59]: Walls 5
                  - generic [ref=e61]: You
            - listitem [ref=e62]:
              - generic [ref=e66]:
                - generic [ref=e67]: avery
                - generic [ref=e68]:
                  - generic [ref=e70]: ●
                  - generic [ref=e71]: Walls 5
            - listitem [ref=e72]:
              - generic [ref=e76]:
                - generic [ref=e77]: morgan
                - generic [ref=e78]:
                  - generic [ref=e80]: ▲
                  - generic [ref=e81]: Walls 5
            - listitem [ref=e82]:
              - generic [ref=e86]:
                - generic [ref=e87]: robin_42
                - generic [ref=e88]:
                  - generic [ref=e90]: ■
                  - generic [ref=e91]: Walls 5
          - generic [ref=e93]:
            - generic [ref=e94]:
              - button "Move pawn" [disabled] [pressed] [ref=e95]:
                - paragraph [ref=e98]: Move pawn
              - button "Horizontal wall" [disabled] [ref=e99]:
                - paragraph [ref=e102]: Wall across
              - button "Vertical wall" [disabled] [ref=e103]:
                - paragraph [ref=e106]: Wall down
            - group "Quoridor board, nine columns and nine rows" [ref=e107]:
              - generic [ref=e109]: a
              - generic [ref=e110]: b
              - generic [ref=e111]: c
              - generic [ref=e112]: d
              - generic [ref=e113]: e
              - generic [ref=e114]: f
              - generic [ref=e115]: g
              - generic [ref=e116]: h
              - generic [ref=e117]: i
              - generic [ref=e118]: "9"
              - 'button "a9: Empty" [disabled] [ref=e119]'
              - 'button "b9: Empty" [disabled] [ref=e120]'
              - 'button "c9: Empty" [disabled] [ref=e121]'
              - 'button "d9: Empty" [disabled] [ref=e122]'
              - 'button "e9: Empty" [disabled] [ref=e123]'
              - 'button "f9: Empty" [disabled] [ref=e124]'
              - 'button "g9: Empty" [disabled] [ref=e125]'
              - 'button "h9: Empty" [disabled] [ref=e126]'
              - 'button "i9: Empty" [disabled] [ref=e127]'
              - generic [ref=e128]: "8"
              - 'button "a8: Empty" [disabled] [ref=e129]'
              - 'button "b8: Empty" [disabled] [ref=e130]'
              - 'button "c8: North green triangle" [disabled] [ref=e131]':
                - generic: ▲
              - 'button "d8: Empty" [disabled] [ref=e132]'
              - 'button "e8: Empty" [disabled] [ref=e133]'
              - 'button "f8: Empty" [disabled] [ref=e134]'
              - 'button "g8: Empty" [disabled] [ref=e135]'
              - 'button "h8: Empty" [disabled] [ref=e136]'
              - 'button "i8: East black square" [disabled] [ref=e137]':
                - generic: ■
              - generic [ref=e138]: "7"
              - 'button "a7: Empty" [disabled] [ref=e139]'
              - 'button "b7: Empty" [disabled] [ref=e140]'
              - 'button "c7: Empty" [disabled] [ref=e141]'
              - 'button "d7: Empty" [disabled] [ref=e142]'
              - 'button "e7: Empty" [disabled] [ref=e143]'
              - 'button "f7: Empty" [disabled] [ref=e144]'
              - 'button "g7: Empty" [disabled] [ref=e145]'
              - 'button "h7: Empty" [disabled] [ref=e146]'
              - 'button "i7: Empty" [disabled] [ref=e147]'
              - generic [ref=e148]: "6"
              - 'button "a6: Empty" [disabled] [ref=e149]'
              - 'button "b6: Empty" [disabled] [ref=e150]'
              - 'button "c6: Empty" [disabled] [ref=e151]'
              - 'button "d6: Empty" [disabled] [ref=e152]'
              - 'button "e6: Empty" [disabled] [ref=e153]'
              - 'button "f6: Empty" [disabled] [ref=e154]'
              - 'button "g6: Empty" [disabled] [ref=e155]'
              - 'button "h6: Empty" [disabled] [ref=e156]'
              - 'button "i6: Empty" [disabled] [ref=e157]'
              - generic [ref=e158]: "5"
              - 'button "a5: Empty" [disabled] [ref=e159]'
              - 'button "b5: Empty" [disabled] [ref=e160]'
              - 'button "c5: Empty" [disabled] [ref=e161]'
              - 'button "d5: Empty" [disabled] [ref=e162]'
              - 'button "e5: South red circle" [disabled] [ref=e163]':
                - generic: ●
              - 'button "f5: Empty" [disabled] [ref=e164]'
              - 'button "g5: Empty" [disabled] [ref=e165]'
              - 'button "h5: Empty" [disabled] [ref=e166]'
              - 'button "i5: Empty" [disabled] [ref=e167]'
              - generic [ref=e168]: "4"
              - 'button "a4: Empty" [disabled] [ref=e169]'
              - 'button "b4: Empty" [disabled] [ref=e170]'
              - 'button "c4: Empty" [disabled] [ref=e171]'
              - 'button "d4: Empty" [disabled] [ref=e172]'
              - 'button "e4: Empty" [disabled] [ref=e173]'
              - 'button "f4: Empty" [disabled] [ref=e174]'
              - 'button "g4: Empty" [disabled] [ref=e175]'
              - 'button "h4: Empty" [disabled] [ref=e176]'
              - 'button "i4: Empty" [disabled] [ref=e177]'
              - generic [ref=e178]: "3"
              - 'button "a3: Empty" [disabled] [ref=e179]'
              - 'button "b3: Empty" [disabled] [ref=e180]'
              - 'button "c3: Empty" [disabled] [ref=e181]'
              - 'button "d3: Empty" [disabled] [ref=e182]'
              - 'button "e3: Empty" [disabled] [ref=e183]'
              - 'button "f3: Empty" [disabled] [ref=e184]'
              - 'button "g3: Empty" [disabled] [ref=e185]'
              - 'button "h3: Empty" [disabled] [ref=e186]'
              - 'button "i3: Empty" [disabled] [ref=e187]'
              - generic [ref=e188]: "2"
              - 'button "a2: West gold diamond" [disabled] [ref=e189]':
                - generic: ◆
              - 'button "b2: Empty" [disabled] [ref=e190]'
              - 'button "c2: Empty" [disabled] [ref=e191]'
              - 'button "d2: Empty" [disabled] [ref=e192]'
              - 'button "e2: Empty" [disabled] [ref=e193]'
              - 'button "f2: Empty" [disabled] [ref=e194]'
              - 'button "g2: Empty" [disabled] [ref=e195]'
              - 'button "h2: Empty" [disabled] [ref=e196]'
              - 'button "i2: Empty" [disabled] [ref=e197]'
              - generic [ref=e198]: "1"
              - 'button "a1: Empty" [disabled] [ref=e199]'
              - 'button "b1: Empty" [disabled] [ref=e200]'
              - 'button "c1: Empty" [disabled] [ref=e201]'
              - 'button "d1: Empty" [disabled] [ref=e202]'
              - 'button "e1: Empty" [disabled] [ref=e203]'
              - 'button "f1: Empty" [disabled] [ref=e204]'
              - 'button "g1: Empty" [disabled] [ref=e205]'
              - 'button "h1: Empty" [disabled] [ref=e206]'
              - 'button "i1: Empty" [disabled] [ref=e207]'
            - status [ref=e208]: Game finished. Use the game controls to review earlier moves.
          - status [ref=e212]:
            - generic [ref=e213]:
              - generic [ref=e214]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
              - text: The central hill was reached. Game won.
        - generic [ref=e215]:
          - generic [ref=e216]:
            - heading "avery wins" [level=2] [ref=e218]
            - list "Standings" [ref=e219]:
              - listitem [ref=e220]:
                - generic [ref=e221]:
                  - generic [ref=e222]: 1st
                  - generic [ref=e225]: avery
              - listitem [ref=e226]:
                - generic [ref=e227]:
                  - generic [ref=e228]: 2nd
                  - generic [ref=e231]: jordan_plays
              - listitem [ref=e232]:
                - generic [ref=e233]:
                  - generic [ref=e234]: 2nd
                  - generic [ref=e237]: morgan
              - listitem [ref=e238]:
                - generic [ref=e239]:
                  - generic [ref=e240]: 2nd
                  - generic [ref=e243]: robin_42
          - generic [ref=e245]:
            - group "What next" [ref=e246]:
              - button "Rematch" [ref=e247] [cursor=pointer]:
                - paragraph [ref=e250]: Rematch
              - button "Change game" [ref=e251] [cursor=pointer]:
                - paragraph [ref=e254]: Change game
              - button "Review" [ref=e255] [cursor=pointer]:
                - paragraph [ref=e258]: Review
            - button "History and stats" [ref=e259] [cursor=pointer]:
              - generic [ref=e261]:
                - paragraph [ref=e262]: History and stats
                - img [ref=e265]
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