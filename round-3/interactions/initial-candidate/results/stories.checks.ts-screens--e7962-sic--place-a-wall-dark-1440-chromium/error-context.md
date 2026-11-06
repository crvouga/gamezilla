# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-classic--place-a-wall dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  6202 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/place-a-wall-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/place-a-wall-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 6202 pixels (ratio 0.01 of all image pixels) are different.
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
  - 6202 pixels (ratio 0.01 of all image pixels) are different.

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
          - group "Quoridor board, nine columns and nine rows" [ref=e43]:
            - generic [ref=e45]: a
            - generic [ref=e46]: b
            - generic [ref=e47]: c
            - generic [ref=e48]: d
            - generic [ref=e49]: e
            - generic [ref=e50]: f
            - generic [ref=e51]: g
            - generic [ref=e52]: h
            - generic [ref=e53]: i
            - generic [ref=e54]: "9"
            - 'button "a9: Empty" [disabled] [ref=e55]'
            - 'button "b9: Empty" [disabled] [ref=e56]'
            - 'button "c9: Empty" [disabled] [ref=e57]'
            - 'button "d9: Empty" [disabled] [ref=e58]'
            - 'button "e9: North gold diamond" [disabled] [ref=e59]':
              - generic: ◆
            - 'button "f9: Empty" [disabled] [ref=e60]'
            - 'button "g9: Empty" [disabled] [ref=e61]'
            - 'button "h9: Empty" [disabled] [ref=e62]'
            - 'button "i9: Empty" [disabled] [ref=e63]'
            - generic [ref=e64]: "8"
            - 'button "a8: Empty" [ref=e65] [cursor=pointer]'
            - 'button "b8: Empty" [ref=e66] [cursor=pointer]'
            - 'button "c8: Empty" [ref=e67] [cursor=pointer]'
            - 'button "d8: Empty" [ref=e68] [cursor=pointer]'
            - 'button "e8: Empty" [ref=e69] [cursor=pointer]'
            - 'button "f8: Empty" [ref=e70] [cursor=pointer]'
            - 'button "g8: Empty" [ref=e71] [cursor=pointer]'
            - 'button "h8: Empty" [ref=e72] [cursor=pointer]'
            - 'button "i8: Empty" [disabled] [ref=e73]'
            - generic [ref=e74]: "7"
            - 'button "a7: Empty" [ref=e75] [cursor=pointer]'
            - 'button "b7: Empty" [ref=e76] [cursor=pointer]'
            - 'button "c7: Empty" [ref=e77] [cursor=pointer]'
            - 'button "d7: Empty" [ref=e78] [cursor=pointer]'
            - 'button "e7: Empty" [ref=e79] [cursor=pointer]'
            - 'button "f7: Empty" [ref=e80] [cursor=pointer]'
            - 'button "g7: Empty" [ref=e81] [cursor=pointer]'
            - 'button "h7: Empty" [ref=e82] [cursor=pointer]'
            - 'button "i7: Empty" [disabled] [ref=e83]'
            - generic [ref=e84]: "6"
            - 'button "a6: Empty" [ref=e85] [cursor=pointer]'
            - 'button "b6: Empty" [ref=e86] [cursor=pointer]'
            - 'button "c6: Empty" [ref=e87] [cursor=pointer]'
            - 'button "d6: Empty" [ref=e88] [cursor=pointer]'
            - 'button "e6: Empty, wall boundaries: bottom" [ref=e89] [cursor=pointer]'
            - 'button "f6: Empty, wall boundaries: bottom" [ref=e90] [cursor=pointer]'
            - 'button "g6: Empty" [ref=e91] [cursor=pointer]'
            - 'button "h6: Empty" [ref=e92] [cursor=pointer]'
            - 'button "i6: Empty" [disabled] [ref=e93]'
            - generic [ref=e94]: "5"
            - 'button "a5: Empty" [ref=e95] [cursor=pointer]'
            - 'button "b5: Empty" [ref=e96] [cursor=pointer]'
            - 'button "c5: Empty" [ref=e97] [cursor=pointer]'
            - 'button "d5: Empty" [ref=e98] [cursor=pointer]'
            - 'button "e5: Empty, wall boundaries: top" [ref=e99] [cursor=pointer]'
            - 'button "f5: Empty, wall boundaries: top" [ref=e100] [cursor=pointer]'
            - 'button "g5: Empty" [ref=e101] [cursor=pointer]'
            - 'button "h5: Empty" [ref=e102] [cursor=pointer]'
            - 'button "i5: Empty" [disabled] [ref=e103]'
            - generic [ref=e104]: "4"
            - 'button "a4: Empty" [ref=e105] [cursor=pointer]'
            - 'button "b4: Empty, wall boundaries: right" [ref=e106] [cursor=pointer]'
            - 'button "c4: Empty, wall boundaries: left" [ref=e107] [cursor=pointer]'
            - 'button "d4: Empty" [ref=e108] [cursor=pointer]'
            - 'button "e4: Empty" [ref=e109] [cursor=pointer]'
            - 'button "f4: Empty" [ref=e110] [cursor=pointer]'
            - 'button "g4: Empty" [ref=e111] [cursor=pointer]'
            - 'button "h4: Empty" [ref=e112] [cursor=pointer]'
            - 'button "i4: Empty" [disabled] [ref=e113]'
            - generic [ref=e114]: "3"
            - 'button "a3: Empty" [ref=e115] [cursor=pointer]'
            - 'button "b3: Empty, wall boundaries: right" [ref=e116] [cursor=pointer]'
            - 'button "c3: Empty, wall boundaries: left" [ref=e117] [cursor=pointer]'
            - 'button "d3: Empty" [ref=e118] [cursor=pointer]'
            - 'button "e3: Empty" [ref=e119] [cursor=pointer]'
            - 'button "f3: Empty" [ref=e120] [cursor=pointer]'
            - 'button "g3: Empty" [ref=e121] [cursor=pointer]'
            - 'button "h3: Empty" [ref=e122] [cursor=pointer]'
            - 'button "i3: Empty" [disabled] [ref=e123]'
            - generic [ref=e124]: "2"
            - 'button "a2: Empty" [ref=e125] [cursor=pointer]'
            - 'button "b2: Empty" [ref=e126] [cursor=pointer]'
            - 'button "c2: Empty" [ref=e127] [cursor=pointer]'
            - 'button "d2: Empty" [ref=e128] [cursor=pointer]'
            - 'button "e2: Empty" [ref=e129] [cursor=pointer]'
            - 'button "f2: Empty" [ref=e130] [cursor=pointer]'
            - 'button "g2: Empty" [ref=e131] [cursor=pointer]'
            - 'button "h2: Empty" [ref=e132] [cursor=pointer]'
            - 'button "i2: Empty" [disabled] [ref=e133]'
            - generic [ref=e134]: "1"
            - 'button "a1: Empty" [ref=e135] [cursor=pointer]'
            - 'button "b1: Empty" [ref=e136] [cursor=pointer]'
            - 'button "c1: Empty" [ref=e137] [cursor=pointer]'
            - 'button "d1: Empty" [ref=e138] [cursor=pointer]'
            - 'button "e1: South red circle" [ref=e139] [cursor=pointer]':
              - generic: ●
            - 'button "f1: Empty" [ref=e140] [cursor=pointer]'
            - 'button "g1: Empty" [ref=e141] [cursor=pointer]'
            - 'button "h1: Empty" [ref=e142] [cursor=pointer]'
            - 'button "i1: Empty" [disabled] [ref=e143]'
          - status [ref=e144]: "Vertical wall: choose a square to preview its right boundary."
        - status [ref=e146]:
          - generic [ref=e147]:
            - generic [ref=e148]: "South red circle: avery. North gold diamond: jordan_plays."
            - text: Your turn. Reach row 9.
        - generic [ref=e151]:
          - generic [ref=e156]:
            - img "South red circle" [ref=e157]:
              - generic [ref=e158]: ●
            - generic [ref=e159]: avery
            - generic [ref=e160]: Your move
          - generic [ref=e161]:
            - generic [ref=e162]: Walls
            - generic [ref=e163]: "9"
      - region "Game record" [ref=e166]:
        - generic [ref=e167]:
          - heading "Game record" [level=2] [ref=e169]
          - paragraph [ref=e170]: Your turn. Reach row 9.
        - generic [ref=e172]:
          - group "Game actions" [ref=e173]:
            - button "Move pawn" [ref=e174] [cursor=pointer]:
              - paragraph [ref=e177]: Move pawn
            - button "Horizontal wall" [ref=e178] [cursor=pointer]:
              - paragraph [ref=e181]: Horizontal wall
            - button "Vertical wall" [pressed] [ref=e182] [cursor=pointer]:
              - paragraph [ref=e185]: Vertical wall
            - button "Offer draw" [ref=e186] [cursor=pointer]:
              - paragraph [ref=e189]: Offer draw
            - button "Resign game" [ref=e190] [cursor=pointer]:
              - paragraph [ref=e193]:
                - text: Resign
                - generic [ref=e194]: game
          - button "History and stats" [ref=e195] [cursor=pointer]:
            - paragraph [ref=e198]: History and stats
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