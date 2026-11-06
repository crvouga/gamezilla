# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--pass-and-continue dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  85986 pixels (ratio 0.08 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/pass-and-continue-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/pass-and-continue-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 85986 pixels (ratio 0.08 of all image pixels) are different.
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
  - 85986 pixels (ratio 0.08 of all image pixels) are different.

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
                - generic [ref=e38]: Walls 0
          - listitem [ref=e39]:
            - generic [ref=e43]:
              - generic [ref=e44]: jordan_plays
              - generic [ref=e45]:
                - generic [ref=e47]: ◆
                - generic [ref=e48]: Walls 3
          - listitem [ref=e49]:
            - generic [ref=e53]:
              - generic [ref=e54]: robin_42
              - generic [ref=e55]:
                - generic [ref=e57]: ■
                - generic [ref=e58]: Walls 1
        - generic [ref=e60]:
          - generic [ref=e61]:
            - button "Move pawn" [disabled] [pressed] [ref=e62]:
              - paragraph [ref=e65]: Move pawn
            - button "Horizontal wall" [disabled] [ref=e66]:
              - paragraph [ref=e69]: Horizontal wall
            - button "Vertical wall" [disabled] [ref=e70]:
              - paragraph [ref=e73]: Vertical wall
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
            - 'button "a8: Empty, wall boundaries: right" [disabled] [ref=e96]'
            - 'button "b8: Empty, wall boundaries: left" [disabled] [ref=e97]'
            - 'button "c8: Empty, wall boundaries: bottom" [disabled] [ref=e98]'
            - 'button "d8: Empty, wall boundaries: bottom" [disabled] [ref=e99]'
            - 'button "e8: Empty" [disabled] [ref=e100]'
            - 'button "f8: Empty, wall boundaries: bottom" [disabled] [ref=e101]'
            - 'button "g8: Empty, wall boundaries: bottom" [disabled] [ref=e102]'
            - 'button "h8: Empty" [disabled] [ref=e103]'
            - 'button "i8: Empty" [disabled] [ref=e104]'
            - generic [ref=e105]: "7"
            - 'button "a7: Empty, wall boundaries: right" [disabled] [ref=e106]'
            - 'button "b7: Empty, wall boundaries: left" [disabled] [ref=e107]'
            - 'button "c7: Empty, wall boundaries: top" [disabled] [ref=e108]'
            - 'button "d7: Empty, wall boundaries: top" [disabled] [ref=e109]'
            - 'button "e7: Empty" [disabled] [ref=e110]'
            - 'button "f7: Empty, wall boundaries: top" [disabled] [ref=e111]'
            - 'button "g7: Empty, wall boundaries: top" [disabled] [ref=e112]'
            - 'button "h7: Empty" [disabled] [ref=e113]'
            - 'button "i7: Empty" [disabled] [ref=e114]'
            - generic [ref=e115]: "6"
            - 'button "a6: Empty, wall boundaries: right" [disabled] [ref=e116]'
            - 'button "b6: Empty, wall boundaries: left" [disabled] [ref=e117]'
            - 'button "c6: Empty, wall boundaries: bottom" [disabled] [ref=e118]'
            - 'button "d6: Empty, wall boundaries: bottom" [disabled] [ref=e119]'
            - 'button "e6: Empty" [disabled] [ref=e120]'
            - 'button "f6: Empty" [disabled] [ref=e121]'
            - 'button "g6: Empty" [disabled] [ref=e122]'
            - 'button "h6: Empty" [disabled] [ref=e123]'
            - 'button "i6: Empty" [disabled] [ref=e124]'
            - generic [ref=e125]: "5"
            - 'button "a5: Empty, wall boundaries: right" [disabled] [ref=e126]'
            - 'button "b5: Empty, wall boundaries: left" [disabled] [ref=e127]'
            - 'button "c5: Empty, wall boundaries: top" [disabled] [ref=e128]'
            - 'button "d5: Empty, wall boundaries: top" [disabled] [ref=e129]'
            - 'button "e5: West gold diamond" [disabled] [ref=e130]':
              - generic: ◆
            - 'button "f5: Empty" [disabled] [ref=e131]'
            - 'button "g5: Empty" [disabled] [ref=e132]'
            - 'button "h5: Empty" [disabled] [ref=e133]'
            - 'button "i5: East black square" [disabled] [ref=e134]':
              - generic: ■
            - generic [ref=e135]: "4"
            - 'button "a4: Empty, wall boundaries: bottom" [disabled] [ref=e136]'
            - 'button "b4: Empty, wall boundaries: bottom" [disabled] [ref=e137]'
            - 'button "c4: Empty" [disabled] [ref=e138]'
            - 'button "d4: Empty" [disabled] [ref=e139]'
            - 'button "e4: North green triangle" [disabled] [ref=e140]':
              - generic: ▲
            - 'button "f4: Empty" [disabled] [ref=e141]'
            - 'button "g4: Empty, wall boundaries: bottom" [disabled] [ref=e142]'
            - 'button "h4: Empty, wall boundaries: bottom" [disabled] [ref=e143]'
            - 'button "i4: Empty" [disabled] [ref=e144]'
            - generic [ref=e145]: "3"
            - 'button "a3: Empty, wall boundaries: top" [disabled] [ref=e146]'
            - 'button "b3: Empty, wall boundaries: top" [disabled] [ref=e147]'
            - 'button "c3: Empty" [disabled] [ref=e148]'
            - 'button "d3: Empty, wall boundaries: right" [disabled] [ref=e149]'
            - 'button "e3: Empty, wall boundaries: left, right" [disabled] [ref=e150]'
            - 'button "f3: Empty, wall boundaries: left" [disabled] [ref=e151]'
            - 'button "g3: Empty, wall boundaries: top" [disabled] [ref=e152]'
            - 'button "h3: Empty, wall boundaries: top" [disabled] [ref=e153]'
            - 'button "i3: Empty" [disabled] [ref=e154]'
            - generic [ref=e155]: "2"
            - 'button "a2: Empty, wall boundaries: bottom" [disabled] [ref=e156]'
            - 'button "b2: Empty, wall boundaries: bottom" [disabled] [ref=e157]'
            - 'button "c2: Empty" [disabled] [ref=e158]'
            - 'button "d2: Empty, wall boundaries: right, bottom" [disabled] [ref=e159]'
            - 'button "e2: South red circle, wall boundaries: left, right, bottom" [disabled] [ref=e160]':
              - generic: ●
            - 'button "f2: Empty, wall boundaries: left" [disabled] [ref=e161]'
            - 'button "g2: Empty, wall boundaries: bottom" [disabled] [ref=e162]'
            - 'button "h2: Empty, wall boundaries: bottom" [disabled] [ref=e163]'
            - 'button "i2: Empty" [disabled] [ref=e164]'
            - generic [ref=e165]: "1"
            - 'button "a1: Empty, wall boundaries: top" [disabled] [ref=e166]'
            - 'button "b1: Empty, wall boundaries: top" [disabled] [ref=e167]'
            - 'button "c1: Empty" [disabled] [ref=e168]'
            - 'button "d1: Empty, wall boundaries: top" [disabled] [ref=e169]'
            - 'button "e1: Empty, wall boundaries: top" [disabled] [ref=e170]'
            - 'button "f1: Empty" [disabled] [ref=e171]'
            - 'button "g1: Empty, wall boundaries: top" [disabled] [ref=e172]'
            - 'button "h1: Empty, wall boundaries: top" [disabled] [ref=e173]'
            - 'button "i1: Empty" [disabled] [ref=e174]'
          - status [ref=e175]: Game finished. Use the game controls to review earlier moves.
        - status [ref=e179]:
          - generic [ref=e180]:
            - generic [ref=e181]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
            - text: The central hill was reached. Game won.
        - generic [ref=e184]:
          - generic [ref=e189]:
            - img "North green triangle" [ref=e190]:
              - generic [ref=e191]: ▲
            - generic [ref=e192]: morgan
          - generic [ref=e193]:
            - generic [ref=e194]: Walls
            - generic [ref=e195]: "4"
      - generic [ref=e197]:
        - heading "jordan_plays wins" [level=2] [ref=e199]
        - list "Standings" [ref=e200]:
          - listitem [ref=e201]:
            - generic [ref=e202]:
              - generic [ref=e203]: 1st
              - generic [ref=e206]: jordan_plays
          - listitem [ref=e207]:
            - generic [ref=e208]:
              - generic [ref=e209]: 2nd
              - generic [ref=e212]: avery
          - listitem [ref=e213]:
            - generic [ref=e214]:
              - generic [ref=e215]: 2nd
              - generic [ref=e218]: morgan
          - listitem [ref=e219]:
            - generic [ref=e220]:
              - generic [ref=e221]: 2nd
              - generic [ref=e224]: robin_42
      - region "Game record" [ref=e226]:
        - heading "Game record" [level=2] [ref=e229]
        - generic [ref=e230]:
          - list "Moves played" [ref=e232]:
            - listitem [ref=e233]:
              - generic [ref=e234]: "1"
              - generic [ref=e235]:
                - generic [ref=e237]: ●
                - 'button "Move 1, South red circle: e2" [ref=e238] [cursor=pointer]': e2
              - generic [ref=e239]:
                - generic [ref=e241]: ◆
                - 'button "Move 2, West gold diamond: a4" [ref=e242] [cursor=pointer]': a4
              - generic [ref=e243]:
                - generic [ref=e245]: ▲
                - 'button "Move 3, North green triangle: e8" [ref=e246] [cursor=pointer]': e8
              - generic [ref=e247]:
                - generic [ref=e249]: ■
                - 'button "Move 4, East black square: i6" [ref=e250] [cursor=pointer]': i6
            - listitem [ref=e251]:
              - generic [ref=e252]: "2"
              - generic [ref=e253]:
                - generic [ref=e255]: ●
                - 'button "Move 5, South red circle: e1" [ref=e256] [cursor=pointer]': e1
              - generic [ref=e257]:
                - generic [ref=e259]: ◆
                - 'button "Move 6, West gold diamond: b4" [ref=e260] [cursor=pointer]': b4
              - generic [ref=e261]:
                - generic [ref=e263]: ▲
                - 'button "Move 7, North green triangle: e7" [ref=e264] [cursor=pointer]': e7
              - generic [ref=e265]:
                - generic [ref=e267]: ■
                - 'button "Move 8, East black square: i5" [ref=e268] [cursor=pointer]': i5
            - listitem [ref=e269]:
              - generic [ref=e270]: "3"
              - generic [ref=e271]:
                - generic [ref=e273]: ●
                - 'button "Move 9, South red circle: e2" [ref=e274] [cursor=pointer]': e2
              - generic [ref=e275]:
                - generic [ref=e277]: ◆
                - 'button "Move 10, West gold diamond: c4" [ref=e278] [cursor=pointer]': c4
              - generic [ref=e279]:
                - generic [ref=e281]: ▲
                - 'button "Move 11, North green triangle: f7" [ref=e282] [cursor=pointer]': f7
              - generic [ref=e283]:
                - generic [ref=e285]: ■
                - 'button "Move 12, East black square: i6" [ref=e286] [cursor=pointer]': i6
            - listitem [ref=e287]:
              - generic [ref=e288]: "4"
              - generic [ref=e289]:
                - generic [ref=e291]: ●
                - 'button "Move 13, South red circle: a1h" [ref=e292] [cursor=pointer]': a1h
              - generic [ref=e293]:
                - generic [ref=e295]: ◆
                - 'button "Move 14, West gold diamond: d4" [ref=e296] [cursor=pointer]': d4
              - generic [ref=e297]:
                - generic [ref=e299]: ▲
                - 'button "Move 15, North green triangle: f6" [ref=e300] [cursor=pointer]': f6
              - generic [ref=e301]:
                - generic [ref=e303]: ■
                - 'button "Move 16, East black square: i5" [ref=e304] [cursor=pointer]': i5
            - listitem [ref=e305]:
              - generic [ref=e306]: "5"
              - generic [ref=e307]:
                - generic [ref=e309]: ●
                - 'button "Move 17, South red circle: c7h" [ref=e310] [cursor=pointer]': c7h
              - generic [ref=e311]:
                - generic [ref=e313]: ◆
                - 'button "Move 18, West gold diamond: d3" [ref=e314] [cursor=pointer]': d3
              - generic [ref=e315]:
                - generic [ref=e317]: ▲
                - 'button "Move 19, North green triangle: f5" [ref=e318] [cursor=pointer]': f5
              - generic [ref=e319]:
                - generic [ref=e321]: ■
                - 'button "Move 20, East black square: a3h" [ref=e322] [cursor=pointer]': a3h
            - listitem [ref=e323]:
              - generic [ref=e324]: "6"
              - generic [ref=e325]:
                - generic [ref=e327]: ●
                - 'button "Move 21, South red circle: f7h" [ref=e328] [cursor=pointer]': f7h
              - generic [ref=e329]:
                - generic [ref=e331]: ◆
                - 'button "Move 22, West gold diamond: e3" [ref=e332] [cursor=pointer]': e3
              - generic [ref=e333]:
                - generic [ref=e335]: ▲
                - 'button "Move 23, North green triangle: f4" [ref=e336] [cursor=pointer]': f4
              - generic [ref=e337]:
                - generic [ref=e339]: ■
                - 'button "Move 24, East black square: c5h" [ref=e340] [cursor=pointer]': c5h
            - listitem [ref=e341]:
              - generic [ref=e342]: "7"
              - generic [ref=e343]:
                - generic [ref=e345]: ●
                - 'button "Move 25, South red circle: a7v" [ref=e346] [cursor=pointer]': a7v
              - generic [ref=e347]:
                - generic [ref=e349]: ◆
                - 'button "Move 26, West gold diamond: d2v" [ref=e350] [cursor=pointer]': d2v
              - generic [ref=e351]:
                - generic [ref=e353]: ▲
                - 'button "Move 27, North green triangle: e4" [ref=e354] [cursor=pointer]': e4
              - generic [ref=e355]:
                - generic [ref=e357]: ■
                - 'button "Move 28, East black square: g3h" [ref=e358] [cursor=pointer]': g3h
            - listitem [ref=e359]:
              - generic [ref=e360]: "8"
              - generic [ref=e361]:
                - generic [ref=e363]: ●
                - 'button "Move 29, South red circle: g1h" [ref=e364] [cursor=pointer]': g1h
              - generic [ref=e365]:
                - generic [ref=e367]: ◆
                - 'button "Move 30, West gold diamond: e2v" [ref=e368] [cursor=pointer]': e2v
              - generic [ref=e369]:
                - generic [ref=e371]: ▲
                - 'button "Move 31, North green triangle: d1h" [ref=e372] [cursor=pointer]': d1h
              - generic [ref=e373]:
                - generic [ref=e375]: ■
                - 'button "Move 32, East black square: a5v" [ref=e376] [cursor=pointer]': a5v
            - listitem [ref=e377]:
              - generic [ref=e378]: "9"
              - generic [ref=e379]:
                - generic [ref=e381]: ●
                - 'button "Move 33, South red circle: pass" [ref=e382] [cursor=pointer]': pass
              - generic [ref=e383]:
                - generic [ref=e385]: ◆
                - 'button "Move 34, West gold diamond: e5" [ref=e386] [cursor=pointer]': e5
          - generic [ref=e387]:
            - generic [ref=e388]:
              - button "Go to the start" [ref=e389] [cursor=pointer]:
                - img [ref=e392]
              - button "Previous move" [ref=e395] [cursor=pointer]:
                - img [ref=e398]
              - button "Next move" [disabled] [ref=e400]:
                - img [ref=e403]
              - button "Return to current position" [ref=e405] [cursor=pointer]:
                - img [ref=e408]
            - button "Go to move" [ref=e411] [cursor=pointer]:
              - generic [ref=e413]:
                - paragraph [ref=e414]: Go to move
                - img [ref=e417]
        - generic [ref=e420]:
          - group "What next" [ref=e421]:
            - button "Rematch" [ref=e422] [cursor=pointer]:
              - paragraph [ref=e425]: Rematch
            - button "Change game" [ref=e426] [cursor=pointer]:
              - paragraph [ref=e429]: Change game
            - button "Review" [ref=e430] [cursor=pointer]:
              - paragraph [ref=e433]: Review
          - button "History and stats" [ref=e434] [cursor=pointer]:
            - paragraph [ref=e437]: History and stats
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