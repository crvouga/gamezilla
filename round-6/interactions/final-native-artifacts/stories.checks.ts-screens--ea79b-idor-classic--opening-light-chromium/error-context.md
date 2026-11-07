# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-classic--opening light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  30493 pixels (ratio 0.10 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/opening-light.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/opening-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 30493 pixels (ratio 0.10 of all image pixels) are different.
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
  - 30493 pixels (ratio 0.10 of all image pixels) are different.

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
              - generic "jordan_plays" [ref=e51]
            - generic [ref=e52]:
              - generic [ref=e53]: Walls
              - generic [ref=e54]: "10"
          - generic [ref=e56]:
            - generic [ref=e57]:
              - button "Move pawn" [pressed] [ref=e58] [cursor=pointer]:
                - paragraph [ref=e61]: Move
              - button "Horizontal wall" [ref=e62] [cursor=pointer]:
                - paragraph [ref=e65]: Horizontal wall
              - button "Vertical wall" [ref=e66] [cursor=pointer]:
                - paragraph [ref=e69]: Vertical wall
            - group "Quoridor board, nine columns and nine rows" [ref=e70]:
              - generic [ref=e72]: a
              - generic [ref=e73]: b
              - generic [ref=e74]: c
              - generic [ref=e75]: d
              - generic [ref=e76]: e
              - generic [ref=e77]: f
              - generic [ref=e78]: g
              - generic [ref=e79]: h
              - generic [ref=e80]: i
              - generic [ref=e81]: "9"
              - 'button "a9: Empty, goal edge" [disabled] [ref=e82]'
              - 'button "b9: Empty, goal edge" [disabled] [ref=e83]'
              - 'button "c9: Empty, goal edge" [disabled] [ref=e84]'
              - 'button "d9: Empty, goal edge" [disabled] [ref=e85]'
              - 'button "e9: North gold diamond, goal edge" [disabled] [ref=e86]':
                - generic: ◆
              - 'button "f9: Empty, goal edge" [disabled] [ref=e87]'
              - 'button "g9: Empty, goal edge" [disabled] [ref=e88]'
              - 'button "h9: Empty, goal edge" [disabled] [ref=e89]'
              - 'button "i9: Empty, goal edge" [disabled] [ref=e90]'
              - generic [ref=e91]: "8"
              - 'button "a8: Empty" [disabled] [ref=e92]'
              - 'button "b8: Empty" [disabled] [ref=e93]'
              - 'button "c8: Empty" [disabled] [ref=e94]'
              - 'button "d8: Empty" [disabled] [ref=e95]'
              - 'button "e8: Empty" [disabled] [ref=e96]'
              - 'button "f8: Empty" [disabled] [ref=e97]'
              - 'button "g8: Empty" [disabled] [ref=e98]'
              - 'button "h8: Empty" [disabled] [ref=e99]'
              - 'button "i8: Empty" [disabled] [ref=e100]'
              - generic [ref=e101]: "7"
              - 'button "a7: Empty" [disabled] [ref=e102]'
              - 'button "b7: Empty" [disabled] [ref=e103]'
              - 'button "c7: Empty" [disabled] [ref=e104]'
              - 'button "d7: Empty" [disabled] [ref=e105]'
              - 'button "e7: Empty" [disabled] [ref=e106]'
              - 'button "f7: Empty" [disabled] [ref=e107]'
              - 'button "g7: Empty" [disabled] [ref=e108]'
              - 'button "h7: Empty" [disabled] [ref=e109]'
              - 'button "i7: Empty" [disabled] [ref=e110]'
              - generic [ref=e111]: "6"
              - 'button "a6: Empty" [disabled] [ref=e112]'
              - 'button "b6: Empty" [disabled] [ref=e113]'
              - 'button "c6: Empty" [disabled] [ref=e114]'
              - 'button "d6: Empty" [disabled] [ref=e115]'
              - 'button "e6: Empty" [disabled] [ref=e116]'
              - 'button "f6: Empty" [disabled] [ref=e117]'
              - 'button "g6: Empty" [disabled] [ref=e118]'
              - 'button "h6: Empty" [disabled] [ref=e119]'
              - 'button "i6: Empty" [disabled] [ref=e120]'
              - generic [ref=e121]: "5"
              - 'button "a5: Empty" [disabled] [ref=e122]'
              - 'button "b5: Empty" [disabled] [ref=e123]'
              - 'button "c5: Empty" [disabled] [ref=e124]'
              - 'button "d5: Empty" [disabled] [ref=e125]'
              - 'button "e5: Empty" [disabled] [ref=e126]'
              - 'button "f5: Empty" [disabled] [ref=e127]'
              - 'button "g5: Empty" [disabled] [ref=e128]'
              - 'button "h5: Empty" [disabled] [ref=e129]'
              - 'button "i5: Empty" [disabled] [ref=e130]'
              - generic [ref=e131]: "4"
              - 'button "a4: Empty" [disabled] [ref=e132]'
              - 'button "b4: Empty" [disabled] [ref=e133]'
              - 'button "c4: Empty" [disabled] [ref=e134]'
              - 'button "d4: Empty" [disabled] [ref=e135]'
              - 'button "e4: Empty" [disabled] [ref=e136]'
              - 'button "f4: Empty" [disabled] [ref=e137]'
              - 'button "g4: Empty" [disabled] [ref=e138]'
              - 'button "h4: Empty" [disabled] [ref=e139]'
              - 'button "i4: Empty" [disabled] [ref=e140]'
              - generic [ref=e141]: "3"
              - 'button "a3: Empty" [disabled] [ref=e142]'
              - 'button "b3: Empty" [disabled] [ref=e143]'
              - 'button "c3: Empty" [disabled] [ref=e144]'
              - 'button "d3: Empty" [disabled] [ref=e145]'
              - 'button "e3: Empty" [disabled] [ref=e146]'
              - 'button "f3: Empty" [disabled] [ref=e147]'
              - 'button "g3: Empty" [disabled] [ref=e148]'
              - 'button "h3: Empty" [disabled] [ref=e149]'
              - 'button "i3: Empty" [disabled] [ref=e150]'
              - generic [ref=e151]: "2"
              - 'button "a2: Empty" [disabled] [ref=e152]'
              - 'button "b2: Empty" [disabled] [ref=e153]'
              - 'button "c2: Empty" [disabled] [ref=e154]'
              - 'button "d2: Empty" [disabled] [ref=e155]'
              - 'button "e2: Empty, legal move" [ref=e156] [cursor=pointer]':
                - generic: ·
              - 'button "f2: Empty" [disabled] [ref=e157]'
              - 'button "g2: Empty" [disabled] [ref=e158]'
              - 'button "h2: Empty" [disabled] [ref=e159]'
              - 'button "i2: Empty" [disabled] [ref=e160]'
              - generic [ref=e161]: "1"
              - 'button "a1: Empty" [disabled] [ref=e162]'
              - 'button "b1: Empty" [disabled] [ref=e163]'
              - 'button "c1: Empty" [disabled] [ref=e164]'
              - 'button "d1: Empty, legal move" [ref=e165] [cursor=pointer]':
                - generic: ·
              - 'button "e1: South red circle" [disabled] [ref=e166]':
                - generic: ●
              - 'button "f1: Empty, legal move" [ref=e167] [cursor=pointer]':
                - generic: ·
              - 'button "g1: Empty" [disabled] [ref=e168]'
              - 'button "h1: Empty" [disabled] [ref=e169]'
              - 'button "i1: Empty" [disabled] [ref=e170]'
            - generic [ref=e171]:
              - paragraph [ref=e172]: Move to a coordinate
              - button "Move to a coordinate" [ref=e173] [cursor=pointer]:
                - paragraph [ref=e174]: Select…
                - img [ref=e176]
            - status [ref=e178]: Move to a marked square.
          - status [ref=e180]:
            - generic [ref=e181]:
              - generic [ref=e182]: "South red circle: avery. North gold diamond: jordan_plays."
              - text: Your turn. Reach row 9.
          - generic [ref=e185]:
            - generic [ref=e190]:
              - img "South red circle" [ref=e191]:
                - generic [ref=e192]: ●
              - generic "avery" [ref=e195]
              - generic [ref=e196]: Your move
            - generic [ref=e197]:
              - generic [ref=e198]: Walls
              - generic [ref=e199]: "10"
        - generic [ref=e202]:
          - group "Game actions" [ref=e203]:
            - button "Offer draw" [ref=e204] [cursor=pointer]:
              - paragraph [ref=e207]: Offer draw
            - button "Resign game" [ref=e208] [cursor=pointer]:
              - paragraph [ref=e211]:
                - text: Resign
                - generic [ref=e212]: game
          - button "History and stats" [ref=e213] [cursor=pointer]:
            - generic [ref=e215]:
              - paragraph [ref=e216]: History and stats
              - img [ref=e219]
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