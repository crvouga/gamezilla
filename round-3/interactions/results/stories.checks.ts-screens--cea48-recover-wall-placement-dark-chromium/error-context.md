# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--recover-wall-placement dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  1837 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/recover-wall-placement-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/recover-wall-placement-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 1837 pixels (ratio 0.01 of all image pixels) are different.
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
  - 1837 pixels (ratio 0.01 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - 'heading "Quoridor: King of the Hill" [level=1] [ref=e16]'
      - generic [ref=e18]:
        - generic [ref=e19]: Unrated
        - generic [ref=e20]: ·Untimed
    - generic [ref=e21]:
      - generic [ref=e23]:
        - paragraph [ref=e24]: Your turn. First to e5 wins.
        - generic [ref=e25]:
          - list "Moves played" [ref=e30]:
            - listitem [ref=e31]:
              - generic [ref=e32]: Move 1
              - generic [ref=e33]:
                - generic [ref=e35]: ●
                - 'button "Move 1, South red circle: e5h" [ref=e36] [cursor=pointer]': e5h
              - generic [ref=e37]:
                - generic [ref=e39]: ◆
                - 'button "Move 2, West gold diamond: a1h" [ref=e40] [cursor=pointer]': a1h
          - button "All moves" [ref=e41] [cursor=pointer]:
            - img [ref=e45]
      - generic [ref=e47]:
        - generic [ref=e49]:
          - list "Players" [ref=e50]:
            - listitem [ref=e51]:
              - generic [ref=e56]:
                - generic [ref=e57]: morgan
                - generic [ref=e58]:
                  - generic [ref=e60]: ▲
                  - generic [ref=e61]: Walls 5
                  - generic [ref=e63]: You
            - listitem [ref=e64]:
              - generic [ref=e68]:
                - generic [ref=e69]: avery
                - generic [ref=e70]:
                  - generic [ref=e72]: ●
                  - generic [ref=e73]: Walls 4
            - listitem [ref=e74]:
              - generic [ref=e78]:
                - generic [ref=e79]: jordan_plays
                - generic [ref=e80]:
                  - generic [ref=e82]: ◆
                  - generic [ref=e83]: Walls 4
            - listitem [ref=e84]:
              - generic [ref=e88]:
                - generic [ref=e89]: robin_42
                - generic [ref=e90]:
                  - generic [ref=e92]: ■
                  - generic [ref=e93]: Walls 5
          - generic [ref=e95]:
            - group "Quoridor board, nine columns and nine rows" [ref=e96]:
              - generic [ref=e98]: a
              - generic [ref=e99]: b
              - generic [ref=e100]: c
              - generic [ref=e101]: d
              - generic [ref=e102]: e
              - generic [ref=e103]: f
              - generic [ref=e104]: g
              - generic [ref=e105]: h
              - generic [ref=e106]: i
              - generic [ref=e107]: "9"
              - 'button "a9: Empty" [disabled] [ref=e108]'
              - 'button "b9: Empty" [disabled] [ref=e109]'
              - 'button "c9: Empty" [disabled] [ref=e110]'
              - 'button "d9: Empty, legal move" [ref=e111] [cursor=pointer]':
                - generic: ·
              - 'button "e9: North green triangle" [disabled] [ref=e112]':
                - generic: ▲
              - 'button "f9: Empty, legal move" [ref=e113] [cursor=pointer]':
                - generic: ·
              - 'button "g9: Empty" [disabled] [ref=e114]'
              - 'button "h9: Empty" [disabled] [ref=e115]'
              - 'button "i9: Empty" [disabled] [ref=e116]'
              - generic [ref=e117]: "8"
              - 'button "a8: Empty" [disabled] [ref=e118]'
              - 'button "b8: Empty" [disabled] [ref=e119]'
              - 'button "c8: Empty" [disabled] [ref=e120]'
              - 'button "d8: Empty" [disabled] [ref=e121]'
              - 'button "e8: Empty, legal move" [ref=e122] [cursor=pointer]':
                - generic: ·
              - 'button "f8: Empty" [disabled] [ref=e123]'
              - 'button "g8: Empty" [disabled] [ref=e124]'
              - 'button "h8: Empty" [disabled] [ref=e125]'
              - 'button "i8: Empty" [disabled] [ref=e126]'
              - generic [ref=e127]: "7"
              - 'button "a7: Empty" [disabled] [ref=e128]'
              - 'button "b7: Empty" [disabled] [ref=e129]'
              - 'button "c7: Empty" [disabled] [ref=e130]'
              - 'button "d7: Empty" [disabled] [ref=e131]'
              - 'button "e7: Empty" [disabled] [ref=e132]'
              - 'button "f7: Empty" [disabled] [ref=e133]'
              - 'button "g7: Empty" [disabled] [ref=e134]'
              - 'button "h7: Empty" [disabled] [ref=e135]'
              - 'button "i7: Empty" [disabled] [ref=e136]'
              - generic [ref=e137]: "6"
              - 'button "a6: Empty" [disabled] [ref=e138]'
              - 'button "b6: Empty" [disabled] [ref=e139]'
              - 'button "c6: Empty" [disabled] [ref=e140]'
              - 'button "d6: Empty" [disabled] [ref=e141]'
              - 'button "e6: Empty, wall boundaries: bottom" [disabled] [ref=e142]'
              - 'button "f6: Empty, wall boundaries: bottom" [disabled] [ref=e143]'
              - 'button "g6: Empty" [disabled] [ref=e144]'
              - 'button "h6: Empty" [disabled] [ref=e145]'
              - 'button "i6: Empty" [disabled] [ref=e146]'
              - generic [ref=e147]: "5"
              - 'button "a5: West gold diamond" [disabled] [ref=e148]':
                - generic: ◆
              - 'button "b5: Empty" [disabled] [ref=e149]'
              - 'button "c5: Empty" [disabled] [ref=e150]'
              - 'button "d5: Empty" [disabled] [ref=e151]'
              - 'button "e5: Central hill, wall boundaries: top" [disabled] [ref=e152]':
                - generic: ◎
              - 'button "f5: Empty, wall boundaries: top" [disabled] [ref=e153]'
              - 'button "g5: Empty" [disabled] [ref=e154]'
              - 'button "h5: Empty" [disabled] [ref=e155]'
              - 'button "i5: East black square" [disabled] [ref=e156]':
                - generic: ■
              - generic [ref=e157]: "4"
              - 'button "a4: Empty" [disabled] [ref=e158]'
              - 'button "b4: Empty" [disabled] [ref=e159]'
              - 'button "c4: Empty" [disabled] [ref=e160]'
              - 'button "d4: Empty" [disabled] [ref=e161]'
              - 'button "e4: Empty" [disabled] [ref=e162]'
              - 'button "f4: Empty" [disabled] [ref=e163]'
              - 'button "g4: Empty" [disabled] [ref=e164]'
              - 'button "h4: Empty" [disabled] [ref=e165]'
              - 'button "i4: Empty" [disabled] [ref=e166]'
              - generic [ref=e167]: "3"
              - 'button "a3: Empty" [disabled] [ref=e168]'
              - 'button "b3: Empty" [disabled] [ref=e169]'
              - 'button "c3: Empty" [disabled] [ref=e170]'
              - 'button "d3: Empty" [disabled] [ref=e171]'
              - 'button "e3: Empty" [disabled] [ref=e172]'
              - 'button "f3: Empty" [disabled] [ref=e173]'
              - 'button "g3: Empty" [disabled] [ref=e174]'
              - 'button "h3: Empty" [disabled] [ref=e175]'
              - 'button "i3: Empty" [disabled] [ref=e176]'
              - generic [ref=e177]: "2"
              - 'button "a2: Empty, wall boundaries: bottom" [disabled] [ref=e178]'
              - 'button "b2: Empty, wall boundaries: bottom" [disabled] [ref=e179]'
              - 'button "c2: Empty" [disabled] [ref=e180]'
              - 'button "d2: Empty" [disabled] [ref=e181]'
              - 'button "e2: Empty" [disabled] [ref=e182]'
              - 'button "f2: Empty" [disabled] [ref=e183]'
              - 'button "g2: Empty" [disabled] [ref=e184]'
              - 'button "h2: Empty" [disabled] [ref=e185]'
              - 'button "i2: Empty" [disabled] [ref=e186]'
              - generic [ref=e187]: "1"
              - 'button "a1: Empty, wall boundaries: top" [disabled] [ref=e188]'
              - 'button "b1: Empty, wall boundaries: top" [disabled] [ref=e189]'
              - 'button "c1: Empty" [disabled] [ref=e190]'
              - 'button "d1: Empty" [disabled] [ref=e191]'
              - 'button "e1: South red circle" [disabled] [ref=e192]':
                - generic: ●
              - 'button "f1: Empty" [disabled] [ref=e193]'
              - 'button "g1: Empty" [disabled] [ref=e194]'
              - 'button "h1: Empty" [disabled] [ref=e195]'
              - 'button "i1: Empty" [disabled] [ref=e196]'
            - status [ref=e197]: Choose a marked square to move your pawn.
          - status [ref=e199]:
            - generic [ref=e200]:
              - generic [ref=e201]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
              - text: Your turn. First to e5 wins.
        - generic [ref=e204]:
          - group "Game actions" [ref=e205]:
            - button "Move pawn" [pressed] [ref=e206] [cursor=pointer]:
              - paragraph [ref=e209]: Move pawn
            - button "Horizontal wall" [ref=e210] [cursor=pointer]:
              - paragraph [ref=e213]: Horizontal wall
            - button "Vertical wall" [ref=e214] [cursor=pointer]:
              - paragraph [ref=e217]: Vertical wall
            - button "Offer draw" [ref=e218] [cursor=pointer]:
              - paragraph [ref=e221]: Offer draw
            - button "Resign game" [ref=e222] [cursor=pointer]:
              - paragraph [ref=e225]:
                - text: Resign
                - generic [ref=e226]: game
          - button "History and stats" [ref=e227] [cursor=pointer]:
            - generic [ref=e229]:
              - paragraph [ref=e230]: History and stats
              - img [ref=e233]
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