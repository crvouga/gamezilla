# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--recover-wall-placement dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  2330 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/recover-wall-placement-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/recover-wall-placement-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 2330 pixels (ratio 0.01 of all image pixels) are different.
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
  - 2330 pixels (ratio 0.01 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e15]:
    - generic [ref=e16]:
      - 'heading "Quoridor: King of the Hill" [level=1] [ref=e19]'
      - generic [ref=e21]:
        - generic [ref=e22]: Unrated
        - generic [ref=e23]: ·Untimed
    - generic [ref=e25]:
      - generic [ref=e27]:
        - list "Other players" [ref=e28]:
          - listitem [ref=e29]:
            - generic [ref=e33]:
              - generic [ref=e34]: avery
              - generic [ref=e35]:
                - generic [ref=e37]: ●
                - generic [ref=e38]: Walls 4
          - listitem [ref=e39]:
            - generic [ref=e43]:
              - generic [ref=e44]: jordan_plays
              - generic [ref=e45]:
                - generic [ref=e47]: ◆
                - generic [ref=e48]: Walls 4
          - listitem [ref=e49]:
            - generic [ref=e53]:
              - generic [ref=e54]: robin_42
              - generic [ref=e55]:
                - generic [ref=e57]: ■
                - generic [ref=e58]: Walls 5
        - generic [ref=e60]:
          - group "Quoridor board, nine columns and nine rows" [ref=e61]:
            - generic [ref=e63]: a
            - generic [ref=e64]: b
            - generic [ref=e65]: c
            - generic [ref=e66]: d
            - generic [ref=e67]: e
            - generic [ref=e68]: f
            - generic [ref=e69]: g
            - generic [ref=e70]: h
            - generic [ref=e71]: i
            - generic [ref=e72]: "9"
            - 'button "a9: Empty" [disabled] [ref=e73]'
            - 'button "b9: Empty" [disabled] [ref=e74]'
            - 'button "c9: Empty" [disabled] [ref=e75]'
            - 'button "d9: Empty, legal move" [ref=e76] [cursor=pointer]':
              - generic: ·
            - 'button "e9: North green triangle" [disabled] [ref=e77]':
              - generic: ▲
            - 'button "f9: Empty, legal move" [ref=e78] [cursor=pointer]':
              - generic: ·
            - 'button "g9: Empty" [disabled] [ref=e79]'
            - 'button "h9: Empty" [disabled] [ref=e80]'
            - 'button "i9: Empty" [disabled] [ref=e81]'
            - generic [ref=e82]: "8"
            - 'button "a8: Empty" [disabled] [ref=e83]'
            - 'button "b8: Empty" [disabled] [ref=e84]'
            - 'button "c8: Empty" [disabled] [ref=e85]'
            - 'button "d8: Empty" [disabled] [ref=e86]'
            - 'button "e8: Empty, legal move" [ref=e87] [cursor=pointer]':
              - generic: ·
            - 'button "f8: Empty" [disabled] [ref=e88]'
            - 'button "g8: Empty" [disabled] [ref=e89]'
            - 'button "h8: Empty" [disabled] [ref=e90]'
            - 'button "i8: Empty" [disabled] [ref=e91]'
            - generic [ref=e92]: "7"
            - 'button "a7: Empty" [disabled] [ref=e93]'
            - 'button "b7: Empty" [disabled] [ref=e94]'
            - 'button "c7: Empty" [disabled] [ref=e95]'
            - 'button "d7: Empty" [disabled] [ref=e96]'
            - 'button "e7: Empty" [disabled] [ref=e97]'
            - 'button "f7: Empty" [disabled] [ref=e98]'
            - 'button "g7: Empty" [disabled] [ref=e99]'
            - 'button "h7: Empty" [disabled] [ref=e100]'
            - 'button "i7: Empty" [disabled] [ref=e101]'
            - generic [ref=e102]: "6"
            - 'button "a6: Empty" [disabled] [ref=e103]'
            - 'button "b6: Empty" [disabled] [ref=e104]'
            - 'button "c6: Empty" [disabled] [ref=e105]'
            - 'button "d6: Empty" [disabled] [ref=e106]'
            - 'button "e6: Empty, wall boundaries: bottom" [disabled] [ref=e107]'
            - 'button "f6: Empty, wall boundaries: bottom" [disabled] [ref=e108]'
            - 'button "g6: Empty" [disabled] [ref=e109]'
            - 'button "h6: Empty" [disabled] [ref=e110]'
            - 'button "i6: Empty" [disabled] [ref=e111]'
            - generic [ref=e112]: "5"
            - 'button "a5: West gold diamond" [disabled] [ref=e113]':
              - generic: ◆
            - 'button "b5: Empty" [disabled] [ref=e114]'
            - 'button "c5: Empty" [disabled] [ref=e115]'
            - 'button "d5: Empty" [disabled] [ref=e116]'
            - 'button "e5: Central hill, wall boundaries: top" [disabled] [ref=e117]':
              - generic: ◎
            - 'button "f5: Empty, wall boundaries: top" [disabled] [ref=e118]'
            - 'button "g5: Empty" [disabled] [ref=e119]'
            - 'button "h5: Empty" [disabled] [ref=e120]'
            - 'button "i5: East black square" [disabled] [ref=e121]':
              - generic: ■
            - generic [ref=e122]: "4"
            - 'button "a4: Empty" [disabled] [ref=e123]'
            - 'button "b4: Empty" [disabled] [ref=e124]'
            - 'button "c4: Empty" [disabled] [ref=e125]'
            - 'button "d4: Empty" [disabled] [ref=e126]'
            - 'button "e4: Empty" [disabled] [ref=e127]'
            - 'button "f4: Empty" [disabled] [ref=e128]'
            - 'button "g4: Empty" [disabled] [ref=e129]'
            - 'button "h4: Empty" [disabled] [ref=e130]'
            - 'button "i4: Empty" [disabled] [ref=e131]'
            - generic [ref=e132]: "3"
            - 'button "a3: Empty" [disabled] [ref=e133]'
            - 'button "b3: Empty" [disabled] [ref=e134]'
            - 'button "c3: Empty" [disabled] [ref=e135]'
            - 'button "d3: Empty" [disabled] [ref=e136]'
            - 'button "e3: Empty" [disabled] [ref=e137]'
            - 'button "f3: Empty" [disabled] [ref=e138]'
            - 'button "g3: Empty" [disabled] [ref=e139]'
            - 'button "h3: Empty" [disabled] [ref=e140]'
            - 'button "i3: Empty" [disabled] [ref=e141]'
            - generic [ref=e142]: "2"
            - 'button "a2: Empty, wall boundaries: bottom" [disabled] [ref=e143]'
            - 'button "b2: Empty, wall boundaries: bottom" [disabled] [ref=e144]'
            - 'button "c2: Empty" [disabled] [ref=e145]'
            - 'button "d2: Empty" [disabled] [ref=e146]'
            - 'button "e2: Empty" [disabled] [ref=e147]'
            - 'button "f2: Empty" [disabled] [ref=e148]'
            - 'button "g2: Empty" [disabled] [ref=e149]'
            - 'button "h2: Empty" [disabled] [ref=e150]'
            - 'button "i2: Empty" [disabled] [ref=e151]'
            - generic [ref=e152]: "1"
            - 'button "a1: Empty, wall boundaries: top" [disabled] [ref=e153]'
            - 'button "b1: Empty, wall boundaries: top" [disabled] [ref=e154]'
            - 'button "c1: Empty" [disabled] [ref=e155]'
            - 'button "d1: Empty" [disabled] [ref=e156]'
            - 'button "e1: South red circle" [disabled] [ref=e157]':
              - generic: ●
            - 'button "f1: Empty" [disabled] [ref=e158]'
            - 'button "g1: Empty" [disabled] [ref=e159]'
            - 'button "h1: Empty" [disabled] [ref=e160]'
            - 'button "i1: Empty" [disabled] [ref=e161]'
          - status [ref=e162]: Choose a marked square to move your pawn.
        - status [ref=e164]:
          - generic [ref=e165]:
            - generic [ref=e166]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
            - text: Your turn. First to e5 wins.
        - generic [ref=e169]:
          - generic [ref=e174]:
            - img "North green triangle" [ref=e175]:
              - generic [ref=e176]: ▲
            - generic [ref=e177]: morgan
            - generic [ref=e178]: Your move
          - generic [ref=e179]:
            - generic [ref=e180]: Walls
            - generic [ref=e181]: "5"
      - region "Game record" [ref=e183]:
        - generic [ref=e184]:
          - heading "Game record" [level=2] [ref=e186]
          - paragraph [ref=e187]: Your turn. First to e5 wins.
        - generic [ref=e188]:
          - list "Moves played" [ref=e190]:
            - listitem [ref=e191]:
              - generic [ref=e192]: "1"
              - generic [ref=e193]:
                - generic [ref=e195]: ●
                - 'button "Move 1, South red circle: e5h" [ref=e196] [cursor=pointer]': e5h
              - generic [ref=e197]:
                - generic [ref=e199]: ◆
                - 'button "Move 2, West gold diamond: a1h" [ref=e200] [cursor=pointer]': a1h
          - generic [ref=e201]:
            - generic [ref=e202]:
              - button "Go to the start" [ref=e203] [cursor=pointer]:
                - img [ref=e206]
              - button "Previous move" [ref=e209] [cursor=pointer]:
                - img [ref=e212]
              - button "Next move" [disabled] [ref=e214]:
                - img [ref=e217]
              - button "Return to current position" [ref=e219] [cursor=pointer]:
                - img [ref=e222]
            - button "Go to move" [ref=e225] [cursor=pointer]:
              - generic [ref=e227]:
                - paragraph [ref=e228]: Go to move
                - img [ref=e231]
        - generic [ref=e234]:
          - group "Game actions" [ref=e235]:
            - button "Move pawn" [pressed] [ref=e236] [cursor=pointer]:
              - paragraph [ref=e239]: Move pawn
            - button "Horizontal wall" [ref=e240] [cursor=pointer]:
              - paragraph [ref=e243]: Horizontal wall
            - button "Vertical wall" [ref=e244] [cursor=pointer]:
              - paragraph [ref=e247]: Vertical wall
            - button "Offer draw" [ref=e248] [cursor=pointer]:
              - paragraph [ref=e251]: Offer draw
            - button "Resign game" [ref=e252] [cursor=pointer]:
              - paragraph [ref=e255]:
                - text: Resign
                - generic [ref=e256]: game
          - button "History and stats" [ref=e257] [cursor=pointer]:
            - paragraph [ref=e260]: History and stats
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