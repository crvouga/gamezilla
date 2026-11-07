# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--watching dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  69473 pixels (ratio 0.22 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/watching-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/watching-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 69473 pixels (ratio 0.22 of all image pixels) are different.
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
  - 69473 pixels (ratio 0.22 of all image pixels) are different.

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
        - paragraph [ref=e24]: Amber — to play · 81 tiles in the bag
        - generic [ref=e25]:
          - paragraph [ref=e30]: No moves yet.
          - button "All moves" [ref=e31] [cursor=pointer]:
            - img [ref=e35]
      - generic [ref=e37]:
        - generic [ref=e39]:
          - generic [ref=e41]:
            - generic [ref=e45]:
              - generic [ref=e46]:
                - img "Teal" [ref=e47]
                - generic "jordan_plays" [ref=e50]
              - generic [ref=e53]: 7 tiles
            - generic [ref=e54]:
              - generic [ref=e55]: Score
              - generic [ref=e56]: "3"
          - generic [ref=e58]:
            - paragraph [ref=e59]: You are watching. Racks stay private to their players.
            - generic [ref=e61]:
              - region "Scrollable word board" [ref=e62]:
                - group "Word board, fifteen columns and fifteen rows" [ref=e63]:
                  - generic [ref=e65]: a
                  - generic [ref=e66]: b
                  - generic [ref=e67]: c
                  - generic [ref=e68]: d
                  - generic [ref=e69]: e
                  - generic [ref=e70]: f
                  - generic [ref=e71]: g
                  - generic [ref=e72]: h
                  - generic [ref=e73]: i
                  - generic [ref=e74]: j
                  - generic [ref=e75]: k
                  - generic [ref=e76]: l
                  - generic [ref=e77]: m
                  - generic [ref=e78]: "n"
                  - generic [ref=e79]: o
                  - generic [ref=e80]: "1"
                  - button "2L, a1, double letter, empty" [disabled] [ref=e81]:
                    - generic [ref=e82]: 2L
                  - button "b1, empty" [disabled] [ref=e83]
                  - button "c1, empty" [disabled] [ref=e84]
                  - button "d1, empty" [disabled] [ref=e85]
                  - button "3W, e1, triple word, empty" [disabled] [ref=e86]:
                    - generic [ref=e87]: 3W
                  - button "f1, empty" [disabled] [ref=e88]
                  - button "g1, empty" [disabled] [ref=e89]
                  - button "2L, h1, double letter, empty" [disabled] [ref=e90]:
                    - generic [ref=e91]: 2L
                  - button "i1, empty" [disabled] [ref=e92]
                  - button "j1, empty" [disabled] [ref=e93]
                  - button "3W, k1, triple word, empty" [disabled] [ref=e94]:
                    - generic [ref=e95]: 3W
                  - button "l1, empty" [disabled] [ref=e96]
                  - button "m1, empty" [disabled] [ref=e97]
                  - button "n1, empty" [disabled] [ref=e98]
                  - button "2L, o1, double letter, empty" [disabled] [ref=e99]:
                    - generic [ref=e100]: 2L
                  - generic [ref=e101]: "2"
                  - button "a2, empty" [disabled] [ref=e102]
                  - button "b2, empty" [disabled] [ref=e103]
                  - button "c2, empty" [disabled] [ref=e104]
                  - button "2L, d2, double letter, empty" [disabled] [ref=e105]:
                    - generic [ref=e106]: 2L
                  - button "e2, empty" [disabled] [ref=e107]
                  - button "f2, empty" [disabled] [ref=e108]
                  - button "2W, g2, double word, empty" [disabled] [ref=e109]:
                    - generic [ref=e110]: 2W
                  - button "h2, empty" [disabled] [ref=e111]
                  - button "2W, i2, double word, empty" [disabled] [ref=e112]:
                    - generic [ref=e113]: 2W
                  - button "j2, empty" [disabled] [ref=e114]
                  - button "k2, empty" [disabled] [ref=e115]
                  - button "2L, l2, double letter, empty" [disabled] [ref=e116]:
                    - generic [ref=e117]: 2L
                  - button "m2, empty" [disabled] [ref=e118]
                  - button "n2, empty" [disabled] [ref=e119]
                  - button "o2, empty" [disabled] [ref=e120]
                  - generic [ref=e121]: "3"
                  - button "a3, empty" [disabled] [ref=e122]
                  - button "b3, empty" [disabled] [ref=e123]
                  - button "c3, empty" [disabled] [ref=e124]
                  - button "d3, empty" [disabled] [ref=e125]
                  - button "3L, e3, triple letter, empty" [disabled] [ref=e126]:
                    - generic [ref=e127]: 3L
                  - button "f3, empty" [disabled] [ref=e128]
                  - button "g3, empty" [disabled] [ref=e129]
                  - button "h3, empty" [disabled] [ref=e130]
                  - button "i3, empty" [disabled] [ref=e131]
                  - button "j3, empty" [disabled] [ref=e132]
                  - button "3L, k3, triple letter, empty" [disabled] [ref=e133]:
                    - generic [ref=e134]: 3L
                  - button "l3, empty" [disabled] [ref=e135]
                  - button "m3, empty" [disabled] [ref=e136]
                  - button "n3, empty" [disabled] [ref=e137]
                  - button "o3, empty" [disabled] [ref=e138]
                  - generic [ref=e139]: "4"
                  - button "a4, empty" [disabled] [ref=e140]
                  - button "2L, b4, double letter, empty" [disabled] [ref=e141]:
                    - generic [ref=e142]: 2L
                  - button "c4, empty" [disabled] [ref=e143]
                  - button "2W, d4, double word, empty" [disabled] [ref=e144]:
                    - generic [ref=e145]: 2W
                  - button "e4, empty" [disabled] [ref=e146]
                  - button "f4, empty" [disabled] [ref=e147]
                  - button "g4, empty" [disabled] [ref=e148]
                  - button "h4, empty" [disabled] [ref=e149]
                  - button "i4, empty" [disabled] [ref=e150]
                  - button "j4, empty" [disabled] [ref=e151]
                  - button "k4, empty" [disabled] [ref=e152]
                  - button "2W, l4, double word, empty" [disabled] [ref=e153]:
                    - generic [ref=e154]: 2W
                  - button "m4, empty" [disabled] [ref=e155]
                  - button "2L, n4, double letter, empty" [disabled] [ref=e156]:
                    - generic [ref=e157]: 2L
                  - button "o4, empty" [disabled] [ref=e158]
                  - generic [ref=e159]: "5"
                  - button "3W, a5, triple word, empty" [disabled] [ref=e160]:
                    - generic [ref=e161]: 3W
                  - button "b5, empty" [disabled] [ref=e162]
                  - button "3L, c5, triple letter, empty" [disabled] [ref=e163]:
                    - generic [ref=e164]: 3L
                  - button "d5, empty" [disabled] [ref=e165]
                  - button "e5, empty" [disabled] [ref=e166]
                  - button "f5, empty" [disabled] [ref=e167]
                  - button "2L, g5, double letter, empty" [disabled] [ref=e168]:
                    - generic [ref=e169]: 2L
                  - button "h5, empty" [disabled] [ref=e170]
                  - button "2L, i5, double letter, empty" [disabled] [ref=e171]:
                    - generic [ref=e172]: 2L
                  - button "j5, empty" [disabled] [ref=e173]
                  - button "k5, empty" [disabled] [ref=e174]
                  - button "l5, empty" [disabled] [ref=e175]
                  - button "3L, m5, triple letter, empty" [disabled] [ref=e176]:
                    - generic [ref=e177]: 3L
                  - button "n5, empty" [disabled] [ref=e178]
                  - button "3W, o5, triple word, empty" [disabled] [ref=e179]:
                    - generic [ref=e180]: 3W
                  - generic [ref=e181]: "6"
                  - button "a6, empty" [disabled] [ref=e182]
                  - button "b6, empty" [disabled] [ref=e183]
                  - button "c6, empty" [disabled] [ref=e184]
                  - button "d6, empty" [disabled] [ref=e185]
                  - button "e6, empty" [disabled] [ref=e186]
                  - button "f6, empty" [disabled] [ref=e187]
                  - button "g6, empty" [disabled] [ref=e188]
                  - button "3L, h6, triple letter, empty" [disabled] [ref=e189]:
                    - generic [ref=e190]: 3L
                  - button "i6, empty" [disabled] [ref=e191]
                  - button "j6, empty" [disabled] [ref=e192]
                  - button "k6, empty" [disabled] [ref=e193]
                  - button "l6, empty" [disabled] [ref=e194]
                  - button "m6, empty" [disabled] [ref=e195]
                  - button "n6, empty" [disabled] [ref=e196]
                  - button "o6, empty" [disabled] [ref=e197]
                  - generic [ref=e198]: "7"
                  - button "a7, empty" [disabled] [ref=e199]
                  - button "2W, b7, double word, empty" [disabled] [ref=e200]:
                    - generic [ref=e201]: 2W
                  - button "c7, empty" [disabled] [ref=e202]
                  - button "d7, empty" [disabled] [ref=e203]
                  - button "2L, e7, double letter, empty" [disabled] [ref=e204]:
                    - generic [ref=e205]: 2L
                  - button "f7, empty" [disabled] [ref=e206]
                  - button "2L, g7, double letter, empty" [disabled] [ref=e207]:
                    - generic [ref=e208]: 2L
                  - button "h7, empty" [disabled] [ref=e209]
                  - button "2L, i7, double letter, empty" [disabled] [ref=e210]:
                    - generic [ref=e211]: 2L
                  - button "j7, empty" [disabled] [ref=e212]
                  - button "2L, k7, double letter, empty" [disabled] [ref=e213]:
                    - generic [ref=e214]: 2L
                  - button "l7, empty" [disabled] [ref=e215]
                  - button "m7, empty" [disabled] [ref=e216]
                  - button "2W, n7, double word, empty" [disabled] [ref=e217]:
                    - generic [ref=e218]: 2W
                  - button "o7, empty" [disabled] [ref=e219]
                  - generic [ref=e220]: "8"
                  - button "2L, a8, double letter, empty" [disabled] [ref=e221]:
                    - generic [ref=e222]: 2L
                  - button "b8, empty" [disabled] [ref=e223]
                  - button "c8, empty" [disabled] [ref=e224]
                  - button "d8, empty" [disabled] [ref=e225]
                  - button "e8, empty" [disabled] [ref=e226]
                  - button "3L, f8, triple letter, empty" [disabled] [ref=e227]:
                    - generic [ref=e228]: 3L
                  - button "C 3, g8, committed" [disabled] [ref=e229]:
                    - generic [ref=e230]: C
                    - generic [ref=e231]: "3"
                  - button "A 1, h8, committed" [disabled] [ref=e232]:
                    - generic [ref=e233]: A
                    - generic [ref=e234]: "1"
                  - button "T 1, i8, committed" [disabled] [ref=e235]:
                    - generic [ref=e236]: T
                    - generic [ref=e237]: "1"
                  - button "3L, j8, triple letter, empty" [disabled] [ref=e238]:
                    - generic [ref=e239]: 3L
                  - button "k8, empty" [disabled] [ref=e240]
                  - button "l8, empty" [disabled] [ref=e241]
                  - button "m8, empty" [disabled] [ref=e242]
                  - button "n8, empty" [disabled] [ref=e243]
                  - button "2L, o8, double letter, empty" [disabled] [ref=e244]:
                    - generic [ref=e245]: 2L
                  - generic [ref=e246]: "9"
                  - button "a9, empty" [disabled] [ref=e247]
                  - button "2W, b9, double word, empty" [disabled] [ref=e248]:
                    - generic [ref=e249]: 2W
                  - button "c9, empty" [disabled] [ref=e250]
                  - button "d9, empty" [disabled] [ref=e251]
                  - button "2L, e9, double letter, empty" [disabled] [ref=e252]:
                    - generic [ref=e253]: 2L
                  - button "f9, empty" [disabled] [ref=e254]
                  - button "2L, g9, double letter, empty" [disabled] [ref=e255]:
                    - generic [ref=e256]: 2L
                  - button "h9, empty" [disabled] [ref=e257]
                  - button "O 1, i9, committed" [disabled] [ref=e258]:
                    - generic [ref=e259]: O
                    - generic [ref=e260]: "1"
                  - button "j9, empty" [disabled] [ref=e261]
                  - button "2L, k9, double letter, empty" [disabled] [ref=e262]:
                    - generic [ref=e263]: 2L
                  - button "l9, empty" [disabled] [ref=e264]
                  - button "m9, empty" [disabled] [ref=e265]
                  - button "2W, n9, double word, empty" [disabled] [ref=e266]:
                    - generic [ref=e267]: 2W
                  - button "o9, empty" [disabled] [ref=e268]
                  - generic [ref=e269]: "10"
                  - button "a10, empty" [disabled] [ref=e270]
                  - button "b10, empty" [disabled] [ref=e271]
                  - button "c10, empty" [disabled] [ref=e272]
                  - button "d10, empty" [disabled] [ref=e273]
                  - button "e10, empty" [disabled] [ref=e274]
                  - button "f10, empty" [disabled] [ref=e275]
                  - button "g10, empty" [disabled] [ref=e276]
                  - button "3L, h10, triple letter, empty" [disabled] [ref=e277]:
                    - generic [ref=e278]: 3L
                  - button "E 1, i10, committed" [disabled] [ref=e279]:
                    - generic [ref=e280]: E
                    - generic [ref=e281]: "1"
                  - button "j10, empty" [disabled] [ref=e282]
                  - button "k10, empty" [disabled] [ref=e283]
                  - button "l10, empty" [disabled] [ref=e284]
                  - button "m10, empty" [disabled] [ref=e285]
                  - button "n10, empty" [disabled] [ref=e286]
                  - button "o10, empty" [disabled] [ref=e287]
                  - generic [ref=e288]: "11"
                  - button "3W, a11, triple word, empty" [disabled] [ref=e289]:
                    - generic [ref=e290]: 3W
                  - button "b11, empty" [disabled] [ref=e291]
                  - button "3L, c11, triple letter, empty" [disabled] [ref=e292]:
                    - generic [ref=e293]: 3L
                  - button "d11, empty" [disabled] [ref=e294]
                  - button "e11, empty" [disabled] [ref=e295]
                  - button "f11, empty" [disabled] [ref=e296]
                  - button "2L, g11, double letter, empty" [disabled] [ref=e297]:
                    - generic [ref=e298]: 2L
                  - button "h11, empty" [disabled] [ref=e299]
                  - button "2L, i11, double letter, empty" [disabled] [ref=e300]:
                    - generic [ref=e301]: 2L
                  - button "j11, empty" [disabled] [ref=e302]
                  - button "k11, empty" [disabled] [ref=e303]
                  - button "l11, empty" [disabled] [ref=e304]
                  - button "3L, m11, triple letter, empty" [disabled] [ref=e305]:
                    - generic [ref=e306]: 3L
                  - button "n11, empty" [disabled] [ref=e307]
                  - button "3W, o11, triple word, empty" [disabled] [ref=e308]:
                    - generic [ref=e309]: 3W
                  - generic [ref=e310]: "12"
                  - button "a12, empty" [disabled] [ref=e311]
                  - button "2L, b12, double letter, empty" [disabled] [ref=e312]:
                    - generic [ref=e313]: 2L
                  - button "c12, empty" [disabled] [ref=e314]
                  - button "2W, d12, double word, empty" [disabled] [ref=e315]:
                    - generic [ref=e316]: 2W
                  - button "e12, empty" [disabled] [ref=e317]
                  - button "f12, empty" [disabled] [ref=e318]
                  - button "g12, empty" [disabled] [ref=e319]
                  - button "h12, empty" [disabled] [ref=e320]
                  - button "i12, empty" [disabled] [ref=e321]
                  - button "j12, empty" [disabled] [ref=e322]
                  - button "k12, empty" [disabled] [ref=e323]
                  - button "2W, l12, double word, empty" [disabled] [ref=e324]:
                    - generic [ref=e325]: 2W
                  - button "m12, empty" [disabled] [ref=e326]
                  - button "2L, n12, double letter, empty" [disabled] [ref=e327]:
                    - generic [ref=e328]: 2L
                  - button "o12, empty" [disabled] [ref=e329]
                  - generic [ref=e330]: "13"
                  - button "a13, empty" [disabled] [ref=e331]
                  - button "b13, empty" [disabled] [ref=e332]
                  - button "c13, empty" [disabled] [ref=e333]
                  - button "d13, empty" [disabled] [ref=e334]
                  - button "3L, e13, triple letter, empty" [disabled] [ref=e335]:
                    - generic [ref=e336]: 3L
                  - button "f13, empty" [disabled] [ref=e337]
                  - button "g13, empty" [disabled] [ref=e338]
                  - button "h13, empty" [disabled] [ref=e339]
                  - button "i13, empty" [disabled] [ref=e340]
                  - button "j13, empty" [disabled] [ref=e341]
                  - button "3L, k13, triple letter, empty" [disabled] [ref=e342]:
                    - generic [ref=e343]: 3L
                  - button "l13, empty" [disabled] [ref=e344]
                  - button "m13, empty" [disabled] [ref=e345]
                  - button "n13, empty" [disabled] [ref=e346]
                  - button "o13, empty" [disabled] [ref=e347]
                  - generic [ref=e348]: "14"
                  - button "a14, empty" [disabled] [ref=e349]
                  - button "b14, empty" [disabled] [ref=e350]
                  - button "c14, empty" [disabled] [ref=e351]
                  - button "2L, d14, double letter, empty" [disabled] [ref=e352]:
                    - generic [ref=e353]: 2L
                  - button "e14, empty" [disabled] [ref=e354]
                  - button "f14, empty" [disabled] [ref=e355]
                  - button "2W, g14, double word, empty" [disabled] [ref=e356]:
                    - generic [ref=e357]: 2W
                  - button "h14, empty" [disabled] [ref=e358]
                  - button "2W, i14, double word, empty" [disabled] [ref=e359]:
                    - generic [ref=e360]: 2W
                  - button "j14, empty" [disabled] [ref=e361]
                  - button "k14, empty" [disabled] [ref=e362]
                  - button "2L, l14, double letter, empty" [disabled] [ref=e363]:
                    - generic [ref=e364]: 2L
                  - button "m14, empty" [disabled] [ref=e365]
                  - button "n14, empty" [disabled] [ref=e366]
                  - button "o14, empty" [disabled] [ref=e367]
                  - generic [ref=e368]: "15"
                  - button "2L, a15, double letter, empty" [disabled] [ref=e369]:
                    - generic [ref=e370]: 2L
                  - button "b15, empty" [disabled] [ref=e371]
                  - button "c15, empty" [disabled] [ref=e372]
                  - button "d15, empty" [disabled] [ref=e373]
                  - button "3W, e15, triple word, empty" [disabled] [ref=e374]:
                    - generic [ref=e375]: 3W
                  - button "f15, empty" [disabled] [ref=e376]
                  - button "g15, empty" [disabled] [ref=e377]
                  - button "2L, h15, double letter, empty" [disabled] [ref=e378]:
                    - generic [ref=e379]: 2L
                  - button "i15, empty" [disabled] [ref=e380]
                  - button "j15, empty" [disabled] [ref=e381]
                  - button "3W, k15, triple word, empty" [disabled] [ref=e382]:
                    - generic [ref=e383]: 3W
                  - button "l15, empty" [disabled] [ref=e384]
                  - button "m15, empty" [disabled] [ref=e385]
                  - button "n15, empty" [disabled] [ref=e386]
                  - button "2L, o15, double letter, empty" [disabled] [ref=e387]:
                    - generic [ref=e388]: 2L
              - generic [ref=e389]:
                - generic [ref=e390]:
                  - img "Whole board overview; outline shows the enlarged area" [ref=e391]
                  - group "View a board region" [ref=e618]:
                    - button "View a1 to e5" [ref=e619] [cursor=pointer]
                    - button "View f1 to j5" [ref=e620] [cursor=pointer]
                    - button "View k1 to o5" [ref=e621] [cursor=pointer]
                    - button "View a6 to e10" [ref=e622] [cursor=pointer]
                    - button "View f6 to j10" [ref=e623] [cursor=pointer]
                    - button "View k6 to o10" [ref=e624] [cursor=pointer]
                    - button "View a11 to e15" [ref=e625] [cursor=pointer]
                    - button "View f11 to j15" [ref=e626] [cursor=pointer]
                    - button "View k11 to o15" [ref=e627] [cursor=pointer]
                - generic [ref=e628]:
                  - generic [ref=e629]:
                    - button "Fit board" [ref=e630] [cursor=pointer]:
                      - paragraph [ref=e633]: Fit board
                    - button "Enlarge board" [pressed] [ref=e634] [cursor=pointer]:
                      - paragraph [ref=e637]: Enlarge board
                  - paragraph [ref=e638]: A 1, h8, committed
                  - 'button "Board map: locate a square" [ref=e639] [cursor=pointer]': Map
          - status [ref=e641]:
            - generic [ref=e642]:
              - generic [ref=e643]: "Amber: avery. Teal: jordan_plays."
              - text: Amber — to play · 81 tiles in the bag
          - generic [ref=e646]:
            - generic [ref=e650]:
              - generic [ref=e651]:
                - img "Amber" [ref=e652]
                - generic "avery" [ref=e655]
                - generic [ref=e656]: To move
              - generic [ref=e659]: 7 tiles
            - generic [ref=e660]:
              - generic [ref=e661]: Score
              - generic [ref=e662]: "10"
        - button "History and stats" [ref=e666] [cursor=pointer]:
          - generic [ref=e668]:
            - paragraph [ref=e669]: History and stats
            - img [ref=e672]
      - generic [ref=e674]:
        - img [ref=e677]
        - generic [ref=e680]:
          - paragraph [ref=e681]: You're watching
          - paragraph [ref=e682]: Moves appear as they are played.
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