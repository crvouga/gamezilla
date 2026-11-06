# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-classic--place-a-wall light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  49870 pixels (ratio 0.05 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/place-a-wall-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/place-a-wall-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 49870 pixels (ratio 0.05 of all image pixels) are different.
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
  - 49870 pixels (ratio 0.05 of all image pixels) are different.

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
            - button "Move pawn" [ref=e46] [cursor=pointer]:
              - paragraph [ref=e49]: Move pawn
            - button "Horizontal wall" [ref=e50] [cursor=pointer]:
              - paragraph [ref=e53]: Horizontal wall
            - button "Vertical wall" [pressed] [ref=e54] [cursor=pointer]:
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
            - 'button "e9: North gold diamond, goal edge" [disabled] [ref=e74]':
              - generic: ◆
            - 'button "f9: Empty, goal edge" [disabled] [ref=e75]'
            - 'button "g9: Empty, goal edge" [disabled] [ref=e76]'
            - 'button "h9: Empty, goal edge" [disabled] [ref=e77]'
            - 'button "i9: Empty, goal edge" [disabled] [ref=e78]'
            - generic [ref=e79]: "8"
            - 'button "a8: Empty" [ref=e80] [cursor=pointer]'
            - 'button "b8: Empty" [ref=e81] [cursor=pointer]'
            - 'button "c8: Empty" [ref=e82] [cursor=pointer]'
            - 'button "d8: Empty" [ref=e83] [cursor=pointer]'
            - 'button "e8: Empty" [ref=e84] [cursor=pointer]'
            - 'button "f8: Empty" [ref=e85] [cursor=pointer]'
            - 'button "g8: Empty" [ref=e86] [cursor=pointer]'
            - 'button "h8: Empty" [ref=e87] [cursor=pointer]'
            - 'button "i8: Empty" [disabled] [ref=e88]'
            - generic [ref=e89]: "7"
            - 'button "a7: Empty" [ref=e90] [cursor=pointer]'
            - 'button "b7: Empty" [ref=e91] [cursor=pointer]'
            - 'button "c7: Empty" [ref=e92] [cursor=pointer]'
            - 'button "d7: Empty" [ref=e93] [cursor=pointer]'
            - 'button "e7: Empty" [ref=e94] [cursor=pointer]'
            - 'button "f7: Empty" [ref=e95] [cursor=pointer]'
            - 'button "g7: Empty" [ref=e96] [cursor=pointer]'
            - 'button "h7: Empty" [ref=e97] [cursor=pointer]'
            - 'button "i7: Empty" [disabled] [ref=e98]'
            - generic [ref=e99]: "6"
            - 'button "a6: Empty" [ref=e100] [cursor=pointer]'
            - 'button "b6: Empty" [ref=e101] [cursor=pointer]'
            - 'button "c6: Empty" [ref=e102] [cursor=pointer]'
            - 'button "d6: Empty" [ref=e103] [cursor=pointer]'
            - 'button "e6: Empty, wall boundaries: bottom" [ref=e104] [cursor=pointer]'
            - 'button "f6: Empty, wall boundaries: bottom" [ref=e105] [cursor=pointer]'
            - 'button "g6: Empty" [ref=e106] [cursor=pointer]'
            - 'button "h6: Empty" [ref=e107] [cursor=pointer]'
            - 'button "i6: Empty" [disabled] [ref=e108]'
            - generic [ref=e109]: "5"
            - 'button "a5: Empty" [ref=e110] [cursor=pointer]'
            - 'button "b5: Empty" [ref=e111] [cursor=pointer]'
            - 'button "c5: Empty" [ref=e112] [cursor=pointer]'
            - 'button "d5: Empty" [ref=e113] [cursor=pointer]'
            - 'button "e5: Empty, wall boundaries: top" [ref=e114] [cursor=pointer]'
            - 'button "f5: Empty, wall boundaries: top" [ref=e115] [cursor=pointer]'
            - 'button "g5: Empty" [ref=e116] [cursor=pointer]'
            - 'button "h5: Empty" [ref=e117] [cursor=pointer]'
            - 'button "i5: Empty" [disabled] [ref=e118]'
            - generic [ref=e119]: "4"
            - 'button "a4: Empty" [ref=e120] [cursor=pointer]'
            - 'button "b4: Empty, wall boundaries: right" [ref=e121] [cursor=pointer]'
            - 'button "c4: Empty, wall boundaries: left" [ref=e122] [cursor=pointer]'
            - 'button "d4: Empty" [ref=e123] [cursor=pointer]'
            - 'button "e4: Empty" [ref=e124] [cursor=pointer]'
            - 'button "f4: Empty" [ref=e125] [cursor=pointer]'
            - 'button "g4: Empty" [ref=e126] [cursor=pointer]'
            - 'button "h4: Empty" [ref=e127] [cursor=pointer]'
            - 'button "i4: Empty" [disabled] [ref=e128]'
            - generic [ref=e129]: "3"
            - 'button "a3: Empty" [ref=e130] [cursor=pointer]'
            - 'button "b3: Empty, wall boundaries: right" [ref=e131] [cursor=pointer]'
            - 'button "c3: Empty, wall boundaries: left" [ref=e132] [cursor=pointer]'
            - 'button "d3: Empty" [ref=e133] [cursor=pointer]'
            - 'button "e3: Empty" [ref=e134] [cursor=pointer]'
            - 'button "f3: Empty" [ref=e135] [cursor=pointer]'
            - 'button "g3: Empty" [ref=e136] [cursor=pointer]'
            - 'button "h3: Empty" [ref=e137] [cursor=pointer]'
            - 'button "i3: Empty" [disabled] [ref=e138]'
            - generic [ref=e139]: "2"
            - 'button "a2: Empty" [ref=e140] [cursor=pointer]'
            - 'button "b2: Empty" [ref=e141] [cursor=pointer]'
            - 'button "c2: Empty" [ref=e142] [cursor=pointer]'
            - 'button "d2: Empty" [ref=e143] [cursor=pointer]'
            - 'button "e2: Empty" [ref=e144] [cursor=pointer]'
            - 'button "f2: Empty" [ref=e145] [cursor=pointer]'
            - 'button "g2: Empty" [ref=e146] [cursor=pointer]'
            - 'button "h2: Empty" [ref=e147] [cursor=pointer]'
            - 'button "i2: Empty" [disabled] [ref=e148]'
            - generic [ref=e149]: "1"
            - 'button "a1: Empty" [ref=e150] [cursor=pointer]'
            - 'button "b1: Empty" [ref=e151] [cursor=pointer]'
            - 'button "c1: Empty" [ref=e152] [cursor=pointer]'
            - 'button "d1: Empty" [ref=e153] [cursor=pointer]'
            - 'button "e1: South red circle" [ref=e154] [cursor=pointer]':
              - generic: ●
            - 'button "f1: Empty" [ref=e155] [cursor=pointer]'
            - 'button "g1: Empty" [ref=e156] [cursor=pointer]'
            - 'button "h1: Empty" [ref=e157] [cursor=pointer]'
            - 'button "i1: Empty" [disabled] [ref=e158]'
          - generic [ref=e159]:
            - paragraph [ref=e160]: Wall anchor
            - button "Wall anchor" [ref=e161] [cursor=pointer]:
              - paragraph [ref=e162]: Select…
              - img [ref=e164]
          - status [ref=e166]: "Tap a square: preview a wall to its right."
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
            - generic [ref=e187]: "9"
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