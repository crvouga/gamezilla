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
  54702 pixels (ratio 0.17 of all image pixels) are different.

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
  - 54702 pixels (ratio 0.17 of all image pixels) are different.
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
  - 54702 pixels (ratio 0.17 of all image pixels) are different.

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
            - generic [ref=e55]:
              - button "Move pawn" [pressed] [ref=e56] [cursor=pointer]:
                - paragraph [ref=e59]: Move pawn
              - button "Horizontal wall" [ref=e60] [cursor=pointer]:
                - paragraph [ref=e63]: Wall across
              - button "Vertical wall" [ref=e64] [cursor=pointer]:
                - paragraph [ref=e67]: Wall down
            - group "Quoridor board, nine columns and nine rows" [ref=e68]:
              - generic [ref=e70]: a
              - generic [ref=e71]: b
              - generic [ref=e72]: c
              - generic [ref=e73]: d
              - generic [ref=e74]: e
              - generic [ref=e75]: f
              - generic [ref=e76]: g
              - generic [ref=e77]: h
              - generic [ref=e78]: i
              - generic [ref=e79]: "9"
              - 'button "a9: Empty" [disabled] [ref=e80]'
              - 'button "b9: Empty" [disabled] [ref=e81]'
              - 'button "c9: Empty" [disabled] [ref=e82]'
              - 'button "d9: Empty" [disabled] [ref=e83]'
              - 'button "e9: North gold diamond" [disabled] [ref=e84]':
                - generic: ◆
              - 'button "f9: Empty" [disabled] [ref=e85]'
              - 'button "g9: Empty" [disabled] [ref=e86]'
              - 'button "h9: Empty" [disabled] [ref=e87]'
              - 'button "i9: Empty" [disabled] [ref=e88]'
              - generic [ref=e89]: "8"
              - 'button "a8: Empty" [disabled] [ref=e90]'
              - 'button "b8: Empty" [disabled] [ref=e91]'
              - 'button "c8: Empty" [disabled] [ref=e92]'
              - 'button "d8: Empty" [disabled] [ref=e93]'
              - 'button "e8: Empty" [disabled] [ref=e94]'
              - 'button "f8: Empty" [disabled] [ref=e95]'
              - 'button "g8: Empty" [disabled] [ref=e96]'
              - 'button "h8: Empty" [disabled] [ref=e97]'
              - 'button "i8: Empty" [disabled] [ref=e98]'
              - generic [ref=e99]: "7"
              - 'button "a7: Empty" [disabled] [ref=e100]'
              - 'button "b7: Empty" [disabled] [ref=e101]'
              - 'button "c7: Empty" [disabled] [ref=e102]'
              - 'button "d7: Empty" [disabled] [ref=e103]'
              - 'button "e7: Empty" [disabled] [ref=e104]'
              - 'button "f7: Empty" [disabled] [ref=e105]'
              - 'button "g7: Empty" [disabled] [ref=e106]'
              - 'button "h7: Empty" [disabled] [ref=e107]'
              - 'button "i7: Empty" [disabled] [ref=e108]'
              - generic [ref=e109]: "6"
              - 'button "a6: Empty" [disabled] [ref=e110]'
              - 'button "b6: Empty" [disabled] [ref=e111]'
              - 'button "c6: Empty" [disabled] [ref=e112]'
              - 'button "d6: Empty" [disabled] [ref=e113]'
              - 'button "e6: Empty" [disabled] [ref=e114]'
              - 'button "f6: Empty" [disabled] [ref=e115]'
              - 'button "g6: Empty" [disabled] [ref=e116]'
              - 'button "h6: Empty" [disabled] [ref=e117]'
              - 'button "i6: Empty" [disabled] [ref=e118]'
              - generic [ref=e119]: "5"
              - 'button "a5: Empty" [disabled] [ref=e120]'
              - 'button "b5: Empty" [disabled] [ref=e121]'
              - 'button "c5: Empty" [disabled] [ref=e122]'
              - 'button "d5: Empty" [disabled] [ref=e123]'
              - 'button "e5: Empty" [disabled] [ref=e124]'
              - 'button "f5: Empty" [disabled] [ref=e125]'
              - 'button "g5: Empty" [disabled] [ref=e126]'
              - 'button "h5: Empty" [disabled] [ref=e127]'
              - 'button "i5: Empty" [disabled] [ref=e128]'
              - generic [ref=e129]: "4"
              - 'button "a4: Empty" [disabled] [ref=e130]'
              - 'button "b4: Empty" [disabled] [ref=e131]'
              - 'button "c4: Empty" [disabled] [ref=e132]'
              - 'button "d4: Empty" [disabled] [ref=e133]'
              - 'button "e4: Empty" [disabled] [ref=e134]'
              - 'button "f4: Empty" [disabled] [ref=e135]'
              - 'button "g4: Empty" [disabled] [ref=e136]'
              - 'button "h4: Empty" [disabled] [ref=e137]'
              - 'button "i4: Empty" [disabled] [ref=e138]'
              - generic [ref=e139]: "3"
              - 'button "a3: Empty" [disabled] [ref=e140]'
              - 'button "b3: Empty" [disabled] [ref=e141]'
              - 'button "c3: Empty" [disabled] [ref=e142]'
              - 'button "d3: Empty" [disabled] [ref=e143]'
              - 'button "e3: Empty" [disabled] [ref=e144]'
              - 'button "f3: Empty" [disabled] [ref=e145]'
              - 'button "g3: Empty" [disabled] [ref=e146]'
              - 'button "h3: Empty" [disabled] [ref=e147]'
              - 'button "i3: Empty" [disabled] [ref=e148]'
              - generic [ref=e149]: "2"
              - 'button "a2: Empty" [disabled] [ref=e150]'
              - 'button "b2: Empty" [disabled] [ref=e151]'
              - 'button "c2: Empty" [disabled] [ref=e152]'
              - 'button "d2: Empty" [disabled] [ref=e153]'
              - 'button "e2: Empty, legal move" [ref=e154] [cursor=pointer]':
                - generic: ·
              - 'button "f2: Empty" [disabled] [ref=e155]'
              - 'button "g2: Empty" [disabled] [ref=e156]'
              - 'button "h2: Empty" [disabled] [ref=e157]'
              - 'button "i2: Empty" [disabled] [ref=e158]'
              - generic [ref=e159]: "1"
              - 'button "a1: Empty" [disabled] [ref=e160]'
              - 'button "b1: Empty" [disabled] [ref=e161]'
              - 'button "c1: Empty" [disabled] [ref=e162]'
              - 'button "d1: Empty, legal move" [ref=e163] [cursor=pointer]':
                - generic: ·
              - 'button "e1: South red circle" [disabled] [ref=e164]':
                - generic: ●
              - 'button "f1: Empty, legal move" [ref=e165] [cursor=pointer]':
                - generic: ·
              - 'button "g1: Empty" [disabled] [ref=e166]'
              - 'button "h1: Empty" [disabled] [ref=e167]'
              - 'button "i1: Empty" [disabled] [ref=e168]'
            - generic [ref=e169]:
              - paragraph [ref=e170]: Move to a coordinate
              - button "Move to a coordinate" [ref=e171] [cursor=pointer]:
                - paragraph [ref=e172]: Select…
                - img [ref=e174]
            - status [ref=e176]: Choose a marked square to move your pawn.
          - status [ref=e178]:
            - generic [ref=e179]:
              - generic [ref=e180]: "South red circle: avery. North gold diamond: jordan_plays."
              - text: Your turn. Reach row 9.
          - generic [ref=e183]:
            - generic [ref=e188]:
              - img "South red circle" [ref=e189]:
                - generic [ref=e190]: ●
              - generic [ref=e191]: avery
              - generic [ref=e192]: Your move
            - generic [ref=e193]:
              - generic [ref=e194]: Walls
              - generic [ref=e195]: "10"
        - generic [ref=e198]:
          - group "Game actions" [ref=e199]:
            - button "Offer draw" [ref=e200] [cursor=pointer]:
              - paragraph [ref=e203]: Offer draw
            - button "Resign game" [ref=e204] [cursor=pointer]:
              - paragraph [ref=e207]:
                - text: Resign
                - generic [ref=e208]: game
          - button "History and stats" [ref=e209] [cursor=pointer]:
            - generic [ref=e211]:
              - paragraph [ref=e212]: History and stats
              - img [ref=e215]
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