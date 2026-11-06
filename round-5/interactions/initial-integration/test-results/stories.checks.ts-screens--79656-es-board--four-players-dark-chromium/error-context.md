# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--four-players dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  55423 pixels (ratio 0.17 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/four-players-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/four-players-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 55423 pixels (ratio 0.17 of all image pixels) are different.
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
  - 55423 pixels (ratio 0.17 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - heading "Word Tiles" [level=1] [ref=e16]
      - generic [ref=e18]:
        - generic [ref=e19]: Unrated
        - generic [ref=e20]: ·Untimed
    - generic [ref=e21]:
      - generic [ref=e23]:
        - paragraph [ref=e24]: Violet — to play · 67 tiles in the bag
        - generic [ref=e25]:
          - paragraph [ref=e30]: No moves yet.
          - button "All moves" [ref=e31] [cursor=pointer]:
            - img [ref=e35]
      - generic [ref=e37]:
        - generic [ref=e39]:
          - list "Players" [ref=e41]:
            - generic "avery" [ref=e42]:
              - listitem [ref=e43]:
                - generic [ref=e46]:
                  - generic [ref=e47]: avery
                  - generic [ref=e48]:
                    - generic [ref=e50]: Score 10
                    - generic [ref=e52]: You
                    - generic [ref=e54]: 7 tiles
            - generic "jordan_plays" [ref=e55]:
              - listitem [ref=e56]:
                - generic [ref=e58]:
                  - generic [ref=e59]: jordan_plays
                  - generic [ref=e60]:
                    - generic [ref=e62]: Score 3
                    - generic [ref=e64]: 7 tiles
            - generic "morgan" [ref=e65]:
              - listitem [ref=e66]:
                - generic [ref=e68]:
                  - generic [ref=e69]: morgan
                  - generic [ref=e70]:
                    - generic [ref=e72]: Score 0
                    - generic [ref=e74]: 7 tiles
            - generic "robin_42" [ref=e75]:
              - listitem [ref=e76]:
                - generic [ref=e78]:
                  - generic [ref=e79]: robin_42
                  - generic [ref=e80]:
                    - generic [ref=e82]: Score 0
                    - generic [ref=e84]: 7 tiles
          - generic [ref=e86]:
            - paragraph [ref=e87]: You are watching. Racks stay private to their players.
            - generic [ref=e88]:
              - generic [ref=e89]:
                - button "Fit board" [pressed] [ref=e90] [cursor=pointer]:
                  - paragraph [ref=e93]: Fit board
                - button "Enlarge board" [ref=e94] [cursor=pointer]:
                  - paragraph [ref=e97]: Enlarge board
              - region "Scrollable word board" [ref=e99]:
                - group "Word board, fifteen columns and fifteen rows" [ref=e100]:
                  - generic [ref=e102]: a
                  - generic [ref=e103]: b
                  - generic [ref=e104]: c
                  - generic [ref=e105]: d
                  - generic [ref=e106]: e
                  - generic [ref=e107]: f
                  - generic [ref=e108]: g
                  - generic [ref=e109]: h
                  - generic [ref=e110]: i
                  - generic [ref=e111]: j
                  - generic [ref=e112]: k
                  - generic [ref=e113]: l
                  - generic [ref=e114]: m
                  - generic [ref=e115]: "n"
                  - generic [ref=e116]: o
                  - generic [ref=e117]: "1"
                  - button "2L, a1, double letter, empty" [disabled] [ref=e118]:
                    - generic [ref=e119]: 2L
                  - button "b1, empty" [disabled] [ref=e120]
                  - button "c1, empty" [disabled] [ref=e121]
                  - button "d1, empty" [disabled] [ref=e122]
                  - button "3W, e1, triple word, empty" [disabled] [ref=e123]:
                    - generic [ref=e124]: 3W
                  - button "f1, empty" [disabled] [ref=e125]
                  - button "g1, empty" [disabled] [ref=e126]
                  - button "2L, h1, double letter, empty" [disabled] [ref=e127]:
                    - generic [ref=e128]: 2L
                  - button "i1, empty" [disabled] [ref=e129]
                  - button "j1, empty" [disabled] [ref=e130]
                  - button "3W, k1, triple word, empty" [disabled] [ref=e131]:
                    - generic [ref=e132]: 3W
                  - button "l1, empty" [disabled] [ref=e133]
                  - button "m1, empty" [disabled] [ref=e134]
                  - button "n1, empty" [disabled] [ref=e135]
                  - button "2L, o1, double letter, empty" [disabled] [ref=e136]:
                    - generic [ref=e137]: 2L
                  - generic [ref=e138]: "2"
                  - button "a2, empty" [disabled] [ref=e139]
                  - button "b2, empty" [disabled] [ref=e140]
                  - button "c2, empty" [disabled] [ref=e141]
                  - button "2L, d2, double letter, empty" [disabled] [ref=e142]:
                    - generic [ref=e143]: 2L
                  - button "e2, empty" [disabled] [ref=e144]
                  - button "f2, empty" [disabled] [ref=e145]
                  - button "2W, g2, double word, empty" [disabled] [ref=e146]:
                    - generic [ref=e147]: 2W
                  - button "h2, empty" [disabled] [ref=e148]
                  - button "2W, i2, double word, empty" [disabled] [ref=e149]:
                    - generic [ref=e150]: 2W
                  - button "j2, empty" [disabled] [ref=e151]
                  - button "k2, empty" [disabled] [ref=e152]
                  - button "2L, l2, double letter, empty" [disabled] [ref=e153]:
                    - generic [ref=e154]: 2L
                  - button "m2, empty" [disabled] [ref=e155]
                  - button "n2, empty" [disabled] [ref=e156]
                  - button "o2, empty" [disabled] [ref=e157]
                  - generic [ref=e158]: "3"
                  - button "a3, empty" [disabled] [ref=e159]
                  - button "b3, empty" [disabled] [ref=e160]
                  - button "c3, empty" [disabled] [ref=e161]
                  - button "d3, empty" [disabled] [ref=e162]
                  - button "3L, e3, triple letter, empty" [disabled] [ref=e163]:
                    - generic [ref=e164]: 3L
                  - button "f3, empty" [disabled] [ref=e165]
                  - button "g3, empty" [disabled] [ref=e166]
                  - button "h3, empty" [disabled] [ref=e167]
                  - button "i3, empty" [disabled] [ref=e168]
                  - button "j3, empty" [disabled] [ref=e169]
                  - button "3L, k3, triple letter, empty" [disabled] [ref=e170]:
                    - generic [ref=e171]: 3L
                  - button "l3, empty" [disabled] [ref=e172]
                  - button "m3, empty" [disabled] [ref=e173]
                  - button "n3, empty" [disabled] [ref=e174]
                  - button "o3, empty" [disabled] [ref=e175]
                  - generic [ref=e176]: "4"
                  - button "a4, empty" [disabled] [ref=e177]
                  - button "2L, b4, double letter, empty" [disabled] [ref=e178]:
                    - generic [ref=e179]: 2L
                  - button "c4, empty" [disabled] [ref=e180]
                  - button "2W, d4, double word, empty" [disabled] [ref=e181]:
                    - generic [ref=e182]: 2W
                  - button "e4, empty" [disabled] [ref=e183]
                  - button "f4, empty" [disabled] [ref=e184]
                  - button "g4, empty" [disabled] [ref=e185]
                  - button "h4, empty" [disabled] [ref=e186]
                  - button "i4, empty" [disabled] [ref=e187]
                  - button "j4, empty" [disabled] [ref=e188]
                  - button "k4, empty" [disabled] [ref=e189]
                  - button "2W, l4, double word, empty" [disabled] [ref=e190]:
                    - generic [ref=e191]: 2W
                  - button "m4, empty" [disabled] [ref=e192]
                  - button "2L, n4, double letter, empty" [disabled] [ref=e193]:
                    - generic [ref=e194]: 2L
                  - button "o4, empty" [disabled] [ref=e195]
                  - generic [ref=e196]: "5"
                  - button "3W, a5, triple word, empty" [disabled] [ref=e197]:
                    - generic [ref=e198]: 3W
                  - button "b5, empty" [disabled] [ref=e199]
                  - button "3L, c5, triple letter, empty" [disabled] [ref=e200]:
                    - generic [ref=e201]: 3L
                  - button "d5, empty" [disabled] [ref=e202]
                  - button "e5, empty" [disabled] [ref=e203]
                  - button "f5, empty" [disabled] [ref=e204]
                  - button "2L, g5, double letter, empty" [disabled] [ref=e205]:
                    - generic [ref=e206]: 2L
                  - button "h5, empty" [disabled] [ref=e207]
                  - button "2L, i5, double letter, empty" [disabled] [ref=e208]:
                    - generic [ref=e209]: 2L
                  - button "j5, empty" [disabled] [ref=e210]
                  - button "k5, empty" [disabled] [ref=e211]
                  - button "l5, empty" [disabled] [ref=e212]
                  - button "3L, m5, triple letter, empty" [disabled] [ref=e213]:
                    - generic [ref=e214]: 3L
                  - button "n5, empty" [disabled] [ref=e215]
                  - button "3W, o5, triple word, empty" [disabled] [ref=e216]:
                    - generic [ref=e217]: 3W
                  - generic [ref=e218]: "6"
                  - button "a6, empty" [disabled] [ref=e219]
                  - button "b6, empty" [disabled] [ref=e220]
                  - button "c6, empty" [disabled] [ref=e221]
                  - button "d6, empty" [disabled] [ref=e222]
                  - button "e6, empty" [disabled] [ref=e223]
                  - button "f6, empty" [disabled] [ref=e224]
                  - button "g6, empty" [disabled] [ref=e225]
                  - button "3L, h6, triple letter, empty" [disabled] [ref=e226]:
                    - generic [ref=e227]: 3L
                  - button "i6, empty" [disabled] [ref=e228]
                  - button "j6, empty" [disabled] [ref=e229]
                  - button "k6, empty" [disabled] [ref=e230]
                  - button "l6, empty" [disabled] [ref=e231]
                  - button "m6, empty" [disabled] [ref=e232]
                  - button "n6, empty" [disabled] [ref=e233]
                  - button "o6, empty" [disabled] [ref=e234]
                  - generic [ref=e235]: "7"
                  - button "a7, empty" [disabled] [ref=e236]
                  - button "2W, b7, double word, empty" [disabled] [ref=e237]:
                    - generic [ref=e238]: 2W
                  - button "c7, empty" [disabled] [ref=e239]
                  - button "d7, empty" [disabled] [ref=e240]
                  - button "2L, e7, double letter, empty" [disabled] [ref=e241]:
                    - generic [ref=e242]: 2L
                  - button "f7, empty" [disabled] [ref=e243]
                  - button "2L, g7, double letter, empty" [disabled] [ref=e244]:
                    - generic [ref=e245]: 2L
                  - button "h7, empty" [disabled] [ref=e246]
                  - button "2L, i7, double letter, empty" [disabled] [ref=e247]:
                    - generic [ref=e248]: 2L
                  - button "j7, empty" [disabled] [ref=e249]
                  - button "2L, k7, double letter, empty" [disabled] [ref=e250]:
                    - generic [ref=e251]: 2L
                  - button "l7, empty" [disabled] [ref=e252]
                  - button "m7, empty" [disabled] [ref=e253]
                  - button "2W, n7, double word, empty" [disabled] [ref=e254]:
                    - generic [ref=e255]: 2W
                  - button "o7, empty" [disabled] [ref=e256]
                  - generic [ref=e257]: "8"
                  - button "2L, a8, double letter, empty" [disabled] [ref=e258]:
                    - generic [ref=e259]: 2L
                  - button "b8, empty" [disabled] [ref=e260]
                  - button "c8, empty" [disabled] [ref=e261]
                  - button "d8, empty" [disabled] [ref=e262]
                  - button "e8, empty" [disabled] [ref=e263]
                  - button "3L, f8, triple letter, empty" [disabled] [ref=e264]:
                    - generic [ref=e265]: 3L
                  - button "C 3, g8, committed" [disabled] [ref=e266]:
                    - generic [ref=e267]: C
                  - button "A 1, h8, committed" [disabled] [ref=e268]:
                    - generic [ref=e269]: A
                  - button "T 1, i8, committed" [disabled] [ref=e270]:
                    - generic [ref=e271]: T
                  - button "3L, j8, triple letter, empty" [disabled] [ref=e272]:
                    - generic [ref=e273]: 3L
                  - button "k8, empty" [disabled] [ref=e274]
                  - button "l8, empty" [disabled] [ref=e275]
                  - button "m8, empty" [disabled] [ref=e276]
                  - button "n8, empty" [disabled] [ref=e277]
                  - button "2L, o8, double letter, empty" [disabled] [ref=e278]:
                    - generic [ref=e279]: 2L
                  - generic [ref=e280]: "9"
                  - button "a9, empty" [disabled] [ref=e281]
                  - button "2W, b9, double word, empty" [disabled] [ref=e282]:
                    - generic [ref=e283]: 2W
                  - button "c9, empty" [disabled] [ref=e284]
                  - button "d9, empty" [disabled] [ref=e285]
                  - button "2L, e9, double letter, empty" [disabled] [ref=e286]:
                    - generic [ref=e287]: 2L
                  - button "f9, empty" [disabled] [ref=e288]
                  - button "2L, g9, double letter, empty" [disabled] [ref=e289]:
                    - generic [ref=e290]: 2L
                  - button "h9, empty" [disabled] [ref=e291]
                  - button "O 1, i9, committed" [disabled] [ref=e292]:
                    - generic [ref=e293]: O
                  - button "j9, empty" [disabled] [ref=e294]
                  - button "2L, k9, double letter, empty" [disabled] [ref=e295]:
                    - generic [ref=e296]: 2L
                  - button "l9, empty" [disabled] [ref=e297]
                  - button "m9, empty" [disabled] [ref=e298]
                  - button "2W, n9, double word, empty" [disabled] [ref=e299]:
                    - generic [ref=e300]: 2W
                  - button "o9, empty" [disabled] [ref=e301]
                  - generic [ref=e302]: "10"
                  - button "a10, empty" [disabled] [ref=e303]
                  - button "b10, empty" [disabled] [ref=e304]
                  - button "c10, empty" [disabled] [ref=e305]
                  - button "d10, empty" [disabled] [ref=e306]
                  - button "e10, empty" [disabled] [ref=e307]
                  - button "f10, empty" [disabled] [ref=e308]
                  - button "g10, empty" [disabled] [ref=e309]
                  - button "3L, h10, triple letter, empty" [disabled] [ref=e310]:
                    - generic [ref=e311]: 3L
                  - button "E 1, i10, committed" [disabled] [ref=e312]:
                    - generic [ref=e313]: E
                  - button "j10, empty" [disabled] [ref=e314]
                  - button "k10, empty" [disabled] [ref=e315]
                  - button "l10, empty" [disabled] [ref=e316]
                  - button "m10, empty" [disabled] [ref=e317]
                  - button "n10, empty" [disabled] [ref=e318]
                  - button "o10, empty" [disabled] [ref=e319]
                  - generic [ref=e320]: "11"
                  - button "3W, a11, triple word, empty" [disabled] [ref=e321]:
                    - generic [ref=e322]: 3W
                  - button "b11, empty" [disabled] [ref=e323]
                  - button "3L, c11, triple letter, empty" [disabled] [ref=e324]:
                    - generic [ref=e325]: 3L
                  - button "d11, empty" [disabled] [ref=e326]
                  - button "e11, empty" [disabled] [ref=e327]
                  - button "f11, empty" [disabled] [ref=e328]
                  - button "2L, g11, double letter, empty" [disabled] [ref=e329]:
                    - generic [ref=e330]: 2L
                  - button "h11, empty" [disabled] [ref=e331]
                  - button "2L, i11, double letter, empty" [disabled] [ref=e332]:
                    - generic [ref=e333]: 2L
                  - button "j11, empty" [disabled] [ref=e334]
                  - button "k11, empty" [disabled] [ref=e335]
                  - button "l11, empty" [disabled] [ref=e336]
                  - button "3L, m11, triple letter, empty" [disabled] [ref=e337]:
                    - generic [ref=e338]: 3L
                  - button "n11, empty" [disabled] [ref=e339]
                  - button "3W, o11, triple word, empty" [disabled] [ref=e340]:
                    - generic [ref=e341]: 3W
                  - generic [ref=e342]: "12"
                  - button "a12, empty" [disabled] [ref=e343]
                  - button "2L, b12, double letter, empty" [disabled] [ref=e344]:
                    - generic [ref=e345]: 2L
                  - button "c12, empty" [disabled] [ref=e346]
                  - button "2W, d12, double word, empty" [disabled] [ref=e347]:
                    - generic [ref=e348]: 2W
                  - button "e12, empty" [disabled] [ref=e349]
                  - button "f12, empty" [disabled] [ref=e350]
                  - button "g12, empty" [disabled] [ref=e351]
                  - button "h12, empty" [disabled] [ref=e352]
                  - button "i12, empty" [disabled] [ref=e353]
                  - button "j12, empty" [disabled] [ref=e354]
                  - button "k12, empty" [disabled] [ref=e355]
                  - button "2W, l12, double word, empty" [disabled] [ref=e356]:
                    - generic [ref=e357]: 2W
                  - button "m12, empty" [disabled] [ref=e358]
                  - button "2L, n12, double letter, empty" [disabled] [ref=e359]:
                    - generic [ref=e360]: 2L
                  - button "o12, empty" [disabled] [ref=e361]
                  - generic [ref=e362]: "13"
                  - button "a13, empty" [disabled] [ref=e363]
                  - button "b13, empty" [disabled] [ref=e364]
                  - button "c13, empty" [disabled] [ref=e365]
                  - button "d13, empty" [disabled] [ref=e366]
                  - button "3L, e13, triple letter, empty" [disabled] [ref=e367]:
                    - generic [ref=e368]: 3L
                  - button "f13, empty" [disabled] [ref=e369]
                  - button "g13, empty" [disabled] [ref=e370]
                  - button "h13, empty" [disabled] [ref=e371]
                  - button "i13, empty" [disabled] [ref=e372]
                  - button "j13, empty" [disabled] [ref=e373]
                  - button "3L, k13, triple letter, empty" [disabled] [ref=e374]:
                    - generic [ref=e375]: 3L
                  - button "l13, empty" [disabled] [ref=e376]
                  - button "m13, empty" [disabled] [ref=e377]
                  - button "n13, empty" [disabled] [ref=e378]
                  - button "o13, empty" [disabled] [ref=e379]
                  - generic [ref=e380]: "14"
                  - button "a14, empty" [disabled] [ref=e381]
                  - button "b14, empty" [disabled] [ref=e382]
                  - button "c14, empty" [disabled] [ref=e383]
                  - button "2L, d14, double letter, empty" [disabled] [ref=e384]:
                    - generic [ref=e385]: 2L
                  - button "e14, empty" [disabled] [ref=e386]
                  - button "f14, empty" [disabled] [ref=e387]
                  - button "2W, g14, double word, empty" [disabled] [ref=e388]:
                    - generic [ref=e389]: 2W
                  - button "h14, empty" [disabled] [ref=e390]
                  - button "2W, i14, double word, empty" [disabled] [ref=e391]:
                    - generic [ref=e392]: 2W
                  - button "j14, empty" [disabled] [ref=e393]
                  - button "k14, empty" [disabled] [ref=e394]
                  - button "2L, l14, double letter, empty" [disabled] [ref=e395]:
                    - generic [ref=e396]: 2L
                  - button "m14, empty" [disabled] [ref=e397]
                  - button "n14, empty" [disabled] [ref=e398]
                  - button "o14, empty" [disabled] [ref=e399]
                  - generic [ref=e400]: "15"
                  - button "2L, a15, double letter, empty" [disabled] [ref=e401]:
                    - generic [ref=e402]: 2L
                  - button "b15, empty" [disabled] [ref=e403]
                  - button "c15, empty" [disabled] [ref=e404]
                  - button "d15, empty" [disabled] [ref=e405]
                  - button "3W, e15, triple word, empty" [disabled] [ref=e406]:
                    - generic [ref=e407]: 3W
                  - button "f15, empty" [disabled] [ref=e408]
                  - button "g15, empty" [disabled] [ref=e409]
                  - button "2L, h15, double letter, empty" [disabled] [ref=e410]:
                    - generic [ref=e411]: 2L
                  - button "i15, empty" [disabled] [ref=e412]
                  - button "j15, empty" [disabled] [ref=e413]
                  - button "3W, k15, triple word, empty" [disabled] [ref=e414]:
                    - generic [ref=e415]: 3W
                  - button "l15, empty" [disabled] [ref=e416]
                  - button "m15, empty" [disabled] [ref=e417]
                  - button "n15, empty" [disabled] [ref=e418]
                  - button "2L, o15, double letter, empty" [disabled] [ref=e419]:
                    - generic [ref=e420]: 2L
          - status [ref=e422]:
            - generic [ref=e423]:
              - generic [ref=e424]: "Amber: avery. Teal: jordan_plays. Violet: morgan. Coral: robin_42."
              - text: Violet — to play · 67 tiles in the bag
        - button "History and stats" [ref=e428] [cursor=pointer]:
          - generic [ref=e430]:
            - paragraph [ref=e431]: History and stats
            - img [ref=e434]
      - generic [ref=e436]:
        - img [ref=e439]
        - generic [ref=e442]:
          - paragraph [ref=e443]: You're watching
          - paragraph [ref=e444]: Moves appear as they are played.
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