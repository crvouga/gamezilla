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
  4713 pixels (ratio 0.01 of all image pixels) are different.

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
  - 4713 pixels (ratio 0.01 of all image pixels) are different.
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
  - 4713 pixels (ratio 0.01 of all image pixels) are different.

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
          - group "Quoridor board, nine columns and nine rows" [ref=e44]:
            - generic [ref=e46]: a
            - generic [ref=e47]: b
            - generic [ref=e48]: c
            - generic [ref=e49]: d
            - generic [ref=e50]: e
            - generic [ref=e51]: f
            - generic [ref=e52]: g
            - generic [ref=e53]: h
            - generic [ref=e54]: i
            - generic [ref=e55]: "9"
            - 'button "a9: Empty" [disabled] [ref=e56]'
            - 'button "b9: Empty" [disabled] [ref=e57]'
            - 'button "c9: Empty" [disabled] [ref=e58]'
            - 'button "d9: Empty" [disabled] [ref=e59]'
            - 'button "e9: Empty" [disabled] [ref=e60]'
            - 'button "f9: Empty" [disabled] [ref=e61]'
            - 'button "g9: Empty" [disabled] [ref=e62]'
            - 'button "h9: Empty" [disabled] [ref=e63]'
            - 'button "i9: Empty" [disabled] [ref=e64]'
            - generic [ref=e65]: "8"
            - 'button "a8: Empty" [disabled] [ref=e66]'
            - 'button "b8: Empty" [disabled] [ref=e67]'
            - 'button "c8: Empty" [disabled] [ref=e68]'
            - 'button "d8: Empty, wall boundaries: bottom" [disabled] [ref=e69]'
            - 'button "e8: Empty, wall boundaries: bottom" [disabled] [ref=e70]'
            - 'button "f8: Empty" [disabled] [ref=e71]'
            - 'button "g8: Empty" [disabled] [ref=e72]'
            - 'button "h8: Empty" [disabled] [ref=e73]'
            - 'button "i8: Empty" [disabled] [ref=e74]'
            - generic [ref=e75]: "7"
            - 'button "a7: Empty" [disabled] [ref=e76]'
            - 'button "b7: Empty" [disabled] [ref=e77]'
            - 'button "c7: Empty" [disabled] [ref=e78]'
            - 'button "d7: Empty, wall boundaries: top" [disabled] [ref=e79]'
            - 'button "e7: Empty, legal move, wall boundaries: top" [disabled] [ref=e80]':
              - generic: ·
            - 'button "f7: Empty, wall boundaries: right" [disabled] [ref=e81]'
            - 'button "g7: Empty, wall boundaries: left" [disabled] [ref=e82]'
            - 'button "h7: Empty" [disabled] [ref=e83]'
            - 'button "i7: Empty" [disabled] [ref=e84]'
            - generic [ref=e85]: "6"
            - 'button "a6: Empty" [disabled] [ref=e86]'
            - 'button "b6: Empty" [disabled] [ref=e87]'
            - 'button "c6: Empty" [disabled] [ref=e88]'
            - 'button "d6: Empty, legal move" [disabled] [ref=e89]':
              - generic: ·
            - 'button "e6: North gold diamond" [disabled] [ref=e90]':
              - generic: ◆
            - 'button "f6: Empty, legal move, wall boundaries: right" [disabled] [ref=e91]':
              - generic: ·
            - 'button "g6: Empty, wall boundaries: left" [disabled] [ref=e92]'
            - 'button "h6: Empty" [disabled] [ref=e93]'
            - 'button "i6: Empty" [disabled] [ref=e94]'
            - generic [ref=e95]: "5"
            - 'button "a5: Empty" [disabled] [ref=e96]'
            - 'button "b5: Empty" [disabled] [ref=e97]'
            - 'button "c5: Empty" [disabled] [ref=e98]'
            - 'button "d5: Empty, wall boundaries: bottom" [disabled] [ref=e99]'
            - 'button "e5: Empty, legal move, wall boundaries: bottom" [disabled] [ref=e100]':
              - generic: ·
            - 'button "f5: Empty" [disabled] [ref=e101]'
            - 'button "g5: Empty" [disabled] [ref=e102]'
            - 'button "h5: Empty" [disabled] [ref=e103]'
            - 'button "i5: Empty" [disabled] [ref=e104]'
            - generic [ref=e105]: "4"
            - 'button "a4: Empty" [disabled] [ref=e106]'
            - 'button "b4: Empty" [disabled] [ref=e107]'
            - 'button "c4: Empty, wall boundaries: right" [disabled] [ref=e108]'
            - 'button "d4: Empty, wall boundaries: top, left" [disabled] [ref=e109]'
            - 'button "e4: Empty, wall boundaries: top" [disabled] [ref=e110]'
            - 'button "f4: Empty" [disabled] [ref=e111]'
            - 'button "g4: Empty" [disabled] [ref=e112]'
            - 'button "h4: Empty" [disabled] [ref=e113]'
            - 'button "i4: Empty" [disabled] [ref=e114]'
            - generic [ref=e115]: "3"
            - 'button "a3: Empty" [disabled] [ref=e116]'
            - 'button "b3: Empty" [disabled] [ref=e117]'
            - 'button "c3: Empty, wall boundaries: right" [disabled] [ref=e118]'
            - 'button "d3: Empty, wall boundaries: left" [disabled] [ref=e119]'
            - 'button "e3: South red circle" [disabled] [ref=e120]':
              - generic: ●
            - 'button "f3: Empty" [disabled] [ref=e121]'
            - 'button "g3: Empty" [disabled] [ref=e122]'
            - 'button "h3: Empty" [disabled] [ref=e123]'
            - 'button "i3: Empty" [disabled] [ref=e124]'
            - generic [ref=e125]: "2"
            - 'button "a2: Empty" [disabled] [ref=e126]'
            - 'button "b2: Empty" [disabled] [ref=e127]'
            - 'button "c2: Empty" [disabled] [ref=e128]'
            - 'button "d2: Empty" [disabled] [ref=e129]'
            - 'button "e2: Empty" [disabled] [ref=e130]'
            - 'button "f2: Empty" [disabled] [ref=e131]'
            - 'button "g2: Empty" [disabled] [ref=e132]'
            - 'button "h2: Empty" [disabled] [ref=e133]'
            - 'button "i2: Empty" [disabled] [ref=e134]'
            - generic [ref=e135]: "1"
            - 'button "a1: Empty" [disabled] [ref=e136]'
            - 'button "b1: Empty" [disabled] [ref=e137]'
            - 'button "c1: Empty" [disabled] [ref=e138]'
            - 'button "d1: Empty" [disabled] [ref=e139]'
            - 'button "e1: Empty" [disabled] [ref=e140]'
            - 'button "f1: Empty" [disabled] [ref=e141]'
            - 'button "g1: Empty" [disabled] [ref=e142]'
            - 'button "h1: Empty" [disabled] [ref=e143]'
            - 'button "i1: Empty" [disabled] [ref=e144]'
          - status [ref=e145]: This board is read-only. Follow the game or review earlier moves.
        - status [ref=e147]:
          - generic [ref=e148]:
            - generic [ref=e149]: "South red circle: avery. North gold diamond: jordan_plays."
            - text: North gold diamond to move, heading for row 1.
        - generic [ref=e152]:
          - generic [ref=e157]:
            - img "South red circle" [ref=e158]:
              - generic [ref=e159]: ●
            - generic [ref=e160]: avery
          - generic [ref=e161]:
            - generic [ref=e162]: Walls
            - generic [ref=e163]: "7"
      - region "Game record" [ref=e166]:
        - generic [ref=e167]:
          - heading "Game record" [level=2] [ref=e169]
          - paragraph [ref=e170]: North gold diamond to move, heading for row 1.
        - generic [ref=e172]:
          - group "Game actions" [ref=e173]:
            - button "Move pawn" [disabled] [pressed] [ref=e174]:
              - paragraph [ref=e177]: Move pawn
            - button "Horizontal wall" [disabled] [ref=e178]:
              - paragraph [ref=e181]: Horizontal wall
            - button "Vertical wall" [disabled] [ref=e182]:
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