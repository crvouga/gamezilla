# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--reach-the-hill light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  3178 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/reach-the-hill-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/reach-the-hill-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 3178 pixels (ratio 0.01 of all image pixels) are different.
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
  - 3178 pixels (ratio 0.01 of all image pixels) are different.

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
                - generic [ref=e38]: Walls 5
          - listitem [ref=e39]:
            - generic [ref=e43]:
              - generic [ref=e44]: morgan
              - generic [ref=e45]:
                - generic [ref=e47]: ▲
                - generic [ref=e48]: Walls 5
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
            - 'button "d9: Empty" [disabled] [ref=e76]'
            - 'button "e9: Empty" [disabled] [ref=e77]'
            - 'button "f9: Empty" [disabled] [ref=e78]'
            - 'button "g9: Empty" [disabled] [ref=e79]'
            - 'button "h9: Empty" [disabled] [ref=e80]'
            - 'button "i9: Empty" [disabled] [ref=e81]'
            - generic [ref=e82]: "8"
            - 'button "a8: Empty" [disabled] [ref=e83]'
            - 'button "b8: Empty" [disabled] [ref=e84]'
            - 'button "c8: North green triangle" [disabled] [ref=e85]':
              - generic: ▲
            - 'button "d8: Empty" [disabled] [ref=e86]'
            - 'button "e8: Empty" [disabled] [ref=e87]'
            - 'button "f8: Empty" [disabled] [ref=e88]'
            - 'button "g8: Empty" [disabled] [ref=e89]'
            - 'button "h8: Empty" [disabled] [ref=e90]'
            - 'button "i8: East black square" [disabled] [ref=e91]':
              - generic: ■
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
            - 'button "e6: Empty" [disabled] [ref=e107]'
            - 'button "f6: Empty" [disabled] [ref=e108]'
            - 'button "g6: Empty" [disabled] [ref=e109]'
            - 'button "h6: Empty" [disabled] [ref=e110]'
            - 'button "i6: Empty" [disabled] [ref=e111]'
            - generic [ref=e112]: "5"
            - 'button "a5: Empty" [disabled] [ref=e113]'
            - 'button "b5: Empty" [disabled] [ref=e114]'
            - 'button "c5: Empty" [disabled] [ref=e115]'
            - 'button "d5: Empty" [disabled] [ref=e116]'
            - 'button "e5: South red circle" [disabled] [ref=e117]':
              - generic: ●
            - 'button "f5: Empty" [disabled] [ref=e118]'
            - 'button "g5: Empty" [disabled] [ref=e119]'
            - 'button "h5: Empty" [disabled] [ref=e120]'
            - 'button "i5: Empty" [disabled] [ref=e121]'
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
            - 'button "a2: West gold diamond" [disabled] [ref=e143]':
              - generic: ◆
            - 'button "b2: Empty" [disabled] [ref=e144]'
            - 'button "c2: Empty" [disabled] [ref=e145]'
            - 'button "d2: Empty" [disabled] [ref=e146]'
            - 'button "e2: Empty" [disabled] [ref=e147]'
            - 'button "f2: Empty" [disabled] [ref=e148]'
            - 'button "g2: Empty" [disabled] [ref=e149]'
            - 'button "h2: Empty" [disabled] [ref=e150]'
            - 'button "i2: Empty" [disabled] [ref=e151]'
            - generic [ref=e152]: "1"
            - 'button "a1: Empty" [disabled] [ref=e153]'
            - 'button "b1: Empty" [disabled] [ref=e154]'
            - 'button "c1: Empty" [disabled] [ref=e155]'
            - 'button "d1: Empty" [disabled] [ref=e156]'
            - 'button "e1: Empty" [disabled] [ref=e157]'
            - 'button "f1: Empty" [disabled] [ref=e158]'
            - 'button "g1: Empty" [disabled] [ref=e159]'
            - 'button "h1: Empty" [disabled] [ref=e160]'
            - 'button "i1: Empty" [disabled] [ref=e161]'
          - status [ref=e162]: Game finished. Use the game controls to review earlier moves.
        - status [ref=e166]:
          - generic [ref=e167]:
            - generic [ref=e168]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
            - text: The central hill was reached. Game won.
        - generic [ref=e171]:
          - generic [ref=e176]:
            - img "West gold diamond" [ref=e177]:
              - generic [ref=e178]: ◆
            - generic [ref=e179]: jordan_plays
          - generic [ref=e180]:
            - generic [ref=e181]: Walls
            - generic [ref=e182]: "5"
      - generic [ref=e184]:
        - heading "avery wins" [level=2] [ref=e186]
        - list "Standings" [ref=e187]:
          - listitem [ref=e188]:
            - generic [ref=e189]:
              - generic [ref=e190]: 1st
              - generic [ref=e193]: avery
          - listitem [ref=e194]:
            - generic [ref=e195]:
              - generic [ref=e196]: 2nd
              - generic [ref=e199]: jordan_plays
          - listitem [ref=e200]:
            - generic [ref=e201]:
              - generic [ref=e202]: 2nd
              - generic [ref=e205]: morgan
          - listitem [ref=e206]:
            - generic [ref=e207]:
              - generic [ref=e208]: 2nd
              - generic [ref=e211]: robin_42
      - region "Game record" [ref=e213]:
        - heading "Game record" [level=2] [ref=e216]
        - generic [ref=e217]:
          - list "Moves played" [ref=e219]:
            - listitem [ref=e220]:
              - generic [ref=e221]: "1"
              - generic [ref=e222]:
                - generic [ref=e224]: ●
                - 'button "Move 1, South red circle: e2" [ref=e225] [cursor=pointer]': e2
              - generic [ref=e226]:
                - generic [ref=e228]: ◆
                - 'button "Move 2, West gold diamond: a4" [ref=e229] [cursor=pointer]': a4
              - generic [ref=e230]:
                - generic [ref=e232]: ▲
                - 'button "Move 3, North green triangle: e8" [ref=e233] [cursor=pointer]': e8
              - generic [ref=e234]:
                - generic [ref=e236]: ■
                - 'button "Move 4, East black square: i6" [ref=e237] [cursor=pointer]': i6
            - listitem [ref=e238]:
              - generic [ref=e239]: "2"
              - generic [ref=e240]:
                - generic [ref=e242]: ●
                - 'button "Move 5, South red circle: e3" [ref=e243] [cursor=pointer]': e3
              - generic [ref=e244]:
                - generic [ref=e246]: ◆
                - 'button "Move 6, West gold diamond: a3" [ref=e247] [cursor=pointer]': a3
              - generic [ref=e248]:
                - generic [ref=e250]: ▲
                - 'button "Move 7, North green triangle: d8" [ref=e251] [cursor=pointer]': d8
              - generic [ref=e252]:
                - generic [ref=e254]: ■
                - 'button "Move 8, East black square: i7" [ref=e255] [cursor=pointer]': i7
            - listitem [ref=e256]:
              - generic [ref=e257]: "3"
              - generic [ref=e258]:
                - generic [ref=e260]: ●
                - 'button "Move 9, South red circle: e4" [ref=e261] [cursor=pointer]': e4
              - generic [ref=e262]:
                - generic [ref=e264]: ◆
                - 'button "Move 10, West gold diamond: a2" [ref=e265] [cursor=pointer]': a2
              - generic [ref=e266]:
                - generic [ref=e268]: ▲
                - 'button "Move 11, North green triangle: c8" [ref=e269] [cursor=pointer]': c8
              - generic [ref=e270]:
                - generic [ref=e272]: ■
                - 'button "Move 12, East black square: i8" [ref=e273] [cursor=pointer]': i8
            - listitem [ref=e274]:
              - generic [ref=e275]: "4"
              - generic [ref=e276]:
                - generic [ref=e278]: ●
                - 'button "Move 13, South red circle: e5" [ref=e279] [cursor=pointer]': e5
          - generic [ref=e280]:
            - generic [ref=e281]:
              - button "Go to the start" [ref=e282] [cursor=pointer]:
                - img [ref=e285]
              - button "Previous move" [ref=e288] [cursor=pointer]:
                - img [ref=e291]
              - button "Next move" [disabled] [ref=e293]:
                - img [ref=e296]
              - button "Return to current position" [ref=e298] [cursor=pointer]:
                - img [ref=e301]
            - button "Go to move" [ref=e304] [cursor=pointer]:
              - generic [ref=e306]:
                - paragraph [ref=e307]: Go to move
                - img [ref=e310]
        - generic [ref=e313]:
          - group "What next" [ref=e314]:
            - button "Rematch" [ref=e315] [cursor=pointer]:
              - paragraph [ref=e318]: Rematch
            - button "Change game" [ref=e319] [cursor=pointer]:
              - paragraph [ref=e322]: Change game
            - button "Review" [ref=e323] [cursor=pointer]:
              - paragraph [ref=e326]: Review
          - button "History and stats" [ref=e327] [cursor=pointer]:
            - paragraph [ref=e330]: History and stats
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