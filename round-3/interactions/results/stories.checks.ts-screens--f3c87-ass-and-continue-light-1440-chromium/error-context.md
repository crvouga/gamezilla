# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--pass-and-continue light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  3892 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/pass-and-continue-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/pass-and-continue-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 3892 pixels (ratio 0.01 of all image pixels) are different.
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
  - 3892 pixels (ratio 0.01 of all image pixels) are different.

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
            - 'button "a8: Empty, wall boundaries: right" [disabled] [ref=e83]'
            - 'button "b8: Empty, wall boundaries: left" [disabled] [ref=e84]'
            - 'button "c8: Empty, wall boundaries: bottom" [disabled] [ref=e85]'
            - 'button "d8: Empty, wall boundaries: bottom" [disabled] [ref=e86]'
            - 'button "e8: Empty" [disabled] [ref=e87]'
            - 'button "f8: Empty, wall boundaries: bottom" [disabled] [ref=e88]'
            - 'button "g8: Empty, wall boundaries: bottom" [disabled] [ref=e89]'
            - 'button "h8: Empty" [disabled] [ref=e90]'
            - 'button "i8: Empty" [disabled] [ref=e91]'
            - generic [ref=e92]: "7"
            - 'button "a7: Empty, wall boundaries: right" [disabled] [ref=e93]'
            - 'button "b7: Empty, wall boundaries: left" [disabled] [ref=e94]'
            - 'button "c7: Empty, wall boundaries: top" [disabled] [ref=e95]'
            - 'button "d7: Empty, wall boundaries: top" [disabled] [ref=e96]'
            - 'button "e7: Empty" [disabled] [ref=e97]'
            - 'button "f7: Empty, wall boundaries: top" [disabled] [ref=e98]'
            - 'button "g7: Empty, wall boundaries: top" [disabled] [ref=e99]'
            - 'button "h7: Empty" [disabled] [ref=e100]'
            - 'button "i7: Empty" [disabled] [ref=e101]'
            - generic [ref=e102]: "6"
            - 'button "a6: Empty, wall boundaries: right" [disabled] [ref=e103]'
            - 'button "b6: Empty, wall boundaries: left" [disabled] [ref=e104]'
            - 'button "c6: Empty, wall boundaries: bottom" [disabled] [ref=e105]'
            - 'button "d6: Empty, wall boundaries: bottom" [disabled] [ref=e106]'
            - 'button "e6: Empty" [disabled] [ref=e107]'
            - 'button "f6: Empty" [disabled] [ref=e108]'
            - 'button "g6: Empty" [disabled] [ref=e109]'
            - 'button "h6: Empty" [disabled] [ref=e110]'
            - 'button "i6: Empty" [disabled] [ref=e111]'
            - generic [ref=e112]: "5"
            - 'button "a5: Empty, wall boundaries: right" [disabled] [ref=e113]'
            - 'button "b5: Empty, wall boundaries: left" [disabled] [ref=e114]'
            - 'button "c5: Empty, wall boundaries: top" [disabled] [ref=e115]'
            - 'button "d5: Empty, wall boundaries: top" [disabled] [ref=e116]'
            - 'button "e5: West gold diamond" [disabled] [ref=e117]':
              - generic: ◆
            - 'button "f5: Empty" [disabled] [ref=e118]'
            - 'button "g5: Empty" [disabled] [ref=e119]'
            - 'button "h5: Empty" [disabled] [ref=e120]'
            - 'button "i5: East black square" [disabled] [ref=e121]':
              - generic: ■
            - generic [ref=e122]: "4"
            - 'button "a4: Empty, wall boundaries: bottom" [disabled] [ref=e123]'
            - 'button "b4: Empty, wall boundaries: bottom" [disabled] [ref=e124]'
            - 'button "c4: Empty" [disabled] [ref=e125]'
            - 'button "d4: Empty" [disabled] [ref=e126]'
            - 'button "e4: North green triangle" [disabled] [ref=e127]':
              - generic: ▲
            - 'button "f4: Empty" [disabled] [ref=e128]'
            - 'button "g4: Empty, wall boundaries: bottom" [disabled] [ref=e129]'
            - 'button "h4: Empty, wall boundaries: bottom" [disabled] [ref=e130]'
            - 'button "i4: Empty" [disabled] [ref=e131]'
            - generic [ref=e132]: "3"
            - 'button "a3: Empty, wall boundaries: top" [disabled] [ref=e133]'
            - 'button "b3: Empty, wall boundaries: top" [disabled] [ref=e134]'
            - 'button "c3: Empty" [disabled] [ref=e135]'
            - 'button "d3: Empty, wall boundaries: right" [disabled] [ref=e136]'
            - 'button "e3: Empty, wall boundaries: left, right" [disabled] [ref=e137]'
            - 'button "f3: Empty, wall boundaries: left" [disabled] [ref=e138]'
            - 'button "g3: Empty, wall boundaries: top" [disabled] [ref=e139]'
            - 'button "h3: Empty, wall boundaries: top" [disabled] [ref=e140]'
            - 'button "i3: Empty" [disabled] [ref=e141]'
            - generic [ref=e142]: "2"
            - 'button "a2: Empty, wall boundaries: bottom" [disabled] [ref=e143]'
            - 'button "b2: Empty, wall boundaries: bottom" [disabled] [ref=e144]'
            - 'button "c2: Empty" [disabled] [ref=e145]'
            - 'button "d2: Empty, wall boundaries: right, bottom" [disabled] [ref=e146]'
            - 'button "e2: South red circle, wall boundaries: left, right, bottom" [disabled] [ref=e147]':
              - generic: ●
            - 'button "f2: Empty, wall boundaries: left" [disabled] [ref=e148]'
            - 'button "g2: Empty, wall boundaries: bottom" [disabled] [ref=e149]'
            - 'button "h2: Empty, wall boundaries: bottom" [disabled] [ref=e150]'
            - 'button "i2: Empty" [disabled] [ref=e151]'
            - generic [ref=e152]: "1"
            - 'button "a1: Empty, wall boundaries: top" [disabled] [ref=e153]'
            - 'button "b1: Empty, wall boundaries: top" [disabled] [ref=e154]'
            - 'button "c1: Empty" [disabled] [ref=e155]'
            - 'button "d1: Empty, wall boundaries: top" [disabled] [ref=e156]'
            - 'button "e1: Empty, wall boundaries: top" [disabled] [ref=e157]'
            - 'button "f1: Empty" [disabled] [ref=e158]'
            - 'button "g1: Empty, wall boundaries: top" [disabled] [ref=e159]'
            - 'button "h1: Empty, wall boundaries: top" [disabled] [ref=e160]'
            - 'button "i1: Empty" [disabled] [ref=e161]'
          - status [ref=e162]: Game finished. Use the game controls to review earlier moves.
        - status [ref=e166]:
          - generic [ref=e167]:
            - generic [ref=e168]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
            - text: The central hill was reached. Game won.
        - generic [ref=e171]:
          - generic [ref=e176]:
            - img "North green triangle" [ref=e177]:
              - generic [ref=e178]: ▲
            - generic [ref=e179]: morgan
          - generic [ref=e180]:
            - generic [ref=e181]: Walls
            - generic [ref=e182]: "4"
      - generic [ref=e184]:
        - heading "jordan_plays wins" [level=2] [ref=e186]
        - list "Standings" [ref=e187]:
          - listitem [ref=e188]:
            - generic [ref=e189]:
              - generic [ref=e190]: 1st
              - generic [ref=e193]: jordan_plays
          - listitem [ref=e194]:
            - generic [ref=e195]:
              - generic [ref=e196]: 2nd
              - generic [ref=e199]: avery
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
                - 'button "Move 5, South red circle: e1" [ref=e243] [cursor=pointer]': e1
              - generic [ref=e244]:
                - generic [ref=e246]: ◆
                - 'button "Move 6, West gold diamond: b4" [ref=e247] [cursor=pointer]': b4
              - generic [ref=e248]:
                - generic [ref=e250]: ▲
                - 'button "Move 7, North green triangle: e7" [ref=e251] [cursor=pointer]': e7
              - generic [ref=e252]:
                - generic [ref=e254]: ■
                - 'button "Move 8, East black square: i5" [ref=e255] [cursor=pointer]': i5
            - listitem [ref=e256]:
              - generic [ref=e257]: "3"
              - generic [ref=e258]:
                - generic [ref=e260]: ●
                - 'button "Move 9, South red circle: e2" [ref=e261] [cursor=pointer]': e2
              - generic [ref=e262]:
                - generic [ref=e264]: ◆
                - 'button "Move 10, West gold diamond: c4" [ref=e265] [cursor=pointer]': c4
              - generic [ref=e266]:
                - generic [ref=e268]: ▲
                - 'button "Move 11, North green triangle: f7" [ref=e269] [cursor=pointer]': f7
              - generic [ref=e270]:
                - generic [ref=e272]: ■
                - 'button "Move 12, East black square: i6" [ref=e273] [cursor=pointer]': i6
            - listitem [ref=e274]:
              - generic [ref=e275]: "4"
              - generic [ref=e276]:
                - generic [ref=e278]: ●
                - 'button "Move 13, South red circle: a1h" [ref=e279] [cursor=pointer]': a1h
              - generic [ref=e280]:
                - generic [ref=e282]: ◆
                - 'button "Move 14, West gold diamond: d4" [ref=e283] [cursor=pointer]': d4
              - generic [ref=e284]:
                - generic [ref=e286]: ▲
                - 'button "Move 15, North green triangle: f6" [ref=e287] [cursor=pointer]': f6
              - generic [ref=e288]:
                - generic [ref=e290]: ■
                - 'button "Move 16, East black square: i5" [ref=e291] [cursor=pointer]': i5
            - listitem [ref=e292]:
              - generic [ref=e293]: "5"
              - generic [ref=e294]:
                - generic [ref=e296]: ●
                - 'button "Move 17, South red circle: c7h" [ref=e297] [cursor=pointer]': c7h
              - generic [ref=e298]:
                - generic [ref=e300]: ◆
                - 'button "Move 18, West gold diamond: d3" [ref=e301] [cursor=pointer]': d3
              - generic [ref=e302]:
                - generic [ref=e304]: ▲
                - 'button "Move 19, North green triangle: f5" [ref=e305] [cursor=pointer]': f5
              - generic [ref=e306]:
                - generic [ref=e308]: ■
                - 'button "Move 20, East black square: a3h" [ref=e309] [cursor=pointer]': a3h
            - listitem [ref=e310]:
              - generic [ref=e311]: "6"
              - generic [ref=e312]:
                - generic [ref=e314]: ●
                - 'button "Move 21, South red circle: f7h" [ref=e315] [cursor=pointer]': f7h
              - generic [ref=e316]:
                - generic [ref=e318]: ◆
                - 'button "Move 22, West gold diamond: e3" [ref=e319] [cursor=pointer]': e3
              - generic [ref=e320]:
                - generic [ref=e322]: ▲
                - 'button "Move 23, North green triangle: f4" [ref=e323] [cursor=pointer]': f4
              - generic [ref=e324]:
                - generic [ref=e326]: ■
                - 'button "Move 24, East black square: c5h" [ref=e327] [cursor=pointer]': c5h
            - listitem [ref=e328]:
              - generic [ref=e329]: "7"
              - generic [ref=e330]:
                - generic [ref=e332]: ●
                - 'button "Move 25, South red circle: a7v" [ref=e333] [cursor=pointer]': a7v
              - generic [ref=e334]:
                - generic [ref=e336]: ◆
                - 'button "Move 26, West gold diamond: d2v" [ref=e337] [cursor=pointer]': d2v
              - generic [ref=e338]:
                - generic [ref=e340]: ▲
                - 'button "Move 27, North green triangle: e4" [ref=e341] [cursor=pointer]': e4
              - generic [ref=e342]:
                - generic [ref=e344]: ■
                - 'button "Move 28, East black square: g3h" [ref=e345] [cursor=pointer]': g3h
            - listitem [ref=e346]:
              - generic [ref=e347]: "8"
              - generic [ref=e348]:
                - generic [ref=e350]: ●
                - 'button "Move 29, South red circle: g1h" [ref=e351] [cursor=pointer]': g1h
              - generic [ref=e352]:
                - generic [ref=e354]: ◆
                - 'button "Move 30, West gold diamond: e2v" [ref=e355] [cursor=pointer]': e2v
              - generic [ref=e356]:
                - generic [ref=e358]: ▲
                - 'button "Move 31, North green triangle: d1h" [ref=e359] [cursor=pointer]': d1h
              - generic [ref=e360]:
                - generic [ref=e362]: ■
                - 'button "Move 32, East black square: a5v" [ref=e363] [cursor=pointer]': a5v
            - listitem [ref=e364]:
              - generic [ref=e365]: "9"
              - generic [ref=e366]:
                - generic [ref=e368]: ●
                - 'button "Move 33, South red circle: pass" [ref=e369] [cursor=pointer]': pass
              - generic [ref=e370]:
                - generic [ref=e372]: ◆
                - 'button "Move 34, West gold diamond: e5" [ref=e373] [cursor=pointer]': e5
          - generic [ref=e374]:
            - generic [ref=e375]:
              - button "Go to the start" [ref=e376] [cursor=pointer]:
                - img [ref=e379]
              - button "Previous move" [ref=e382] [cursor=pointer]:
                - img [ref=e385]
              - button "Next move" [disabled] [ref=e387]:
                - img [ref=e390]
              - button "Return to current position" [ref=e392] [cursor=pointer]:
                - img [ref=e395]
            - button "Go to move" [ref=e398] [cursor=pointer]:
              - generic [ref=e400]:
                - paragraph [ref=e401]: Go to move
                - img [ref=e404]
        - generic [ref=e407]:
          - group "What next" [ref=e408]:
            - button "Rematch" [ref=e409] [cursor=pointer]:
              - paragraph [ref=e412]: Rematch
            - button "Change game" [ref=e413] [cursor=pointer]:
              - paragraph [ref=e416]: Change game
            - button "Review" [ref=e417] [cursor=pointer]:
              - paragraph [ref=e420]: Review
          - button "History and stats" [ref=e421] [cursor=pointer]:
            - paragraph [ref=e424]: History and stats
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