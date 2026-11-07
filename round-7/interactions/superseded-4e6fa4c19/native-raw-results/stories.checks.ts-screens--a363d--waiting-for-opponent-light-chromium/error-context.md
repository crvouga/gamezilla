# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-classic--waiting-for-opponent light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  25230 pixels (ratio 0.08 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/waiting-for-opponent-light.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/waiting-for-opponent-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 25230 pixels (ratio 0.08 of all image pixels) are different.
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
  - 25230 pixels (ratio 0.08 of all image pixels) are different.

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
        - paragraph [ref=e24]: North gold diamond to move, heading for row 1.
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
              - generic "jordan_plays" [ref=e51]
              - generic [ref=e52]: To move
            - generic [ref=e53]:
              - generic [ref=e54]: Walls
              - generic [ref=e55]: "9"
          - generic [ref=e57]:
            - generic [ref=e58]:
              - button "Move pawn" [disabled] [pressed] [ref=e59]:
                - paragraph [ref=e62]: Move
              - button "Horizontal wall" [disabled] [ref=e63]:
                - paragraph [ref=e66]: Horizontal wall
              - button "Vertical wall" [disabled] [ref=e67]:
                - paragraph [ref=e70]: Vertical wall
            - group "Quoridor board, nine columns and nine rows" [ref=e71]:
              - generic [ref=e73]: a
              - generic [ref=e74]: b
              - generic [ref=e75]: c
              - generic [ref=e76]: d
              - generic [ref=e77]: e
              - generic [ref=e78]: f
              - generic [ref=e79]: g
              - generic [ref=e80]: h
              - generic [ref=e81]: i
              - generic [ref=e82]: "9"
              - 'button "a9: Empty" [disabled] [ref=e83]'
              - 'button "b9: Empty" [disabled] [ref=e84]'
              - 'button "c9: Empty" [disabled] [ref=e85]'
              - 'button "d9: Empty" [disabled] [ref=e86]'
              - 'button "e9: Empty" [disabled] [ref=e87]'
              - 'button "f9: Empty" [disabled] [ref=e88]'
              - 'button "g9: Empty" [disabled] [ref=e89]'
              - 'button "h9: Empty" [disabled] [ref=e90]'
              - 'button "i9: Empty" [disabled] [ref=e91]'
              - generic [ref=e92]: "8"
              - 'button "a8: Empty" [disabled] [ref=e93]'
              - 'button "b8: Empty" [disabled] [ref=e94]'
              - 'button "c8: Empty" [disabled] [ref=e95]'
              - 'button "d8: Empty, wall boundaries: bottom" [disabled] [ref=e96]'
              - 'button "e8: Empty, wall boundaries: bottom" [disabled] [ref=e97]'
              - 'button "f8: Empty" [disabled] [ref=e98]'
              - 'button "g8: Empty" [disabled] [ref=e99]'
              - 'button "h8: Empty" [disabled] [ref=e100]'
              - 'button "i8: Empty" [disabled] [ref=e101]'
              - generic [ref=e102]: "7"
              - 'button "a7: Empty" [disabled] [ref=e103]'
              - 'button "b7: Empty" [disabled] [ref=e104]'
              - 'button "c7: Empty" [disabled] [ref=e105]'
              - 'button "d7: Empty, wall boundaries: top" [disabled] [ref=e106]'
              - 'button "e7: Empty, legal move, wall boundaries: top" [disabled] [ref=e107]':
                - generic: ·
              - 'button "f7: Empty, wall boundaries: right" [disabled] [ref=e108]'
              - 'button "g7: Empty, wall boundaries: left" [disabled] [ref=e109]'
              - 'button "h7: Empty" [disabled] [ref=e110]'
              - 'button "i7: Empty" [disabled] [ref=e111]'
              - generic [ref=e112]: "6"
              - 'button "a6: Empty" [disabled] [ref=e113]'
              - 'button "b6: Empty" [disabled] [ref=e114]'
              - 'button "c6: Empty" [disabled] [ref=e115]'
              - 'button "d6: Empty, legal move" [disabled] [ref=e116]':
                - generic: ·
              - 'button "e6: North gold diamond" [disabled] [ref=e117]':
                - generic: ◆
              - 'button "f6: Empty, legal move, wall boundaries: right" [disabled] [ref=e118]':
                - generic: ·
              - 'button "g6: Empty, wall boundaries: left" [disabled] [ref=e119]'
              - 'button "h6: Empty" [disabled] [ref=e120]'
              - 'button "i6: Empty" [disabled] [ref=e121]'
              - generic [ref=e122]: "5"
              - 'button "a5: Empty" [disabled] [ref=e123]'
              - 'button "b5: Empty" [disabled] [ref=e124]'
              - 'button "c5: Empty" [disabled] [ref=e125]'
              - 'button "d5: Empty, wall boundaries: bottom" [disabled] [ref=e126]'
              - 'button "e5: Empty, legal move, wall boundaries: bottom" [disabled] [ref=e127]':
                - generic: ·
              - 'button "f5: Empty" [disabled] [ref=e128]'
              - 'button "g5: Empty" [disabled] [ref=e129]'
              - 'button "h5: Empty" [disabled] [ref=e130]'
              - 'button "i5: Empty" [disabled] [ref=e131]'
              - generic [ref=e132]: "4"
              - 'button "a4: Empty" [disabled] [ref=e133]'
              - 'button "b4: Empty" [disabled] [ref=e134]'
              - 'button "c4: Empty, wall boundaries: right" [disabled] [ref=e135]'
              - 'button "d4: Empty, wall boundaries: top, left" [disabled] [ref=e136]'
              - 'button "e4: Empty, wall boundaries: top" [disabled] [ref=e137]'
              - 'button "f4: Empty" [disabled] [ref=e138]'
              - 'button "g4: Empty" [disabled] [ref=e139]'
              - 'button "h4: Empty" [disabled] [ref=e140]'
              - 'button "i4: Empty" [disabled] [ref=e141]'
              - generic [ref=e142]: "3"
              - 'button "a3: Empty" [disabled] [ref=e143]'
              - 'button "b3: Empty" [disabled] [ref=e144]'
              - 'button "c3: Empty, wall boundaries: right" [disabled] [ref=e145]'
              - 'button "d3: Empty, wall boundaries: left" [disabled] [ref=e146]'
              - 'button "e3: South red circle" [disabled] [ref=e147]':
                - generic: ●
              - 'button "f3: Empty" [disabled] [ref=e148]'
              - 'button "g3: Empty" [disabled] [ref=e149]'
              - 'button "h3: Empty" [disabled] [ref=e150]'
              - 'button "i3: Empty" [disabled] [ref=e151]'
              - generic [ref=e152]: "2"
              - 'button "a2: Empty" [disabled] [ref=e153]'
              - 'button "b2: Empty" [disabled] [ref=e154]'
              - 'button "c2: Empty" [disabled] [ref=e155]'
              - 'button "d2: Empty" [disabled] [ref=e156]'
              - 'button "e2: Empty" [disabled] [ref=e157]'
              - 'button "f2: Empty" [disabled] [ref=e158]'
              - 'button "g2: Empty" [disabled] [ref=e159]'
              - 'button "h2: Empty" [disabled] [ref=e160]'
              - 'button "i2: Empty" [disabled] [ref=e161]'
              - generic [ref=e162]: "1"
              - 'button "a1: Empty, goal edge" [disabled] [ref=e163]'
              - 'button "b1: Empty, goal edge" [disabled] [ref=e164]'
              - 'button "c1: Empty, goal edge" [disabled] [ref=e165]'
              - 'button "d1: Empty, goal edge" [disabled] [ref=e166]'
              - 'button "e1: Empty, goal edge" [disabled] [ref=e167]'
              - 'button "f1: Empty, goal edge" [disabled] [ref=e168]'
              - 'button "g1: Empty, goal edge" [disabled] [ref=e169]'
              - 'button "h1: Empty, goal edge" [disabled] [ref=e170]'
              - 'button "i1: Empty, goal edge" [disabled] [ref=e171]'
            - status [ref=e172]: This board is read-only. Follow the game or review earlier moves.
          - status [ref=e174]:
            - generic [ref=e175]:
              - generic [ref=e176]: "South red circle: avery. North gold diamond: jordan_plays."
              - text: North gold diamond to move, heading for row 1.
          - generic [ref=e179]:
            - generic [ref=e184]:
              - img "South red circle" [ref=e185]:
                - generic [ref=e186]: ●
              - generic "avery" [ref=e189]
            - generic [ref=e190]:
              - generic [ref=e191]: Walls
              - generic [ref=e192]: "7"
        - generic [ref=e195]:
          - group "Game actions" [ref=e196]:
            - button "Offer draw" [ref=e197] [cursor=pointer]:
              - paragraph [ref=e200]: Offer draw
            - button "Resign game" [ref=e201] [cursor=pointer]:
              - paragraph [ref=e204]:
                - text: Resign
                - generic [ref=e205]: game
          - button "History and stats" [ref=e206] [cursor=pointer]:
            - generic [ref=e208]:
              - paragraph [ref=e209]: History and stats
              - img [ref=e212]
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