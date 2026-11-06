# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-classic--keep-a-path-open light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  32967 pixels (ratio 0.11 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/keep-a-path-open-light.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/keep-a-path-open-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 32967 pixels (ratio 0.11 of all image pixels) are different.
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
  - 32967 pixels (ratio 0.11 of all image pixels) are different.

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
            - generic [ref=e50]:
              - generic [ref=e51]: Walls
              - generic [ref=e52]: "9"
          - generic [ref=e54]:
            - generic [ref=e55]:
              - button "Move pawn" [ref=e56] [cursor=pointer]:
                - paragraph [ref=e59]: Move pawn
              - button "Horizontal wall" [ref=e60] [cursor=pointer]:
                - paragraph [ref=e63]: Wall across
              - button "Vertical wall" [pressed] [ref=e64] [cursor=pointer]:
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
              - 'button "a8: Empty" [ref=e90] [cursor=pointer]'
              - 'button "b8: Empty" [ref=e91] [cursor=pointer]'
              - 'button "c8: Empty" [ref=e92] [cursor=pointer]'
              - 'button "d8: Empty" [ref=e93] [cursor=pointer]'
              - 'button "e8: Empty" [ref=e94] [cursor=pointer]'
              - 'button "f8: Empty" [ref=e95] [cursor=pointer]'
              - 'button "g8: Empty" [ref=e96] [cursor=pointer]'
              - 'button "h8: Empty" [ref=e97] [cursor=pointer]'
              - 'button "i8: Empty" [disabled] [ref=e98]'
              - generic [ref=e99]: "7"
              - 'button "a7: Empty" [ref=e100] [cursor=pointer]'
              - 'button "b7: Empty" [ref=e101] [cursor=pointer]'
              - 'button "c7: Empty" [ref=e102] [cursor=pointer]'
              - 'button "d7: Empty" [ref=e103] [cursor=pointer]'
              - 'button "e7: Empty" [ref=e104] [cursor=pointer]'
              - 'button "f7: Empty" [ref=e105] [cursor=pointer]'
              - 'button "g7: Empty" [ref=e106] [cursor=pointer]'
              - 'button "h7: Empty" [ref=e107] [cursor=pointer]'
              - 'button "i7: Empty" [disabled] [ref=e108]'
              - generic [ref=e109]: "6"
              - 'button "a6: Empty" [ref=e110] [cursor=pointer]'
              - 'button "b6: Empty" [ref=e111] [cursor=pointer]'
              - 'button "c6: Empty" [ref=e112] [cursor=pointer]'
              - 'button "d6: Empty" [ref=e113] [cursor=pointer]'
              - 'button "e6: Empty" [ref=e114] [cursor=pointer]'
              - 'button "f6: Empty" [ref=e115] [cursor=pointer]'
              - 'button "g6: Empty" [ref=e116] [cursor=pointer]'
              - 'button "h6: Empty" [ref=e117] [cursor=pointer]'
              - 'button "i6: Empty" [disabled] [ref=e118]'
              - generic [ref=e119]: "5"
              - 'button "a5: Empty" [ref=e120] [cursor=pointer]'
              - 'button "b5: Empty" [ref=e121] [cursor=pointer]'
              - 'button "c5: Empty" [ref=e122] [cursor=pointer]'
              - 'button "d5: Empty" [ref=e123] [cursor=pointer]'
              - 'button "e5: Empty" [ref=e124] [cursor=pointer]'
              - 'button "f5: Empty" [ref=e125] [cursor=pointer]'
              - 'button "g5: Empty" [ref=e126] [cursor=pointer]'
              - 'button "h5: Empty" [ref=e127] [cursor=pointer]'
              - 'button "i5: Empty" [disabled] [ref=e128]'
              - generic [ref=e129]: "4"
              - 'button "a4: Empty" [ref=e130] [cursor=pointer]'
              - 'button "b4: Empty" [ref=e131] [cursor=pointer]'
              - 'button "c4: Empty" [ref=e132] [cursor=pointer]'
              - 'button "d4: Empty" [ref=e133] [cursor=pointer]'
              - 'button "e4: Empty" [ref=e134] [cursor=pointer]'
              - 'button "f4: Empty" [ref=e135] [cursor=pointer]'
              - 'button "g4: Empty, wall boundaries: right" [ref=e136] [cursor=pointer]'
              - 'button "h4: Empty, wall boundaries: left" [ref=e137] [cursor=pointer]'
              - 'button "i4: Empty" [disabled] [ref=e138]'
              - generic [ref=e139]: "3"
              - 'button "a3: Empty" [ref=e140] [cursor=pointer]'
              - 'button "b3: Empty" [ref=e141] [cursor=pointer]'
              - 'button "c3: Empty" [ref=e142] [cursor=pointer]'
              - 'button "d3: Empty" [ref=e143] [cursor=pointer]'
              - 'button "e3: Empty" [ref=e144] [cursor=pointer]'
              - 'button "f3: Empty" [ref=e145] [cursor=pointer]'
              - 'button "g3: Empty, wall boundaries: right" [ref=e146] [cursor=pointer]'
              - 'button "h3: Empty, wall boundaries: left" [ref=e147] [cursor=pointer]'
              - 'button "i3: Empty" [disabled] [ref=e148]'
              - generic [ref=e149]: "2"
              - 'button "a2: Empty" [ref=e150] [cursor=pointer]'
              - 'button "b2: Empty" [ref=e151] [cursor=pointer]'
              - 'button "c2: Empty, wall boundaries: right" [ref=e152] [cursor=pointer]'
              - 'button "d2: Empty, wall boundaries: bottom, left" [ref=e153] [cursor=pointer]'
              - 'button "e2: Empty, wall boundaries: bottom" [ref=e154] [cursor=pointer]'
              - 'button "f2: Empty" [ref=e155] [cursor=pointer]'
              - 'button "g2: Empty" [ref=e156] [cursor=pointer]'
              - 'button "h2: Empty" [ref=e157] [cursor=pointer]'
              - 'button "i2: Empty" [disabled] [ref=e158]'
              - generic [ref=e159]: "1"
              - 'button "a1: Empty" [ref=e160] [cursor=pointer]'
              - 'button "b1: Empty" [ref=e161] [cursor=pointer]'
              - 'button "c1: Empty, wall boundaries: right" [ref=e162] [cursor=pointer]'
              - 'button "d1: Empty, wall boundaries: top, left" [ref=e163] [cursor=pointer]'
              - 'button "e1: South red circle, wall boundaries: top" [ref=e164] [cursor=pointer]':
                - generic: ●
              - 'button "f1: Empty" [ref=e165] [cursor=pointer]'
              - 'button "g1: Empty" [ref=e166] [cursor=pointer]'
              - 'button "h1: Empty" [ref=e167] [cursor=pointer]'
              - 'button "i1: Empty" [disabled] [ref=e168]'
            - generic [ref=e169]:
              - paragraph [ref=e170]: Preview a wall at a coordinate
              - button "Preview a wall at a coordinate" [ref=e171] [cursor=pointer]:
                - paragraph [ref=e172]: Select…
                - img [ref=e174]
            - status [ref=e176]: "Vertical wall: choose a square to preview its right boundary."
          - status [ref=e178]:
            - generic [ref=e179]:
              - generic [ref=e180]: "South red circle: avery. North gold diamond: jordan_plays."
              - text: North gold diamond to move, heading for row 1.
          - generic [ref=e183]:
            - generic [ref=e188]:
              - img "South red circle" [ref=e189]:
                - generic [ref=e190]: ●
              - generic [ref=e191]: avery
              - generic [ref=e192]: Your move
            - generic [ref=e193]:
              - generic [ref=e194]: Walls
              - generic [ref=e195]: "8"
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