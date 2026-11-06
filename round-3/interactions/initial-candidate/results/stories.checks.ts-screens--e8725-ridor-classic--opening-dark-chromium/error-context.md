# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-classic--opening dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  3026 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/opening-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/opening-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 3026 pixels (ratio 0.01 of all image pixels) are different.
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
  - 3026 pixels (ratio 0.01 of all image pixels) are different.

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
        - paragraph [ref=e24]: Your turn. Reach row 9.
        - generic [ref=e25]:
          - paragraph [ref=e30]: No moves yet.
          - button "All moves" [ref=e31] [cursor=pointer]:
            - img [ref=e35]
      - generic [ref=e37]:
        - generic [ref=e39]:
          - generic [ref=e41]:
            - generic [ref=e46]:
              - img "North gold diamond" [ref=e47]:
                - generic [ref=e48]: ◆
              - generic [ref=e49]: jordan_plays
            - generic [ref=e50]:
              - generic [ref=e51]: Walls
              - generic [ref=e52]: "10"
          - generic [ref=e54]:
            - group "Quoridor board, nine columns and nine rows" [ref=e55]:
              - generic [ref=e57]: a
              - generic [ref=e58]: b
              - generic [ref=e59]: c
              - generic [ref=e60]: d
              - generic [ref=e61]: e
              - generic [ref=e62]: f
              - generic [ref=e63]: g
              - generic [ref=e64]: h
              - generic [ref=e65]: i
              - generic [ref=e66]: "9"
              - 'button "a9: Empty" [disabled] [ref=e67]'
              - 'button "b9: Empty" [disabled] [ref=e68]'
              - 'button "c9: Empty" [disabled] [ref=e69]'
              - 'button "d9: Empty" [disabled] [ref=e70]'
              - 'button "e9: North gold diamond" [disabled] [ref=e71]':
                - generic: ◆
              - 'button "f9: Empty" [disabled] [ref=e72]'
              - 'button "g9: Empty" [disabled] [ref=e73]'
              - 'button "h9: Empty" [disabled] [ref=e74]'
              - 'button "i9: Empty" [disabled] [ref=e75]'
              - generic [ref=e76]: "8"
              - 'button "a8: Empty" [disabled] [ref=e77]'
              - 'button "b8: Empty" [disabled] [ref=e78]'
              - 'button "c8: Empty" [disabled] [ref=e79]'
              - 'button "d8: Empty" [disabled] [ref=e80]'
              - 'button "e8: Empty" [disabled] [ref=e81]'
              - 'button "f8: Empty" [disabled] [ref=e82]'
              - 'button "g8: Empty" [disabled] [ref=e83]'
              - 'button "h8: Empty" [disabled] [ref=e84]'
              - 'button "i8: Empty" [disabled] [ref=e85]'
              - generic [ref=e86]: "7"
              - 'button "a7: Empty" [disabled] [ref=e87]'
              - 'button "b7: Empty" [disabled] [ref=e88]'
              - 'button "c7: Empty" [disabled] [ref=e89]'
              - 'button "d7: Empty" [disabled] [ref=e90]'
              - 'button "e7: Empty" [disabled] [ref=e91]'
              - 'button "f7: Empty" [disabled] [ref=e92]'
              - 'button "g7: Empty" [disabled] [ref=e93]'
              - 'button "h7: Empty" [disabled] [ref=e94]'
              - 'button "i7: Empty" [disabled] [ref=e95]'
              - generic [ref=e96]: "6"
              - 'button "a6: Empty" [disabled] [ref=e97]'
              - 'button "b6: Empty" [disabled] [ref=e98]'
              - 'button "c6: Empty" [disabled] [ref=e99]'
              - 'button "d6: Empty" [disabled] [ref=e100]'
              - 'button "e6: Empty" [disabled] [ref=e101]'
              - 'button "f6: Empty" [disabled] [ref=e102]'
              - 'button "g6: Empty" [disabled] [ref=e103]'
              - 'button "h6: Empty" [disabled] [ref=e104]'
              - 'button "i6: Empty" [disabled] [ref=e105]'
              - generic [ref=e106]: "5"
              - 'button "a5: Empty" [disabled] [ref=e107]'
              - 'button "b5: Empty" [disabled] [ref=e108]'
              - 'button "c5: Empty" [disabled] [ref=e109]'
              - 'button "d5: Empty" [disabled] [ref=e110]'
              - 'button "e5: Empty" [disabled] [ref=e111]'
              - 'button "f5: Empty" [disabled] [ref=e112]'
              - 'button "g5: Empty" [disabled] [ref=e113]'
              - 'button "h5: Empty" [disabled] [ref=e114]'
              - 'button "i5: Empty" [disabled] [ref=e115]'
              - generic [ref=e116]: "4"
              - 'button "a4: Empty" [disabled] [ref=e117]'
              - 'button "b4: Empty" [disabled] [ref=e118]'
              - 'button "c4: Empty" [disabled] [ref=e119]'
              - 'button "d4: Empty" [disabled] [ref=e120]'
              - 'button "e4: Empty" [disabled] [ref=e121]'
              - 'button "f4: Empty" [disabled] [ref=e122]'
              - 'button "g4: Empty" [disabled] [ref=e123]'
              - 'button "h4: Empty" [disabled] [ref=e124]'
              - 'button "i4: Empty" [disabled] [ref=e125]'
              - generic [ref=e126]: "3"
              - 'button "a3: Empty" [disabled] [ref=e127]'
              - 'button "b3: Empty" [disabled] [ref=e128]'
              - 'button "c3: Empty" [disabled] [ref=e129]'
              - 'button "d3: Empty" [disabled] [ref=e130]'
              - 'button "e3: Empty" [disabled] [ref=e131]'
              - 'button "f3: Empty" [disabled] [ref=e132]'
              - 'button "g3: Empty" [disabled] [ref=e133]'
              - 'button "h3: Empty" [disabled] [ref=e134]'
              - 'button "i3: Empty" [disabled] [ref=e135]'
              - generic [ref=e136]: "2"
              - 'button "a2: Empty" [disabled] [ref=e137]'
              - 'button "b2: Empty" [disabled] [ref=e138]'
              - 'button "c2: Empty" [disabled] [ref=e139]'
              - 'button "d2: Empty" [disabled] [ref=e140]'
              - 'button "e2: Empty, legal move" [ref=e141] [cursor=pointer]':
                - generic: ·
              - 'button "f2: Empty" [disabled] [ref=e142]'
              - 'button "g2: Empty" [disabled] [ref=e143]'
              - 'button "h2: Empty" [disabled] [ref=e144]'
              - 'button "i2: Empty" [disabled] [ref=e145]'
              - generic [ref=e146]: "1"
              - 'button "a1: Empty" [disabled] [ref=e147]'
              - 'button "b1: Empty" [disabled] [ref=e148]'
              - 'button "c1: Empty" [disabled] [ref=e149]'
              - 'button "d1: Empty, legal move" [ref=e150] [cursor=pointer]':
                - generic: ·
              - 'button "e1: South red circle" [disabled] [ref=e151]':
                - generic: ●
              - 'button "f1: Empty, legal move" [ref=e152] [cursor=pointer]':
                - generic: ·
              - 'button "g1: Empty" [disabled] [ref=e153]'
              - 'button "h1: Empty" [disabled] [ref=e154]'
              - 'button "i1: Empty" [disabled] [ref=e155]'
            - status [ref=e156]: Choose a marked square to move your pawn.
          - status [ref=e158]:
            - generic [ref=e159]:
              - generic [ref=e160]: "South red circle: avery. North gold diamond: jordan_plays."
              - text: Your turn. Reach row 9.
          - generic [ref=e163]:
            - generic [ref=e168]:
              - img "South red circle" [ref=e169]:
                - generic [ref=e170]: ●
              - generic [ref=e171]: avery
              - generic [ref=e172]: Your move
            - generic [ref=e173]:
              - generic [ref=e174]: Walls
              - generic [ref=e175]: "10"
        - generic [ref=e178]:
          - group "Game actions" [ref=e179]:
            - button "Move pawn" [pressed] [ref=e180] [cursor=pointer]:
              - paragraph [ref=e183]: Move pawn
            - button "Horizontal wall" [ref=e184] [cursor=pointer]:
              - paragraph [ref=e187]: Horizontal wall
            - button "Vertical wall" [ref=e188] [cursor=pointer]:
              - paragraph [ref=e191]: Vertical wall
            - button "Offer draw" [ref=e192] [cursor=pointer]:
              - paragraph [ref=e195]: Offer draw
            - button "Resign game" [ref=e196] [cursor=pointer]:
              - paragraph [ref=e199]:
                - text: Resign
                - generic [ref=e200]: game
          - button "History and stats" [ref=e201] [cursor=pointer]:
            - generic [ref=e203]:
              - paragraph [ref=e204]: History and stats
              - img [ref=e207]
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