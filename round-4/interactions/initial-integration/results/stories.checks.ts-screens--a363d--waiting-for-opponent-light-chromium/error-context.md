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
  29088 pixels (ratio 0.09 of all image pixels) are different.

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
  - 29088 pixels (ratio 0.09 of all image pixels) are different.
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
  - 29088 pixels (ratio 0.09 of all image pixels) are different.

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
              - generic [ref=e49]: jordan_plays
              - generic [ref=e50]: To move
            - generic [ref=e51]:
              - generic [ref=e52]: Walls
              - generic [ref=e53]: "9"
          - generic [ref=e55]:
            - generic [ref=e56]:
              - button "Move pawn" [disabled] [pressed] [ref=e57]:
                - paragraph [ref=e60]: Move pawn
              - button "Horizontal wall" [disabled] [ref=e61]:
                - paragraph [ref=e64]: Horizontal wall
              - button "Vertical wall" [disabled] [ref=e65]:
                - paragraph [ref=e68]: Vertical wall
            - group "Quoridor board, nine columns and nine rows" [ref=e69]:
              - generic [ref=e71]: a
              - generic [ref=e72]: b
              - generic [ref=e73]: c
              - generic [ref=e74]: d
              - generic [ref=e75]: e
              - generic [ref=e76]: f
              - generic [ref=e77]: g
              - generic [ref=e78]: h
              - generic [ref=e79]: i
              - generic [ref=e80]: "9"
              - 'button "a9: Empty" [disabled] [ref=e81]'
              - 'button "b9: Empty" [disabled] [ref=e82]'
              - 'button "c9: Empty" [disabled] [ref=e83]'
              - 'button "d9: Empty" [disabled] [ref=e84]'
              - 'button "e9: Empty" [disabled] [ref=e85]'
              - 'button "f9: Empty" [disabled] [ref=e86]'
              - 'button "g9: Empty" [disabled] [ref=e87]'
              - 'button "h9: Empty" [disabled] [ref=e88]'
              - 'button "i9: Empty" [disabled] [ref=e89]'
              - generic [ref=e90]: "8"
              - 'button "a8: Empty" [disabled] [ref=e91]'
              - 'button "b8: Empty" [disabled] [ref=e92]'
              - 'button "c8: Empty" [disabled] [ref=e93]'
              - 'button "d8: Empty, wall boundaries: bottom" [disabled] [ref=e94]'
              - 'button "e8: Empty, wall boundaries: bottom" [disabled] [ref=e95]'
              - 'button "f8: Empty" [disabled] [ref=e96]'
              - 'button "g8: Empty" [disabled] [ref=e97]'
              - 'button "h8: Empty" [disabled] [ref=e98]'
              - 'button "i8: Empty" [disabled] [ref=e99]'
              - generic [ref=e100]: "7"
              - 'button "a7: Empty" [disabled] [ref=e101]'
              - 'button "b7: Empty" [disabled] [ref=e102]'
              - 'button "c7: Empty" [disabled] [ref=e103]'
              - 'button "d7: Empty, wall boundaries: top" [disabled] [ref=e104]'
              - 'button "e7: Empty, legal move, wall boundaries: top" [disabled] [ref=e105]':
                - generic: ·
              - 'button "f7: Empty, wall boundaries: right" [disabled] [ref=e106]'
              - 'button "g7: Empty, wall boundaries: left" [disabled] [ref=e107]'
              - 'button "h7: Empty" [disabled] [ref=e108]'
              - 'button "i7: Empty" [disabled] [ref=e109]'
              - generic [ref=e110]: "6"
              - 'button "a6: Empty" [disabled] [ref=e111]'
              - 'button "b6: Empty" [disabled] [ref=e112]'
              - 'button "c6: Empty" [disabled] [ref=e113]'
              - 'button "d6: Empty, legal move" [disabled] [ref=e114]':
                - generic: ·
              - 'button "e6: North gold diamond" [disabled] [ref=e115]':
                - generic: ◆
              - 'button "f6: Empty, legal move, wall boundaries: right" [disabled] [ref=e116]':
                - generic: ·
              - 'button "g6: Empty, wall boundaries: left" [disabled] [ref=e117]'
              - 'button "h6: Empty" [disabled] [ref=e118]'
              - 'button "i6: Empty" [disabled] [ref=e119]'
              - generic [ref=e120]: "5"
              - 'button "a5: Empty" [disabled] [ref=e121]'
              - 'button "b5: Empty" [disabled] [ref=e122]'
              - 'button "c5: Empty" [disabled] [ref=e123]'
              - 'button "d5: Empty, wall boundaries: bottom" [disabled] [ref=e124]'
              - 'button "e5: Empty, legal move, wall boundaries: bottom" [disabled] [ref=e125]':
                - generic: ·
              - 'button "f5: Empty" [disabled] [ref=e126]'
              - 'button "g5: Empty" [disabled] [ref=e127]'
              - 'button "h5: Empty" [disabled] [ref=e128]'
              - 'button "i5: Empty" [disabled] [ref=e129]'
              - generic [ref=e130]: "4"
              - 'button "a4: Empty" [disabled] [ref=e131]'
              - 'button "b4: Empty" [disabled] [ref=e132]'
              - 'button "c4: Empty, wall boundaries: right" [disabled] [ref=e133]'
              - 'button "d4: Empty, wall boundaries: top, left" [disabled] [ref=e134]'
              - 'button "e4: Empty, wall boundaries: top" [disabled] [ref=e135]'
              - 'button "f4: Empty" [disabled] [ref=e136]'
              - 'button "g4: Empty" [disabled] [ref=e137]'
              - 'button "h4: Empty" [disabled] [ref=e138]'
              - 'button "i4: Empty" [disabled] [ref=e139]'
              - generic [ref=e140]: "3"
              - 'button "a3: Empty" [disabled] [ref=e141]'
              - 'button "b3: Empty" [disabled] [ref=e142]'
              - 'button "c3: Empty, wall boundaries: right" [disabled] [ref=e143]'
              - 'button "d3: Empty, wall boundaries: left" [disabled] [ref=e144]'
              - 'button "e3: South red circle" [disabled] [ref=e145]':
                - generic: ●
              - 'button "f3: Empty" [disabled] [ref=e146]'
              - 'button "g3: Empty" [disabled] [ref=e147]'
              - 'button "h3: Empty" [disabled] [ref=e148]'
              - 'button "i3: Empty" [disabled] [ref=e149]'
              - generic [ref=e150]: "2"
              - 'button "a2: Empty" [disabled] [ref=e151]'
              - 'button "b2: Empty" [disabled] [ref=e152]'
              - 'button "c2: Empty" [disabled] [ref=e153]'
              - 'button "d2: Empty" [disabled] [ref=e154]'
              - 'button "e2: Empty" [disabled] [ref=e155]'
              - 'button "f2: Empty" [disabled] [ref=e156]'
              - 'button "g2: Empty" [disabled] [ref=e157]'
              - 'button "h2: Empty" [disabled] [ref=e158]'
              - 'button "i2: Empty" [disabled] [ref=e159]'
              - generic [ref=e160]: "1"
              - 'button "a1: Empty" [disabled] [ref=e161]'
              - 'button "b1: Empty" [disabled] [ref=e162]'
              - 'button "c1: Empty" [disabled] [ref=e163]'
              - 'button "d1: Empty" [disabled] [ref=e164]'
              - 'button "e1: Empty" [disabled] [ref=e165]'
              - 'button "f1: Empty" [disabled] [ref=e166]'
              - 'button "g1: Empty" [disabled] [ref=e167]'
              - 'button "h1: Empty" [disabled] [ref=e168]'
              - 'button "i1: Empty" [disabled] [ref=e169]'
            - status [ref=e170]: This board is read-only. Follow the game or review earlier moves.
          - status [ref=e172]:
            - generic [ref=e173]:
              - generic [ref=e174]: "South red circle: avery. North gold diamond: jordan_plays."
              - text: North gold diamond to move, heading for row 1.
          - generic [ref=e177]:
            - generic [ref=e182]:
              - img "South red circle" [ref=e183]:
                - generic [ref=e184]: ●
              - generic [ref=e185]: avery
            - generic [ref=e186]:
              - generic [ref=e187]: Walls
              - generic [ref=e188]: "7"
        - generic [ref=e191]:
          - group "Game actions" [ref=e192]:
            - button "Offer draw" [ref=e193] [cursor=pointer]:
              - paragraph [ref=e196]: Offer draw
            - button "Resign game" [ref=e197] [cursor=pointer]:
              - paragraph [ref=e200]:
                - text: Resign
                - generic [ref=e201]: game
          - button "History and stats" [ref=e202] [cursor=pointer]:
            - generic [ref=e204]:
              - paragraph [ref=e205]: History and stats
              - img [ref=e208]
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