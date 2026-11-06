# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-classic--lost light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  53023 pixels (ratio 0.17 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/lost-light.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/lost-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 53023 pixels (ratio 0.17 of all image pixels) are different.
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
  - 53023 pixels (ratio 0.17 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - heading "Classic Quoridor" [level=1] [ref=e16]
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
        - paragraph [ref=e46]: No moves yet.
        - button "All moves" [ref=e47] [cursor=pointer]:
          - img [ref=e51]
      - generic [ref=e53]:
        - generic [ref=e55]:
          - generic [ref=e57]:
            - generic [ref=e62]:
              - img "South red circle" [ref=e63]:
                - generic [ref=e64]: ●
              - generic "avery" [ref=e67]
            - generic [ref=e68]:
              - generic [ref=e69]: Walls
              - generic [ref=e70]: "10"
          - generic [ref=e72]:
            - generic [ref=e73]:
              - button "Move pawn" [disabled] [pressed] [ref=e74]:
                - paragraph [ref=e77]: Move pawn
              - button "Horizontal wall" [disabled] [ref=e78]:
                - paragraph [ref=e81]: Horizontal wall
              - button "Vertical wall" [disabled] [ref=e82]:
                - paragraph [ref=e85]: Vertical wall
            - group "Quoridor board, nine columns and nine rows" [ref=e86]:
              - generic [ref=e88]: a
              - generic [ref=e89]: b
              - generic [ref=e90]: c
              - generic [ref=e91]: d
              - generic [ref=e92]: e
              - generic [ref=e93]: f
              - generic [ref=e94]: g
              - generic [ref=e95]: h
              - generic [ref=e96]: i
              - generic [ref=e97]: "9"
              - 'button "a9: Empty" [disabled] [ref=e98]'
              - 'button "b9: Empty" [disabled] [ref=e99]'
              - 'button "c9: Empty" [disabled] [ref=e100]'
              - 'button "d9: Empty" [disabled] [ref=e101]'
              - 'button "e9: South red circle" [disabled] [ref=e102]':
                - generic: ●
              - 'button "f9: Empty" [disabled] [ref=e103]'
              - 'button "g9: Empty" [disabled] [ref=e104]'
              - 'button "h9: Empty" [disabled] [ref=e105]'
              - 'button "i9: Empty" [disabled] [ref=e106]'
              - generic [ref=e107]: "8"
              - 'button "a8: Empty" [disabled] [ref=e108]'
              - 'button "b8: Empty" [disabled] [ref=e109]'
              - 'button "c8: Empty" [disabled] [ref=e110]'
              - 'button "d8: Empty" [disabled] [ref=e111]'
              - 'button "e8: Empty" [disabled] [ref=e112]'
              - 'button "f8: Empty" [disabled] [ref=e113]'
              - 'button "g8: Empty" [disabled] [ref=e114]'
              - 'button "h8: Empty" [disabled] [ref=e115]'
              - 'button "i8: Empty" [disabled] [ref=e116]'
              - generic [ref=e117]: "7"
              - 'button "a7: Empty" [disabled] [ref=e118]'
              - 'button "b7: Empty" [disabled] [ref=e119]'
              - 'button "c7: Empty" [disabled] [ref=e120]'
              - 'button "d7: Empty" [disabled] [ref=e121]'
              - 'button "e7: Empty" [disabled] [ref=e122]'
              - 'button "f7: Empty" [disabled] [ref=e123]'
              - 'button "g7: Empty" [disabled] [ref=e124]'
              - 'button "h7: Empty" [disabled] [ref=e125]'
              - 'button "i7: Empty" [disabled] [ref=e126]'
              - generic [ref=e127]: "6"
              - 'button "a6: North gold diamond" [disabled] [ref=e128]':
                - generic: ◆
              - 'button "b6: Empty" [disabled] [ref=e129]'
              - 'button "c6: Empty" [disabled] [ref=e130]'
              - 'button "d6: Empty" [disabled] [ref=e131]'
              - 'button "e6: Empty" [disabled] [ref=e132]'
              - 'button "f6: Empty" [disabled] [ref=e133]'
              - 'button "g6: Empty" [disabled] [ref=e134]'
              - 'button "h6: Empty" [disabled] [ref=e135]'
              - 'button "i6: Empty" [disabled] [ref=e136]'
              - generic [ref=e137]: "5"
              - 'button "a5: Empty" [disabled] [ref=e138]'
              - 'button "b5: Empty" [disabled] [ref=e139]'
              - 'button "c5: Empty" [disabled] [ref=e140]'
              - 'button "d5: Empty" [disabled] [ref=e141]'
              - 'button "e5: Empty" [disabled] [ref=e142]'
              - 'button "f5: Empty" [disabled] [ref=e143]'
              - 'button "g5: Empty" [disabled] [ref=e144]'
              - 'button "h5: Empty" [disabled] [ref=e145]'
              - 'button "i5: Empty" [disabled] [ref=e146]'
              - generic [ref=e147]: "4"
              - 'button "a4: Empty" [disabled] [ref=e148]'
              - 'button "b4: Empty" [disabled] [ref=e149]'
              - 'button "c4: Empty" [disabled] [ref=e150]'
              - 'button "d4: Empty" [disabled] [ref=e151]'
              - 'button "e4: Empty" [disabled] [ref=e152]'
              - 'button "f4: Empty" [disabled] [ref=e153]'
              - 'button "g4: Empty" [disabled] [ref=e154]'
              - 'button "h4: Empty" [disabled] [ref=e155]'
              - 'button "i4: Empty" [disabled] [ref=e156]'
              - generic [ref=e157]: "3"
              - 'button "a3: Empty" [disabled] [ref=e158]'
              - 'button "b3: Empty" [disabled] [ref=e159]'
              - 'button "c3: Empty" [disabled] [ref=e160]'
              - 'button "d3: Empty" [disabled] [ref=e161]'
              - 'button "e3: Empty" [disabled] [ref=e162]'
              - 'button "f3: Empty" [disabled] [ref=e163]'
              - 'button "g3: Empty" [disabled] [ref=e164]'
              - 'button "h3: Empty" [disabled] [ref=e165]'
              - 'button "i3: Empty" [disabled] [ref=e166]'
              - generic [ref=e167]: "2"
              - 'button "a2: Empty" [disabled] [ref=e168]'
              - 'button "b2: Empty" [disabled] [ref=e169]'
              - 'button "c2: Empty" [disabled] [ref=e170]'
              - 'button "d2: Empty" [disabled] [ref=e171]'
              - 'button "e2: Empty" [disabled] [ref=e172]'
              - 'button "f2: Empty" [disabled] [ref=e173]'
              - 'button "g2: Empty" [disabled] [ref=e174]'
              - 'button "h2: Empty" [disabled] [ref=e175]'
              - 'button "i2: Empty" [disabled] [ref=e176]'
              - generic [ref=e177]: "1"
              - 'button "a1: Empty, goal edge" [disabled] [ref=e178]'
              - 'button "b1: Empty, goal edge" [disabled] [ref=e179]'
              - 'button "c1: Empty, goal edge" [disabled] [ref=e180]'
              - 'button "d1: Empty, goal edge" [disabled] [ref=e181]'
              - 'button "e1: Empty, goal edge" [disabled] [ref=e182]'
              - 'button "f1: Empty, goal edge" [disabled] [ref=e183]'
              - 'button "g1: Empty, goal edge" [disabled] [ref=e184]'
              - 'button "h1: Empty, goal edge" [disabled] [ref=e185]'
              - 'button "i1: Empty, goal edge" [disabled] [ref=e186]'
            - status [ref=e187]: Game finished. Use the game controls to review earlier moves.
          - status [ref=e189]:
            - generic [ref=e190]:
              - generic [ref=e191]: "South red circle: avery. North gold diamond: jordan_plays."
              - text: The opposite home row was reached. Game won.
          - generic [ref=e194]:
            - generic [ref=e199]:
              - img "North gold diamond" [ref=e200]:
                - generic [ref=e201]: ◆
              - generic "jordan_plays" [ref=e204]
            - generic [ref=e205]:
              - generic [ref=e206]: Walls
              - generic [ref=e207]: "10"
        - generic [ref=e208]:
          - list "Standings" [ref=e210]:
            - listitem [ref=e211]:
              - generic [ref=e212]:
                - generic [ref=e213]: 1st
                - generic [ref=e216]: avery
            - listitem [ref=e217]:
              - generic [ref=e218]:
                - generic [ref=e219]: 2nd
                - generic [ref=e222]: jordan_plays
          - button "History and stats" [ref=e225] [cursor=pointer]:
            - generic [ref=e227]:
              - paragraph [ref=e228]: History and stats
              - img [ref=e231]
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