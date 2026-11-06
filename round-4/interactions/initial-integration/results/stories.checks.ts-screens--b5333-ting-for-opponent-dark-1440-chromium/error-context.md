# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-classic--waiting-for-opponent dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  80338 pixels (ratio 0.07 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/waiting-for-opponent-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/waiting-for-opponent-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 80338 pixels (ratio 0.07 of all image pixels) are different.
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
  - 80338 pixels (ratio 0.07 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e15]:
    - generic [ref=e16]:
      - heading "Classic Quoridor" [level=1] [ref=e19]
      - generic [ref=e21]:
        - generic [ref=e22]: Unrated
        - generic [ref=e23]: ·Untimed
    - generic [ref=e25]:
      - generic [ref=e27]:
        - generic [ref=e29]:
          - generic [ref=e34]:
            - img "North gold diamond" [ref=e35]:
              - generic [ref=e36]: ◆
            - generic [ref=e37]: jordan_plays
            - generic [ref=e38]: To move
          - generic [ref=e39]:
            - generic [ref=e40]: Walls
            - generic [ref=e41]: "9"
        - generic [ref=e43]:
          - generic [ref=e44]:
            - button "Move pawn" [disabled] [pressed] [ref=e45]:
              - paragraph [ref=e48]: Move pawn
            - button "Horizontal wall" [disabled] [ref=e49]:
              - paragraph [ref=e52]: Horizontal wall
            - button "Vertical wall" [disabled] [ref=e53]:
              - paragraph [ref=e56]: Vertical wall
          - group "Quoridor board, nine columns and nine rows" [ref=e57]:
            - generic [ref=e59]: a
            - generic [ref=e60]: b
            - generic [ref=e61]: c
            - generic [ref=e62]: d
            - generic [ref=e63]: e
            - generic [ref=e64]: f
            - generic [ref=e65]: g
            - generic [ref=e66]: h
            - generic [ref=e67]: i
            - generic [ref=e68]: "9"
            - 'button "a9: Empty" [disabled] [ref=e69]'
            - 'button "b9: Empty" [disabled] [ref=e70]'
            - 'button "c9: Empty" [disabled] [ref=e71]'
            - 'button "d9: Empty" [disabled] [ref=e72]'
            - 'button "e9: Empty" [disabled] [ref=e73]'
            - 'button "f9: Empty" [disabled] [ref=e74]'
            - 'button "g9: Empty" [disabled] [ref=e75]'
            - 'button "h9: Empty" [disabled] [ref=e76]'
            - 'button "i9: Empty" [disabled] [ref=e77]'
            - generic [ref=e78]: "8"
            - 'button "a8: Empty" [disabled] [ref=e79]'
            - 'button "b8: Empty" [disabled] [ref=e80]'
            - 'button "c8: Empty" [disabled] [ref=e81]'
            - 'button "d8: Empty, wall boundaries: bottom" [disabled] [ref=e82]'
            - 'button "e8: Empty, wall boundaries: bottom" [disabled] [ref=e83]'
            - 'button "f8: Empty" [disabled] [ref=e84]'
            - 'button "g8: Empty" [disabled] [ref=e85]'
            - 'button "h8: Empty" [disabled] [ref=e86]'
            - 'button "i8: Empty" [disabled] [ref=e87]'
            - generic [ref=e88]: "7"
            - 'button "a7: Empty" [disabled] [ref=e89]'
            - 'button "b7: Empty" [disabled] [ref=e90]'
            - 'button "c7: Empty" [disabled] [ref=e91]'
            - 'button "d7: Empty, wall boundaries: top" [disabled] [ref=e92]'
            - 'button "e7: Empty, legal move, wall boundaries: top" [disabled] [ref=e93]':
              - generic: ·
            - 'button "f7: Empty, wall boundaries: right" [disabled] [ref=e94]'
            - 'button "g7: Empty, wall boundaries: left" [disabled] [ref=e95]'
            - 'button "h7: Empty" [disabled] [ref=e96]'
            - 'button "i7: Empty" [disabled] [ref=e97]'
            - generic [ref=e98]: "6"
            - 'button "a6: Empty" [disabled] [ref=e99]'
            - 'button "b6: Empty" [disabled] [ref=e100]'
            - 'button "c6: Empty" [disabled] [ref=e101]'
            - 'button "d6: Empty, legal move" [disabled] [ref=e102]':
              - generic: ·
            - 'button "e6: North gold diamond" [disabled] [ref=e103]':
              - generic: ◆
            - 'button "f6: Empty, legal move, wall boundaries: right" [disabled] [ref=e104]':
              - generic: ·
            - 'button "g6: Empty, wall boundaries: left" [disabled] [ref=e105]'
            - 'button "h6: Empty" [disabled] [ref=e106]'
            - 'button "i6: Empty" [disabled] [ref=e107]'
            - generic [ref=e108]: "5"
            - 'button "a5: Empty" [disabled] [ref=e109]'
            - 'button "b5: Empty" [disabled] [ref=e110]'
            - 'button "c5: Empty" [disabled] [ref=e111]'
            - 'button "d5: Empty, wall boundaries: bottom" [disabled] [ref=e112]'
            - 'button "e5: Empty, legal move, wall boundaries: bottom" [disabled] [ref=e113]':
              - generic: ·
            - 'button "f5: Empty" [disabled] [ref=e114]'
            - 'button "g5: Empty" [disabled] [ref=e115]'
            - 'button "h5: Empty" [disabled] [ref=e116]'
            - 'button "i5: Empty" [disabled] [ref=e117]'
            - generic [ref=e118]: "4"
            - 'button "a4: Empty" [disabled] [ref=e119]'
            - 'button "b4: Empty" [disabled] [ref=e120]'
            - 'button "c4: Empty, wall boundaries: right" [disabled] [ref=e121]'
            - 'button "d4: Empty, wall boundaries: top, left" [disabled] [ref=e122]'
            - 'button "e4: Empty, wall boundaries: top" [disabled] [ref=e123]'
            - 'button "f4: Empty" [disabled] [ref=e124]'
            - 'button "g4: Empty" [disabled] [ref=e125]'
            - 'button "h4: Empty" [disabled] [ref=e126]'
            - 'button "i4: Empty" [disabled] [ref=e127]'
            - generic [ref=e128]: "3"
            - 'button "a3: Empty" [disabled] [ref=e129]'
            - 'button "b3: Empty" [disabled] [ref=e130]'
            - 'button "c3: Empty, wall boundaries: right" [disabled] [ref=e131]'
            - 'button "d3: Empty, wall boundaries: left" [disabled] [ref=e132]'
            - 'button "e3: South red circle" [disabled] [ref=e133]':
              - generic: ●
            - 'button "f3: Empty" [disabled] [ref=e134]'
            - 'button "g3: Empty" [disabled] [ref=e135]'
            - 'button "h3: Empty" [disabled] [ref=e136]'
            - 'button "i3: Empty" [disabled] [ref=e137]'
            - generic [ref=e138]: "2"
            - 'button "a2: Empty" [disabled] [ref=e139]'
            - 'button "b2: Empty" [disabled] [ref=e140]'
            - 'button "c2: Empty" [disabled] [ref=e141]'
            - 'button "d2: Empty" [disabled] [ref=e142]'
            - 'button "e2: Empty" [disabled] [ref=e143]'
            - 'button "f2: Empty" [disabled] [ref=e144]'
            - 'button "g2: Empty" [disabled] [ref=e145]'
            - 'button "h2: Empty" [disabled] [ref=e146]'
            - 'button "i2: Empty" [disabled] [ref=e147]'
            - generic [ref=e148]: "1"
            - 'button "a1: Empty" [disabled] [ref=e149]'
            - 'button "b1: Empty" [disabled] [ref=e150]'
            - 'button "c1: Empty" [disabled] [ref=e151]'
            - 'button "d1: Empty" [disabled] [ref=e152]'
            - 'button "e1: Empty" [disabled] [ref=e153]'
            - 'button "f1: Empty" [disabled] [ref=e154]'
            - 'button "g1: Empty" [disabled] [ref=e155]'
            - 'button "h1: Empty" [disabled] [ref=e156]'
            - 'button "i1: Empty" [disabled] [ref=e157]'
          - status [ref=e158]: This board is read-only. Follow the game or review earlier moves.
        - status [ref=e160]:
          - generic [ref=e161]:
            - generic [ref=e162]: "South red circle: avery. North gold diamond: jordan_plays."
            - text: North gold diamond to move, heading for row 1.
        - generic [ref=e165]:
          - generic [ref=e170]:
            - img "South red circle" [ref=e171]:
              - generic [ref=e172]: ●
            - generic [ref=e173]: avery
          - generic [ref=e174]:
            - generic [ref=e175]: Walls
            - generic [ref=e176]: "7"
      - region "Game record" [ref=e179]:
        - generic [ref=e180]:
          - heading "Game record" [level=2] [ref=e182]
          - paragraph [ref=e183]: North gold diamond to move, heading for row 1.
        - generic [ref=e185]:
          - group "Game actions" [ref=e186]:
            - button "Offer draw" [ref=e187] [cursor=pointer]:
              - paragraph [ref=e190]: Offer draw
            - button "Resign game" [ref=e191] [cursor=pointer]:
              - paragraph [ref=e194]:
                - text: Resign
                - generic [ref=e195]: game
          - button "History and stats" [ref=e196] [cursor=pointer]:
            - paragraph [ref=e199]: History and stats
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