# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--four-player-round dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  160144 pixels (ratio 0.14 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/four-player-round-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/four-player-round-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 160144 pixels (ratio 0.14 of all image pixels) are different.
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
  - 160144 pixels (ratio 0.14 of all image pixels) are different.

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
          - generic [ref=e61]:
            - button "Move pawn" [pressed] [ref=e62] [cursor=pointer]:
              - paragraph [ref=e65]: Move pawn
            - button "Horizontal wall" [ref=e66] [cursor=pointer]:
              - paragraph [ref=e69]: Wall across
            - button "Vertical wall" [ref=e70] [cursor=pointer]:
              - paragraph [ref=e73]: Wall down
          - group "Quoridor board, nine columns and nine rows" [ref=e74]:
            - generic [ref=e76]: a
            - generic [ref=e77]: b
            - generic [ref=e78]: c
            - generic [ref=e79]: d
            - generic [ref=e80]: e
            - generic [ref=e81]: f
            - generic [ref=e82]: g
            - generic [ref=e83]: h
            - generic [ref=e84]: i
            - generic [ref=e85]: "9"
            - 'button "a9: Empty" [disabled] [ref=e86]'
            - 'button "b9: Empty" [disabled] [ref=e87]'
            - 'button "c9: Empty" [disabled] [ref=e88]'
            - 'button "d9: Empty" [disabled] [ref=e89]'
            - 'button "e9: Empty" [disabled] [ref=e90]'
            - 'button "f9: Empty" [disabled] [ref=e91]'
            - 'button "g9: Empty" [disabled] [ref=e92]'
            - 'button "h9: Empty" [disabled] [ref=e93]'
            - 'button "i9: Empty" [disabled] [ref=e94]'
            - generic [ref=e95]: "8"
            - 'button "a8: Empty" [disabled] [ref=e96]'
            - 'button "b8: Empty" [disabled] [ref=e97]'
            - 'button "c8: Empty" [disabled] [ref=e98]'
            - 'button "d8: Empty" [disabled] [ref=e99]'
            - 'button "e8: North green triangle" [disabled] [ref=e100]':
              - generic: ▲
            - 'button "f8: Empty" [disabled] [ref=e101]'
            - 'button "g8: Empty" [disabled] [ref=e102]'
            - 'button "h8: Empty" [disabled] [ref=e103]'
            - 'button "i8: Empty" [disabled] [ref=e104]'
            - generic [ref=e105]: "7"
            - 'button "a7: Empty" [disabled] [ref=e106]'
            - 'button "b7: Empty" [disabled] [ref=e107]'
            - 'button "c7: Empty" [disabled] [ref=e108]'
            - 'button "d7: Empty" [disabled] [ref=e109]'
            - 'button "e7: Empty" [disabled] [ref=e110]'
            - 'button "f7: Empty" [disabled] [ref=e111]'
            - 'button "g7: Empty" [disabled] [ref=e112]'
            - 'button "h7: Empty" [disabled] [ref=e113]'
            - 'button "i7: Empty" [disabled] [ref=e114]'
            - generic [ref=e115]: "6"
            - 'button "a6: Empty" [disabled] [ref=e116]'
            - 'button "b6: Empty" [disabled] [ref=e117]'
            - 'button "c6: Empty" [disabled] [ref=e118]'
            - 'button "d6: Empty" [disabled] [ref=e119]'
            - 'button "e6: Empty, wall boundaries: bottom" [disabled] [ref=e120]'
            - 'button "f6: Empty, wall boundaries: bottom" [disabled] [ref=e121]'
            - 'button "g6: Empty" [disabled] [ref=e122]'
            - 'button "h6: Empty" [disabled] [ref=e123]'
            - 'button "i6: East black square" [disabled] [ref=e124]':
              - generic: ■
            - generic [ref=e125]: "5"
            - 'button "a5: Empty, legal move" [ref=e126] [cursor=pointer]':
              - generic: ·
            - 'button "b5: Empty" [disabled] [ref=e127]'
            - 'button "c5: Empty" [disabled] [ref=e128]'
            - 'button "d5: Empty" [disabled] [ref=e129]'
            - 'button "e5: Central hill, wall boundaries: top" [disabled] [ref=e130]':
              - generic: ◎
            - 'button "f5: Empty, wall boundaries: top" [disabled] [ref=e131]'
            - 'button "g5: Empty" [disabled] [ref=e132]'
            - 'button "h5: Empty" [disabled] [ref=e133]'
            - 'button "i5: Empty" [disabled] [ref=e134]'
            - generic [ref=e135]: "4"
            - 'button "a4: West gold diamond" [disabled] [ref=e136]':
              - generic: ◆
            - 'button "b4: Empty, legal move" [ref=e137] [cursor=pointer]':
              - generic: ·
            - 'button "c4: Empty" [disabled] [ref=e138]'
            - 'button "d4: Empty" [disabled] [ref=e139]'
            - 'button "e4: Empty" [disabled] [ref=e140]'
            - 'button "f4: Empty" [disabled] [ref=e141]'
            - 'button "g4: Empty" [disabled] [ref=e142]'
            - 'button "h4: Empty" [disabled] [ref=e143]'
            - 'button "i4: Empty" [disabled] [ref=e144]'
            - generic [ref=e145]: "3"
            - 'button "a3: Empty, legal move" [ref=e146] [cursor=pointer]':
              - generic: ·
            - 'button "b3: Empty" [disabled] [ref=e147]'
            - 'button "c3: Empty" [disabled] [ref=e148]'
            - 'button "d3: Empty" [disabled] [ref=e149]'
            - 'button "e3: Empty" [disabled] [ref=e150]'
            - 'button "f3: Empty" [disabled] [ref=e151]'
            - 'button "g3: Empty" [disabled] [ref=e152]'
            - 'button "h3: Empty" [disabled] [ref=e153]'
            - 'button "i3: Empty" [disabled] [ref=e154]'
            - generic [ref=e155]: "2"
            - 'button "a2: Empty" [disabled] [ref=e156]'
            - 'button "b2: Empty" [disabled] [ref=e157]'
            - 'button "c2: Empty" [disabled] [ref=e158]'
            - 'button "d2: Empty" [disabled] [ref=e159]'
            - 'button "e2: South red circle" [disabled] [ref=e160]':
              - generic: ●
            - 'button "f2: Empty" [disabled] [ref=e161]'
            - 'button "g2: Empty" [disabled] [ref=e162]'
            - 'button "h2: Empty" [disabled] [ref=e163]'
            - 'button "i2: Empty" [disabled] [ref=e164]'
            - generic [ref=e165]: "1"
            - 'button "a1: Empty" [disabled] [ref=e166]'
            - 'button "b1: Empty" [disabled] [ref=e167]'
            - 'button "c1: Empty" [disabled] [ref=e168]'
            - 'button "d1: Empty" [disabled] [ref=e169]'
            - 'button "e1: Empty" [disabled] [ref=e170]'
            - 'button "f1: Empty" [disabled] [ref=e171]'
            - 'button "g1: Empty" [disabled] [ref=e172]'
            - 'button "h1: Empty" [disabled] [ref=e173]'
            - 'button "i1: Empty" [disabled] [ref=e174]'
          - generic [ref=e175]:
            - paragraph [ref=e176]: Move to a coordinate
            - button "Move to a coordinate" [ref=e177] [cursor=pointer]:
              - paragraph [ref=e178]: Select…
              - img [ref=e180]
          - status [ref=e182]: Choose a marked square to move your pawn.
        - status [ref=e184]:
          - generic [ref=e185]:
            - generic [ref=e186]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
            - text: Your turn. First to e5 wins.
        - generic [ref=e189]:
          - generic [ref=e194]:
            - img "West gold diamond" [ref=e195]:
              - generic [ref=e196]: ◆
            - generic [ref=e197]: jordan_plays
            - generic [ref=e198]: Your move
          - generic [ref=e199]:
            - generic [ref=e200]: Walls
            - generic [ref=e201]: "5"
      - region "Game record" [ref=e203]:
        - generic [ref=e204]:
          - heading "Game record" [level=2] [ref=e206]
          - paragraph [ref=e207]: Your turn. First to e5 wins.
        - generic [ref=e208]:
          - list "Moves played" [ref=e210]:
            - listitem [ref=e211]:
              - generic [ref=e212]: "1"
              - generic [ref=e213]:
                - generic [ref=e215]: ●
                - 'button "Move 1, South red circle: e2" [ref=e216] [cursor=pointer]': e2
              - generic [ref=e217]:
                - generic [ref=e219]: ◆
                - 'button "Move 2, West gold diamond: a4" [ref=e220] [cursor=pointer]': a4
              - generic [ref=e221]:
                - generic [ref=e223]: ▲
                - 'button "Move 3, North green triangle: e8" [ref=e224] [cursor=pointer]': e8
              - generic [ref=e225]:
                - generic [ref=e227]: ■
                - 'button "Move 4, East black square: i6" [ref=e228] [cursor=pointer]': i6
            - listitem [ref=e229]:
              - generic [ref=e230]: "2"
              - generic [ref=e231]:
                - generic [ref=e233]: ●
                - 'button "Move 5, South red circle: e5h" [ref=e234] [cursor=pointer]': e5h
          - generic [ref=e235]:
            - generic [ref=e236]:
              - button "Go to the start" [ref=e237] [cursor=pointer]:
                - img [ref=e240]
              - button "Previous move" [ref=e243] [cursor=pointer]:
                - img [ref=e246]
              - button "Next move" [disabled] [ref=e248]:
                - img [ref=e251]
              - button "Return to current position" [ref=e253] [cursor=pointer]:
                - img [ref=e256]
            - button "Go to move" [ref=e259] [cursor=pointer]:
              - generic [ref=e261]:
                - paragraph [ref=e262]: Go to move
                - img [ref=e265]
        - generic [ref=e268]:
          - group "Game actions" [ref=e269]:
            - button "Offer draw" [ref=e270] [cursor=pointer]:
              - paragraph [ref=e273]: Offer draw
            - button "Resign game" [ref=e274] [cursor=pointer]:
              - paragraph [ref=e277]:
                - text: Resign
                - generic [ref=e278]: game
          - button "History and stats" [ref=e279] [cursor=pointer]:
            - paragraph [ref=e282]: History and stats
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