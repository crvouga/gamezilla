# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--reach-the-hill light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  39310 pixels (ratio 0.12 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/reach-the-hill-light.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/reach-the-hill-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 39310 pixels (ratio 0.12 of all image pixels) are different.
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
  - 39310 pixels (ratio 0.12 of all image pixels) are different.

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
        - heading "avery wins" [level=2] [ref=e25]
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
            - generic [ref=e51]: Move 4
            - generic [ref=e52]:
              - generic [ref=e54]: ●
              - 'button "Move 13, South red circle: e5" [ref=e55] [cursor=pointer]': e5
        - button "All moves" [ref=e56] [cursor=pointer]:
          - img [ref=e60]
      - generic [ref=e62]:
        - generic [ref=e64]:
          - list "Players" [ref=e66]:
            - generic "jordan_plays" [ref=e67]:
              - listitem [ref=e68]:
                - generic [ref=e71]:
                  - generic [ref=e72]: jordan_plays
                  - generic [ref=e73]:
                    - generic [ref=e75]: ◆
                    - generic [ref=e76]: Walls 5
                    - generic [ref=e78]: You
            - generic "avery" [ref=e79]:
              - listitem [ref=e80]:
                - generic [ref=e82]:
                  - generic [ref=e83]: avery
                  - generic [ref=e84]:
                    - generic [ref=e86]: ●
                    - generic [ref=e87]: Walls 5
            - generic "morgan" [ref=e88]:
              - listitem [ref=e89]:
                - generic [ref=e91]:
                  - generic [ref=e92]: morgan
                  - generic [ref=e93]:
                    - generic [ref=e95]: ▲
                    - generic [ref=e96]: Walls 5
            - generic "robin_42" [ref=e97]:
              - listitem [ref=e98]:
                - generic [ref=e100]:
                  - generic [ref=e101]: robin_42
                  - generic [ref=e102]:
                    - generic [ref=e104]: ■
                    - generic [ref=e105]: Walls 5
          - generic [ref=e107]:
            - generic [ref=e108]:
              - button "Move pawn" [disabled] [pressed] [ref=e109]:
                - paragraph [ref=e112]: Move
              - button "Horizontal wall" [disabled] [ref=e113]:
                - paragraph [ref=e116]: Horizontal wall
              - button "Vertical wall" [disabled] [ref=e117]:
                - paragraph [ref=e120]: Vertical wall
            - group "Quoridor board, nine columns and nine rows" [ref=e121]:
              - generic [ref=e123]: a
              - generic [ref=e124]: b
              - generic [ref=e125]: c
              - generic [ref=e126]: d
              - generic [ref=e127]: e
              - generic [ref=e128]: f
              - generic [ref=e129]: g
              - generic [ref=e130]: h
              - generic [ref=e131]: i
              - generic [ref=e132]: "9"
              - 'button "a9: Empty" [disabled] [ref=e133]'
              - 'button "b9: Empty" [disabled] [ref=e134]'
              - 'button "c9: Empty" [disabled] [ref=e135]'
              - 'button "d9: Empty" [disabled] [ref=e136]'
              - 'button "e9: Empty" [disabled] [ref=e137]'
              - 'button "f9: Empty" [disabled] [ref=e138]'
              - 'button "g9: Empty" [disabled] [ref=e139]'
              - 'button "h9: Empty" [disabled] [ref=e140]'
              - 'button "i9: Empty" [disabled] [ref=e141]'
              - generic [ref=e142]: "8"
              - 'button "a8: Empty" [disabled] [ref=e143]'
              - 'button "b8: Empty" [disabled] [ref=e144]'
              - 'button "c8: North green triangle" [disabled] [ref=e145]':
                - generic: ▲
              - 'button "d8: Empty" [disabled] [ref=e146]'
              - 'button "e8: Empty" [disabled] [ref=e147]'
              - 'button "f8: Empty" [disabled] [ref=e148]'
              - 'button "g8: Empty" [disabled] [ref=e149]'
              - 'button "h8: Empty" [disabled] [ref=e150]'
              - 'button "i8: East black square" [disabled] [ref=e151]':
                - generic: ■
              - generic [ref=e152]: "7"
              - 'button "a7: Empty" [disabled] [ref=e153]'
              - 'button "b7: Empty" [disabled] [ref=e154]'
              - 'button "c7: Empty" [disabled] [ref=e155]'
              - 'button "d7: Empty" [disabled] [ref=e156]'
              - 'button "e7: Empty" [disabled] [ref=e157]'
              - 'button "f7: Empty" [disabled] [ref=e158]'
              - 'button "g7: Empty" [disabled] [ref=e159]'
              - 'button "h7: Empty" [disabled] [ref=e160]'
              - 'button "i7: Empty" [disabled] [ref=e161]'
              - generic [ref=e162]: "6"
              - 'button "a6: Empty" [disabled] [ref=e163]'
              - 'button "b6: Empty" [disabled] [ref=e164]'
              - 'button "c6: Empty" [disabled] [ref=e165]'
              - 'button "d6: Empty" [disabled] [ref=e166]'
              - 'button "e6: Empty" [disabled] [ref=e167]'
              - 'button "f6: Empty" [disabled] [ref=e168]'
              - 'button "g6: Empty" [disabled] [ref=e169]'
              - 'button "h6: Empty" [disabled] [ref=e170]'
              - 'button "i6: Empty" [disabled] [ref=e171]'
              - generic [ref=e172]: "5"
              - 'button "a5: Empty" [disabled] [ref=e173]'
              - 'button "b5: Empty" [disabled] [ref=e174]'
              - 'button "c5: Empty" [disabled] [ref=e175]'
              - 'button "d5: Empty" [disabled] [ref=e176]'
              - 'button "e5: South red circle, center goal" [disabled] [ref=e177]':
                - generic: ●
              - 'button "f5: Empty" [disabled] [ref=e178]'
              - 'button "g5: Empty" [disabled] [ref=e179]'
              - 'button "h5: Empty" [disabled] [ref=e180]'
              - 'button "i5: Empty" [disabled] [ref=e181]'
              - generic [ref=e182]: "4"
              - 'button "a4: Empty" [disabled] [ref=e183]'
              - 'button "b4: Empty" [disabled] [ref=e184]'
              - 'button "c4: Empty" [disabled] [ref=e185]'
              - 'button "d4: Empty" [disabled] [ref=e186]'
              - 'button "e4: Empty" [disabled] [ref=e187]'
              - 'button "f4: Empty" [disabled] [ref=e188]'
              - 'button "g4: Empty" [disabled] [ref=e189]'
              - 'button "h4: Empty" [disabled] [ref=e190]'
              - 'button "i4: Empty" [disabled] [ref=e191]'
              - generic [ref=e192]: "3"
              - 'button "a3: Empty" [disabled] [ref=e193]'
              - 'button "b3: Empty" [disabled] [ref=e194]'
              - 'button "c3: Empty" [disabled] [ref=e195]'
              - 'button "d3: Empty" [disabled] [ref=e196]'
              - 'button "e3: Empty" [disabled] [ref=e197]'
              - 'button "f3: Empty" [disabled] [ref=e198]'
              - 'button "g3: Empty" [disabled] [ref=e199]'
              - 'button "h3: Empty" [disabled] [ref=e200]'
              - 'button "i3: Empty" [disabled] [ref=e201]'
              - generic [ref=e202]: "2"
              - 'button "a2: West gold diamond" [disabled] [ref=e203]':
                - generic: ◆
              - 'button "b2: Empty" [disabled] [ref=e204]'
              - 'button "c2: Empty" [disabled] [ref=e205]'
              - 'button "d2: Empty" [disabled] [ref=e206]'
              - 'button "e2: Empty" [disabled] [ref=e207]'
              - 'button "f2: Empty" [disabled] [ref=e208]'
              - 'button "g2: Empty" [disabled] [ref=e209]'
              - 'button "h2: Empty" [disabled] [ref=e210]'
              - 'button "i2: Empty" [disabled] [ref=e211]'
              - generic [ref=e212]: "1"
              - 'button "a1: Empty" [disabled] [ref=e213]'
              - 'button "b1: Empty" [disabled] [ref=e214]'
              - 'button "c1: Empty" [disabled] [ref=e215]'
              - 'button "d1: Empty" [disabled] [ref=e216]'
              - 'button "e1: Empty" [disabled] [ref=e217]'
              - 'button "f1: Empty" [disabled] [ref=e218]'
              - 'button "g1: Empty" [disabled] [ref=e219]'
              - 'button "h1: Empty" [disabled] [ref=e220]'
              - 'button "i1: Empty" [disabled] [ref=e221]'
            - status [ref=e222]: Game finished. Use the game controls to review earlier moves.
          - status [ref=e224]:
            - generic [ref=e225]:
              - generic [ref=e226]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
              - text: The central hill was reached. Game won.
        - generic [ref=e227]:
          - list "Standings" [ref=e229]:
            - listitem [ref=e230]:
              - generic [ref=e231]:
                - generic [ref=e232]: 1st
                - generic [ref=e235]: avery
            - listitem [ref=e236]:
              - generic [ref=e237]:
                - generic [ref=e238]: 2nd
                - generic [ref=e241]: jordan_plays
            - listitem [ref=e242]:
              - generic [ref=e243]:
                - generic [ref=e244]: 2nd
                - generic [ref=e247]: morgan
            - listitem [ref=e248]:
              - generic [ref=e249]:
                - generic [ref=e250]: 2nd
                - generic [ref=e253]: robin_42
          - button "History and stats" [ref=e256] [cursor=pointer]:
            - generic [ref=e258]:
              - paragraph [ref=e259]: History and stats
              - img [ref=e262]
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