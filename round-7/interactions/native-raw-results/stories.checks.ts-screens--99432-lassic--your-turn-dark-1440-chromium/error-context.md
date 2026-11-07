# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-classic--your-turn dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  127977 pixels (ratio 0.11 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/your-turn-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/your-turn-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 127977 pixels (ratio 0.11 of all image pixels) are different.
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
  - 127977 pixels (ratio 0.11 of all image pixels) are different.

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
            - generic "jordan_plays" [ref=e39]
          - generic [ref=e40]:
            - generic [ref=e41]: Walls
            - generic [ref=e42]: "9"
        - generic [ref=e44]:
          - generic [ref=e45]:
            - button "Move pawn" [pressed] [ref=e46] [cursor=pointer]:
              - paragraph [ref=e49]: Move
            - button "Horizontal wall" [ref=e50] [cursor=pointer]:
              - paragraph [ref=e53]: Horizontal wall
            - button "Vertical wall" [ref=e54] [cursor=pointer]:
              - paragraph [ref=e57]: Vertical wall
          - group "Quoridor board, nine columns and nine rows" [ref=e58]:
            - generic [ref=e60]: a
            - generic [ref=e61]: b
            - generic [ref=e62]: c
            - generic [ref=e63]: d
            - generic [ref=e64]: e
            - generic [ref=e65]: f
            - generic [ref=e66]: g
            - generic [ref=e67]: h
            - generic [ref=e68]: i
            - generic [ref=e69]: "9"
            - 'button "a9: Empty, goal edge" [disabled] [ref=e70]'
            - 'button "b9: Empty, goal edge" [disabled] [ref=e71]'
            - 'button "c9: Empty, goal edge" [disabled] [ref=e72]'
            - 'button "d9: Empty, goal edge" [disabled] [ref=e73]'
            - 'button "e9: Empty, goal edge" [disabled] [ref=e74]'
            - 'button "f9: Empty, goal edge" [disabled] [ref=e75]'
            - 'button "g9: Empty, goal edge" [disabled] [ref=e76]'
            - 'button "h9: Empty, goal edge" [disabled] [ref=e77]'
            - 'button "i9: Empty, goal edge" [disabled] [ref=e78]'
            - generic [ref=e79]: "8"
            - 'button "a8: Empty" [disabled] [ref=e80]'
            - 'button "b8: Empty" [disabled] [ref=e81]'
            - 'button "c8: Empty" [disabled] [ref=e82]'
            - 'button "d8: Empty, wall boundaries: bottom" [disabled] [ref=e83]'
            - 'button "e8: Empty, wall boundaries: bottom" [disabled] [ref=e84]'
            - 'button "f8: Empty" [disabled] [ref=e85]'
            - 'button "g8: Empty" [disabled] [ref=e86]'
            - 'button "h8: Empty" [disabled] [ref=e87]'
            - 'button "i8: Empty" [disabled] [ref=e88]'
            - generic [ref=e89]: "7"
            - 'button "a7: Empty" [disabled] [ref=e90]'
            - 'button "b7: Empty" [disabled] [ref=e91]'
            - 'button "c7: Empty" [disabled] [ref=e92]'
            - 'button "d7: Empty, wall boundaries: top" [disabled] [ref=e93]'
            - 'button "e7: Empty, wall boundaries: top" [disabled] [ref=e94]'
            - 'button "f7: Empty, wall boundaries: right" [disabled] [ref=e95]'
            - 'button "g7: Empty, wall boundaries: left" [disabled] [ref=e96]'
            - 'button "h7: Empty" [disabled] [ref=e97]'
            - 'button "i7: Empty" [disabled] [ref=e98]'
            - generic [ref=e99]: "6"
            - 'button "a6: Empty" [disabled] [ref=e100]'
            - 'button "b6: Empty" [disabled] [ref=e101]'
            - 'button "c6: Empty" [disabled] [ref=e102]'
            - 'button "d6: Empty" [disabled] [ref=e103]'
            - 'button "e6: North gold diamond" [disabled] [ref=e104]':
              - generic: ◆
            - 'button "f6: Empty, wall boundaries: right" [disabled] [ref=e105]'
            - 'button "g6: Empty, wall boundaries: left" [disabled] [ref=e106]'
            - 'button "h6: Empty" [disabled] [ref=e107]'
            - 'button "i6: Empty" [disabled] [ref=e108]'
            - generic [ref=e109]: "5"
            - 'button "a5: Empty" [disabled] [ref=e110]'
            - 'button "b5: Empty" [disabled] [ref=e111]'
            - 'button "c5: Empty" [disabled] [ref=e112]'
            - 'button "d5: Empty, wall boundaries: bottom" [disabled] [ref=e113]'
            - 'button "e5: Empty, wall boundaries: bottom" [disabled] [ref=e114]'
            - 'button "f5: Empty" [disabled] [ref=e115]'
            - 'button "g5: Empty" [disabled] [ref=e116]'
            - 'button "h5: Empty" [disabled] [ref=e117]'
            - 'button "i5: Empty" [disabled] [ref=e118]'
            - generic [ref=e119]: "4"
            - 'button "a4: Empty" [disabled] [ref=e120]'
            - 'button "b4: Empty" [disabled] [ref=e121]'
            - 'button "c4: Empty" [disabled] [ref=e122]'
            - 'button "d4: Empty, wall boundaries: top" [disabled] [ref=e123]'
            - 'button "e4: Empty, legal move, wall boundaries: top" [ref=e124] [cursor=pointer]':
              - generic: ·
            - 'button "f4: Empty" [disabled] [ref=e125]'
            - 'button "g4: Empty" [disabled] [ref=e126]'
            - 'button "h4: Empty" [disabled] [ref=e127]'
            - 'button "i4: Empty" [disabled] [ref=e128]'
            - generic [ref=e129]: "3"
            - 'button "a3: Empty" [disabled] [ref=e130]'
            - 'button "b3: Empty" [disabled] [ref=e131]'
            - 'button "c3: Empty" [disabled] [ref=e132]'
            - 'button "d3: Empty, legal move" [ref=e133] [cursor=pointer]':
              - generic: ·
            - 'button "e3: South red circle" [disabled] [ref=e134]':
              - generic: ●
            - 'button "f3: Empty, legal move" [ref=e135] [cursor=pointer]':
              - generic: ·
            - 'button "g3: Empty" [disabled] [ref=e136]'
            - 'button "h3: Empty" [disabled] [ref=e137]'
            - 'button "i3: Empty" [disabled] [ref=e138]'
            - generic [ref=e139]: "2"
            - 'button "a2: Empty" [disabled] [ref=e140]'
            - 'button "b2: Empty" [disabled] [ref=e141]'
            - 'button "c2: Empty" [disabled] [ref=e142]'
            - 'button "d2: Empty" [disabled] [ref=e143]'
            - 'button "e2: Empty, legal move" [ref=e144] [cursor=pointer]':
              - generic: ·
            - 'button "f2: Empty" [disabled] [ref=e145]'
            - 'button "g2: Empty" [disabled] [ref=e146]'
            - 'button "h2: Empty" [disabled] [ref=e147]'
            - 'button "i2: Empty" [disabled] [ref=e148]'
            - generic [ref=e149]: "1"
            - 'button "a1: Empty" [disabled] [ref=e150]'
            - 'button "b1: Empty" [disabled] [ref=e151]'
            - 'button "c1: Empty" [disabled] [ref=e152]'
            - 'button "d1: Empty" [disabled] [ref=e153]'
            - 'button "e1: Empty" [disabled] [ref=e154]'
            - 'button "f1: Empty" [disabled] [ref=e155]'
            - 'button "g1: Empty" [disabled] [ref=e156]'
            - 'button "h1: Empty" [disabled] [ref=e157]'
            - 'button "i1: Empty" [disabled] [ref=e158]'
          - generic [ref=e159]:
            - paragraph [ref=e160]: Move to a coordinate
            - button "Move to a coordinate" [ref=e161] [cursor=pointer]:
              - paragraph [ref=e162]: Select…
              - img [ref=e164]
          - status [ref=e166]: Move to a marked square.
        - status [ref=e168]:
          - generic [ref=e169]:
            - generic [ref=e170]: "South red circle: avery. North gold diamond: jordan_plays."
            - text: Your turn. Reach row 9.
        - generic [ref=e173]:
          - generic [ref=e178]:
            - img "South red circle" [ref=e179]:
              - generic [ref=e180]: ●
            - generic "avery" [ref=e183]
            - generic [ref=e184]: Your move
          - generic [ref=e185]:
            - generic [ref=e186]: Walls
            - generic [ref=e187]: "8"
      - region "Game record" [ref=e190]:
        - generic [ref=e191]:
          - heading "Game record" [level=2] [ref=e193]
          - paragraph [ref=e194]: Your turn. Reach row 9.
        - generic [ref=e196]:
          - group "Game actions" [ref=e197]:
            - button "Offer draw" [ref=e198] [cursor=pointer]:
              - paragraph [ref=e201]: Offer draw
            - button "Resign game" [ref=e202] [cursor=pointer]:
              - paragraph [ref=e205]:
                - text: Resign
                - generic [ref=e206]: game
          - button "History and stats" [ref=e207] [cursor=pointer]:
            - paragraph [ref=e210]: History and stats
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