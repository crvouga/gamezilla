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
  62440 pixels (ratio 0.06 of all image pixels) are different.

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
  - 62440 pixels (ratio 0.06 of all image pixels) are different.
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
  - 62440 pixels (ratio 0.06 of all image pixels) are different.

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
          - generic [ref=e38]:
            - generic [ref=e39]: Walls
            - generic [ref=e40]: "9"
        - generic [ref=e42]:
          - generic [ref=e43]:
            - button "Move pawn" [ref=e44] [cursor=pointer]:
              - paragraph [ref=e47]: Move pawn
            - button "Horizontal wall" [ref=e48] [cursor=pointer]:
              - paragraph [ref=e51]: Wall across
            - button "Vertical wall" [pressed] [ref=e52] [cursor=pointer]:
              - paragraph [ref=e55]: Wall down
          - group "Quoridor board, nine columns and nine rows" [ref=e56]:
            - generic [ref=e58]: a
            - generic [ref=e59]: b
            - generic [ref=e60]: c
            - generic [ref=e61]: d
            - generic [ref=e62]: e
            - generic [ref=e63]: f
            - generic [ref=e64]: g
            - generic [ref=e65]: h
            - generic [ref=e66]: i
            - generic [ref=e67]: "9"
            - 'button "a9: Empty" [disabled] [ref=e68]'
            - 'button "b9: Empty" [disabled] [ref=e69]'
            - 'button "c9: Empty" [disabled] [ref=e70]'
            - 'button "d9: Empty" [disabled] [ref=e71]'
            - 'button "e9: North gold diamond" [disabled] [ref=e72]':
              - generic: ◆
            - 'button "f9: Empty" [disabled] [ref=e73]'
            - 'button "g9: Empty" [disabled] [ref=e74]'
            - 'button "h9: Empty" [disabled] [ref=e75]'
            - 'button "i9: Empty" [disabled] [ref=e76]'
            - generic [ref=e77]: "8"
            - 'button "a8: Empty" [ref=e78] [cursor=pointer]'
            - 'button "b8: Empty" [ref=e79] [cursor=pointer]'
            - 'button "c8: Empty" [ref=e80] [cursor=pointer]'
            - 'button "d8: Empty" [ref=e81] [cursor=pointer]'
            - 'button "e8: Empty" [ref=e82] [cursor=pointer]'
            - 'button "f8: Empty" [ref=e83] [cursor=pointer]'
            - 'button "g8: Empty" [ref=e84] [cursor=pointer]'
            - 'button "h8: Empty" [ref=e85] [cursor=pointer]'
            - 'button "i8: Empty" [disabled] [ref=e86]'
            - generic [ref=e87]: "7"
            - 'button "a7: Empty" [ref=e88] [cursor=pointer]'
            - 'button "b7: Empty" [ref=e89] [cursor=pointer]'
            - 'button "c7: Empty" [ref=e90] [cursor=pointer]'
            - 'button "d7: Empty" [ref=e91] [cursor=pointer]'
            - 'button "e7: Empty" [ref=e92] [cursor=pointer]'
            - 'button "f7: Empty" [ref=e93] [cursor=pointer]'
            - 'button "g7: Empty" [ref=e94] [cursor=pointer]'
            - 'button "h7: Empty" [ref=e95] [cursor=pointer]'
            - 'button "i7: Empty" [disabled] [ref=e96]'
            - generic [ref=e97]: "6"
            - 'button "a6: Empty" [ref=e98] [cursor=pointer]'
            - 'button "b6: Empty" [ref=e99] [cursor=pointer]'
            - 'button "c6: Empty" [ref=e100] [cursor=pointer]'
            - 'button "d6: Empty" [ref=e101] [cursor=pointer]'
            - 'button "e6: Empty, wall boundaries: bottom" [ref=e102] [cursor=pointer]'
            - 'button "f6: Empty, wall boundaries: bottom" [ref=e103] [cursor=pointer]'
            - 'button "g6: Empty" [ref=e104] [cursor=pointer]'
            - 'button "h6: Empty" [ref=e105] [cursor=pointer]'
            - 'button "i6: Empty" [disabled] [ref=e106]'
            - generic [ref=e107]: "5"
            - 'button "a5: Empty" [ref=e108] [cursor=pointer]'
            - 'button "b5: Empty" [ref=e109] [cursor=pointer]'
            - 'button "c5: Empty" [ref=e110] [cursor=pointer]'
            - 'button "d5: Empty" [ref=e111] [cursor=pointer]'
            - 'button "e5: Empty, wall boundaries: top" [ref=e112] [cursor=pointer]'
            - 'button "f5: Empty, wall boundaries: top" [ref=e113] [cursor=pointer]'
            - 'button "g5: Empty" [ref=e114] [cursor=pointer]'
            - 'button "h5: Empty" [ref=e115] [cursor=pointer]'
            - 'button "i5: Empty" [disabled] [ref=e116]'
            - generic [ref=e117]: "4"
            - 'button "a4: Empty" [ref=e118] [cursor=pointer]'
            - 'button "b4: Empty, wall boundaries: right" [ref=e119] [cursor=pointer]'
            - 'button "c4: Empty, wall boundaries: left" [ref=e120] [cursor=pointer]'
            - 'button "d4: Empty" [ref=e121] [cursor=pointer]'
            - 'button "e4: Empty" [ref=e122] [cursor=pointer]'
            - 'button "f4: Empty" [ref=e123] [cursor=pointer]'
            - 'button "g4: Empty" [ref=e124] [cursor=pointer]'
            - 'button "h4: Empty" [ref=e125] [cursor=pointer]'
            - 'button "i4: Empty" [disabled] [ref=e126]'
            - generic [ref=e127]: "3"
            - 'button "a3: Empty" [ref=e128] [cursor=pointer]'
            - 'button "b3: Empty, wall boundaries: right" [ref=e129] [cursor=pointer]'
            - 'button "c3: Empty, wall boundaries: left" [ref=e130] [cursor=pointer]'
            - 'button "d3: Empty" [ref=e131] [cursor=pointer]'
            - 'button "e3: Empty" [ref=e132] [cursor=pointer]'
            - 'button "f3: Empty" [ref=e133] [cursor=pointer]'
            - 'button "g3: Empty" [ref=e134] [cursor=pointer]'
            - 'button "h3: Empty" [ref=e135] [cursor=pointer]'
            - 'button "i3: Empty" [disabled] [ref=e136]'
            - generic [ref=e137]: "2"
            - 'button "a2: Empty" [ref=e138] [cursor=pointer]'
            - 'button "b2: Empty" [ref=e139] [cursor=pointer]'
            - 'button "c2: Empty" [ref=e140] [cursor=pointer]'
            - 'button "d2: Empty" [ref=e141] [cursor=pointer]'
            - 'button "e2: Empty" [ref=e142] [cursor=pointer]'
            - 'button "f2: Empty" [ref=e143] [cursor=pointer]'
            - 'button "g2: Empty" [ref=e144] [cursor=pointer]'
            - 'button "h2: Empty" [ref=e145] [cursor=pointer]'
            - 'button "i2: Empty" [disabled] [ref=e146]'
            - generic [ref=e147]: "1"
            - 'button "a1: Empty" [ref=e148] [cursor=pointer]'
            - 'button "b1: Empty" [ref=e149] [cursor=pointer]'
            - 'button "c1: Empty" [ref=e150] [cursor=pointer]'
            - 'button "d1: Empty" [ref=e151] [cursor=pointer]'
            - 'button "e1: South red circle" [ref=e152] [cursor=pointer]':
              - generic: ●
            - 'button "f1: Empty" [ref=e153] [cursor=pointer]'
            - 'button "g1: Empty" [ref=e154] [cursor=pointer]'
            - 'button "h1: Empty" [ref=e155] [cursor=pointer]'
            - 'button "i1: Empty" [disabled] [ref=e156]'
          - generic [ref=e157]:
            - paragraph [ref=e158]: Preview a wall at a coordinate
            - button "Preview a wall at a coordinate" [ref=e159] [cursor=pointer]:
              - paragraph [ref=e160]: Select…
              - img [ref=e162]
          - status [ref=e164]: "Vertical wall: choose a square to preview its right boundary."
        - status [ref=e166]:
          - generic [ref=e167]:
            - generic [ref=e168]: "South red circle: avery. North gold diamond: jordan_plays."
            - text: Your turn. Reach row 9.
        - generic [ref=e171]:
          - generic [ref=e176]:
            - img "South red circle" [ref=e177]:
              - generic [ref=e178]: ●
            - generic [ref=e179]: avery
            - generic [ref=e180]: Your move
          - generic [ref=e181]:
            - generic [ref=e182]: Walls
            - generic [ref=e183]: "9"
      - region "Game record" [ref=e186]:
        - generic [ref=e187]:
          - heading "Game record" [level=2] [ref=e189]
          - paragraph [ref=e190]: Your turn. Reach row 9.
        - generic [ref=e192]:
          - group "Game actions" [ref=e193]:
            - button "Offer draw" [ref=e194] [cursor=pointer]:
              - paragraph [ref=e197]: Offer draw
            - button "Resign game" [ref=e198] [cursor=pointer]:
              - paragraph [ref=e201]:
                - text: Resign
                - generic [ref=e202]: game
          - button "History and stats" [ref=e203] [cursor=pointer]:
            - paragraph [ref=e206]: History and stats
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