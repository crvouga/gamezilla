# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--four-player-round light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  1573 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/four-player-round-light.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/four-player-round-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 1573 pixels (ratio 0.01 of all image pixels) are different.
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
  - 1573 pixels (ratio 0.01 of all image pixels) are different.

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
              - generic [ref=e32]: Move 2
              - generic [ref=e33]:
                - generic [ref=e35]: ●
                - 'button "Move 5, South red circle: e5h" [ref=e36] [cursor=pointer]': e5h
          - button "All moves" [ref=e37] [cursor=pointer]:
            - img [ref=e41]
      - generic [ref=e43]:
        - generic [ref=e45]:
          - list "Players" [ref=e46]:
            - listitem [ref=e47]:
              - generic [ref=e52]:
                - generic [ref=e53]: jordan_plays
                - generic [ref=e54]:
                  - generic [ref=e56]: ◆
                  - generic [ref=e57]: Walls 5
                  - generic [ref=e59]: You
            - listitem [ref=e60]:
              - generic [ref=e64]:
                - generic [ref=e65]: avery
                - generic [ref=e66]:
                  - generic [ref=e68]: ●
                  - generic [ref=e69]: Walls 4
            - listitem [ref=e70]:
              - generic [ref=e74]:
                - generic [ref=e75]: morgan
                - generic [ref=e76]:
                  - generic [ref=e78]: ▲
                  - generic [ref=e79]: Walls 5
            - listitem [ref=e80]:
              - generic [ref=e84]:
                - generic [ref=e85]: robin_42
                - generic [ref=e86]:
                  - generic [ref=e88]: ■
                  - generic [ref=e89]: Walls 5
          - generic [ref=e91]:
            - group "Quoridor board, nine columns and nine rows" [ref=e92]:
              - generic [ref=e94]: a
              - generic [ref=e95]: b
              - generic [ref=e96]: c
              - generic [ref=e97]: d
              - generic [ref=e98]: e
              - generic [ref=e99]: f
              - generic [ref=e100]: g
              - generic [ref=e101]: h
              - generic [ref=e102]: i
              - generic [ref=e103]: "9"
              - 'button "a9: Empty" [disabled] [ref=e104]'
              - 'button "b9: Empty" [disabled] [ref=e105]'
              - 'button "c9: Empty" [disabled] [ref=e106]'
              - 'button "d9: Empty" [disabled] [ref=e107]'
              - 'button "e9: Empty" [disabled] [ref=e108]'
              - 'button "f9: Empty" [disabled] [ref=e109]'
              - 'button "g9: Empty" [disabled] [ref=e110]'
              - 'button "h9: Empty" [disabled] [ref=e111]'
              - 'button "i9: Empty" [disabled] [ref=e112]'
              - generic [ref=e113]: "8"
              - 'button "a8: Empty" [disabled] [ref=e114]'
              - 'button "b8: Empty" [disabled] [ref=e115]'
              - 'button "c8: Empty" [disabled] [ref=e116]'
              - 'button "d8: Empty" [disabled] [ref=e117]'
              - 'button "e8: North green triangle" [disabled] [ref=e118]':
                - generic: ▲
              - 'button "f8: Empty" [disabled] [ref=e119]'
              - 'button "g8: Empty" [disabled] [ref=e120]'
              - 'button "h8: Empty" [disabled] [ref=e121]'
              - 'button "i8: Empty" [disabled] [ref=e122]'
              - generic [ref=e123]: "7"
              - 'button "a7: Empty" [disabled] [ref=e124]'
              - 'button "b7: Empty" [disabled] [ref=e125]'
              - 'button "c7: Empty" [disabled] [ref=e126]'
              - 'button "d7: Empty" [disabled] [ref=e127]'
              - 'button "e7: Empty" [disabled] [ref=e128]'
              - 'button "f7: Empty" [disabled] [ref=e129]'
              - 'button "g7: Empty" [disabled] [ref=e130]'
              - 'button "h7: Empty" [disabled] [ref=e131]'
              - 'button "i7: Empty" [disabled] [ref=e132]'
              - generic [ref=e133]: "6"
              - 'button "a6: Empty" [disabled] [ref=e134]'
              - 'button "b6: Empty" [disabled] [ref=e135]'
              - 'button "c6: Empty" [disabled] [ref=e136]'
              - 'button "d6: Empty" [disabled] [ref=e137]'
              - 'button "e6: Empty, wall boundaries: bottom" [disabled] [ref=e138]'
              - 'button "f6: Empty, wall boundaries: bottom" [disabled] [ref=e139]'
              - 'button "g6: Empty" [disabled] [ref=e140]'
              - 'button "h6: Empty" [disabled] [ref=e141]'
              - 'button "i6: East black square" [disabled] [ref=e142]':
                - generic: ■
              - generic [ref=e143]: "5"
              - 'button "a5: Empty, legal move" [ref=e144] [cursor=pointer]':
                - generic: ·
              - 'button "b5: Empty" [disabled] [ref=e145]'
              - 'button "c5: Empty" [disabled] [ref=e146]'
              - 'button "d5: Empty" [disabled] [ref=e147]'
              - 'button "e5: Central hill, wall boundaries: top" [disabled] [ref=e148]':
                - generic: ◎
              - 'button "f5: Empty, wall boundaries: top" [disabled] [ref=e149]'
              - 'button "g5: Empty" [disabled] [ref=e150]'
              - 'button "h5: Empty" [disabled] [ref=e151]'
              - 'button "i5: Empty" [disabled] [ref=e152]'
              - generic [ref=e153]: "4"
              - 'button "a4: West gold diamond" [disabled] [ref=e154]':
                - generic: ◆
              - 'button "b4: Empty, legal move" [ref=e155] [cursor=pointer]':
                - generic: ·
              - 'button "c4: Empty" [disabled] [ref=e156]'
              - 'button "d4: Empty" [disabled] [ref=e157]'
              - 'button "e4: Empty" [disabled] [ref=e158]'
              - 'button "f4: Empty" [disabled] [ref=e159]'
              - 'button "g4: Empty" [disabled] [ref=e160]'
              - 'button "h4: Empty" [disabled] [ref=e161]'
              - 'button "i4: Empty" [disabled] [ref=e162]'
              - generic [ref=e163]: "3"
              - 'button "a3: Empty, legal move" [ref=e164] [cursor=pointer]':
                - generic: ·
              - 'button "b3: Empty" [disabled] [ref=e165]'
              - 'button "c3: Empty" [disabled] [ref=e166]'
              - 'button "d3: Empty" [disabled] [ref=e167]'
              - 'button "e3: Empty" [disabled] [ref=e168]'
              - 'button "f3: Empty" [disabled] [ref=e169]'
              - 'button "g3: Empty" [disabled] [ref=e170]'
              - 'button "h3: Empty" [disabled] [ref=e171]'
              - 'button "i3: Empty" [disabled] [ref=e172]'
              - generic [ref=e173]: "2"
              - 'button "a2: Empty" [disabled] [ref=e174]'
              - 'button "b2: Empty" [disabled] [ref=e175]'
              - 'button "c2: Empty" [disabled] [ref=e176]'
              - 'button "d2: Empty" [disabled] [ref=e177]'
              - 'button "e2: South red circle" [disabled] [ref=e178]':
                - generic: ●
              - 'button "f2: Empty" [disabled] [ref=e179]'
              - 'button "g2: Empty" [disabled] [ref=e180]'
              - 'button "h2: Empty" [disabled] [ref=e181]'
              - 'button "i2: Empty" [disabled] [ref=e182]'
              - generic [ref=e183]: "1"
              - 'button "a1: Empty" [disabled] [ref=e184]'
              - 'button "b1: Empty" [disabled] [ref=e185]'
              - 'button "c1: Empty" [disabled] [ref=e186]'
              - 'button "d1: Empty" [disabled] [ref=e187]'
              - 'button "e1: Empty" [disabled] [ref=e188]'
              - 'button "f1: Empty" [disabled] [ref=e189]'
              - 'button "g1: Empty" [disabled] [ref=e190]'
              - 'button "h1: Empty" [disabled] [ref=e191]'
              - 'button "i1: Empty" [disabled] [ref=e192]'
            - status [ref=e193]: Choose a marked square to move your pawn.
          - status [ref=e195]:
            - generic [ref=e196]:
              - generic [ref=e197]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
              - text: Your turn. First to e5 wins.
        - generic [ref=e200]:
          - group "Game actions" [ref=e201]:
            - button "Move pawn" [pressed] [ref=e202] [cursor=pointer]:
              - paragraph [ref=e205]: Move pawn
            - button "Horizontal wall" [ref=e206] [cursor=pointer]:
              - paragraph [ref=e209]: Horizontal wall
            - button "Vertical wall" [ref=e210] [cursor=pointer]:
              - paragraph [ref=e213]: Vertical wall
            - button "Offer draw" [ref=e214] [cursor=pointer]:
              - paragraph [ref=e217]: Offer draw
            - button "Resign game" [ref=e218] [cursor=pointer]:
              - paragraph [ref=e221]:
                - text: Resign
                - generic [ref=e222]: game
          - button "History and stats" [ref=e223] [cursor=pointer]:
            - generic [ref=e225]:
              - paragraph [ref=e226]: History and stats
              - img [ref=e229]
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