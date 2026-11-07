# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--game-over dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  67914 pixels (ratio 0.21 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/game-over-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/game-over-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 67914 pixels (ratio 0.21 of all image pixels) are different.
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
  - 67914 pixels (ratio 0.21 of all image pixels) are different.

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
        - heading "You win" [level=2] [ref=e25]
        - group "What next" [ref=e26]:
          - button "Rematch" [ref=e27] [cursor=pointer]:
            - paragraph [ref=e30]: Rematch
          - button "Change game" [ref=e31] [cursor=pointer]:
            - paragraph [ref=e34]: Change game
          - button "Review" [ref=e35] [cursor=pointer]:
            - paragraph [ref=e38]: Review
      - generic [ref=e41]:
        - paragraph [ref=e46]: No moves yet.
        - button "All moves" [ref=e47] [cursor=pointer]:
          - img [ref=e51]
      - generic [ref=e53]:
        - generic [ref=e55]:
          - generic [ref=e57]:
            - generic [ref=e61]:
              - generic [ref=e62]:
                - img "Teal" [ref=e63]
                - generic "jordan_plays" [ref=e66]
              - generic [ref=e69]: 2 tiles
            - generic [ref=e70]:
              - generic [ref=e71]: Score
              - generic [ref=e72]: "154"
          - generic [ref=e74]:
            - group "Your rack" [ref=e75]
            - generic [ref=e77]:
              - region "Scrollable word board" [ref=e78]:
                - group "Word board, fifteen columns and fifteen rows" [ref=e79]:
                  - generic [ref=e81]: a
                  - generic [ref=e82]: b
                  - generic [ref=e83]: c
                  - generic [ref=e84]: d
                  - generic [ref=e85]: e
                  - generic [ref=e86]: f
                  - generic [ref=e87]: g
                  - generic [ref=e88]: h
                  - generic [ref=e89]: i
                  - generic [ref=e90]: j
                  - generic [ref=e91]: k
                  - generic [ref=e92]: l
                  - generic [ref=e93]: m
                  - generic [ref=e94]: "n"
                  - generic [ref=e95]: o
                  - generic [ref=e96]: "1"
                  - button "2L, a1, double letter, empty" [disabled] [ref=e97]:
                    - generic [ref=e98]: 2L
                  - button "b1, empty" [disabled] [ref=e99]
                  - button "c1, empty" [disabled] [ref=e100]
                  - button "d1, empty" [disabled] [ref=e101]
                  - button "3W, e1, triple word, empty" [disabled] [ref=e102]:
                    - generic [ref=e103]: 3W
                  - button "f1, empty" [disabled] [ref=e104]
                  - button "g1, empty" [disabled] [ref=e105]
                  - button "2L, h1, double letter, empty" [disabled] [ref=e106]:
                    - generic [ref=e107]: 2L
                  - button "i1, empty" [disabled] [ref=e108]
                  - button "j1, empty" [disabled] [ref=e109]
                  - button "3W, k1, triple word, empty" [disabled] [ref=e110]:
                    - generic [ref=e111]: 3W
                  - button "l1, empty" [disabled] [ref=e112]
                  - button "m1, empty" [disabled] [ref=e113]
                  - button "n1, empty" [disabled] [ref=e114]
                  - button "2L, o1, double letter, empty" [disabled] [ref=e115]:
                    - generic [ref=e116]: 2L
                  - generic [ref=e117]: "2"
                  - button "a2, empty" [disabled] [ref=e118]
                  - button "b2, empty" [disabled] [ref=e119]
                  - button "c2, empty" [disabled] [ref=e120]
                  - button "2L, d2, double letter, empty" [disabled] [ref=e121]:
                    - generic [ref=e122]: 2L
                  - button "e2, empty" [disabled] [ref=e123]
                  - button "f2, empty" [disabled] [ref=e124]
                  - button "2W, g2, double word, empty" [disabled] [ref=e125]:
                    - generic [ref=e126]: 2W
                  - button "h2, empty" [disabled] [ref=e127]
                  - button "2W, i2, double word, empty" [disabled] [ref=e128]:
                    - generic [ref=e129]: 2W
                  - button "j2, empty" [disabled] [ref=e130]
                  - button "k2, empty" [disabled] [ref=e131]
                  - button "2L, l2, double letter, empty" [disabled] [ref=e132]:
                    - generic [ref=e133]: 2L
                  - button "m2, empty" [disabled] [ref=e134]
                  - button "n2, empty" [disabled] [ref=e135]
                  - button "o2, empty" [disabled] [ref=e136]
                  - generic [ref=e137]: "3"
                  - button "a3, empty" [disabled] [ref=e138]
                  - button "b3, empty" [disabled] [ref=e139]
                  - button "c3, empty" [disabled] [ref=e140]
                  - button "d3, empty" [disabled] [ref=e141]
                  - button "3L, e3, triple letter, empty" [disabled] [ref=e142]:
                    - generic [ref=e143]: 3L
                  - button "f3, empty" [disabled] [ref=e144]
                  - button "g3, empty" [disabled] [ref=e145]
                  - button "h3, empty" [disabled] [ref=e146]
                  - button "i3, empty" [disabled] [ref=e147]
                  - button "j3, empty" [disabled] [ref=e148]
                  - button "3L, k3, triple letter, empty" [disabled] [ref=e149]:
                    - generic [ref=e150]: 3L
                  - button "l3, empty" [disabled] [ref=e151]
                  - button "m3, empty" [disabled] [ref=e152]
                  - button "n3, empty" [disabled] [ref=e153]
                  - button "o3, empty" [disabled] [ref=e154]
                  - generic [ref=e155]: "4"
                  - button "a4, empty" [disabled] [ref=e156]
                  - button "2L, b4, double letter, empty" [disabled] [ref=e157]:
                    - generic [ref=e158]: 2L
                  - button "c4, empty" [disabled] [ref=e159]
                  - button "2W, d4, double word, empty" [disabled] [ref=e160]:
                    - generic [ref=e161]: 2W
                  - button "e4, empty" [disabled] [ref=e162]
                  - button "f4, empty" [disabled] [ref=e163]
                  - button "g4, empty" [disabled] [ref=e164]
                  - button "h4, empty" [disabled] [ref=e165]
                  - button "i4, empty" [disabled] [ref=e166]
                  - button "j4, empty" [disabled] [ref=e167]
                  - button "k4, empty" [disabled] [ref=e168]
                  - button "2W, l4, double word, empty" [disabled] [ref=e169]:
                    - generic [ref=e170]: 2W
                  - button "m4, empty" [disabled] [ref=e171]
                  - button "2L, n4, double letter, empty" [disabled] [ref=e172]:
                    - generic [ref=e173]: 2L
                  - button "o4, empty" [disabled] [ref=e174]
                  - generic [ref=e175]: "5"
                  - button "3W, a5, triple word, empty" [disabled] [ref=e176]:
                    - generic [ref=e177]: 3W
                  - button "b5, empty" [disabled] [ref=e178]
                  - button "3L, c5, triple letter, empty" [disabled] [ref=e179]:
                    - generic [ref=e180]: 3L
                  - button "d5, empty" [disabled] [ref=e181]
                  - button "e5, empty" [disabled] [ref=e182]
                  - button "f5, empty" [disabled] [ref=e183]
                  - button "2L, g5, double letter, empty" [disabled] [ref=e184]:
                    - generic [ref=e185]: 2L
                  - button "h5, empty" [disabled] [ref=e186]
                  - button "2L, i5, double letter, empty" [disabled] [ref=e187]:
                    - generic [ref=e188]: 2L
                  - button "j5, empty" [disabled] [ref=e189]
                  - button "k5, empty" [disabled] [ref=e190]
                  - button "l5, empty" [disabled] [ref=e191]
                  - button "3L, m5, triple letter, empty" [disabled] [ref=e192]:
                    - generic [ref=e193]: 3L
                  - button "n5, empty" [disabled] [ref=e194]
                  - button "3W, o5, triple word, empty" [disabled] [ref=e195]:
                    - generic [ref=e196]: 3W
                  - generic [ref=e197]: "6"
                  - button "a6, empty" [disabled] [ref=e198]
                  - button "b6, empty" [disabled] [ref=e199]
                  - button "c6, empty" [disabled] [ref=e200]
                  - button "d6, empty" [disabled] [ref=e201]
                  - button "e6, empty" [disabled] [ref=e202]
                  - button "f6, empty" [disabled] [ref=e203]
                  - button "g6, empty" [disabled] [ref=e204]
                  - button "3L, h6, triple letter, empty" [disabled] [ref=e205]:
                    - generic [ref=e206]: 3L
                  - button "i6, empty" [disabled] [ref=e207]
                  - button "j6, empty" [disabled] [ref=e208]
                  - button "k6, empty" [disabled] [ref=e209]
                  - button "l6, empty" [disabled] [ref=e210]
                  - button "m6, empty" [disabled] [ref=e211]
                  - button "n6, empty" [disabled] [ref=e212]
                  - button "o6, empty" [disabled] [ref=e213]
                  - generic [ref=e214]: "7"
                  - button "a7, empty" [disabled] [ref=e215]
                  - button "2W, b7, double word, empty" [disabled] [ref=e216]:
                    - generic [ref=e217]: 2W
                  - button "c7, empty" [disabled] [ref=e218]
                  - button "d7, empty" [disabled] [ref=e219]
                  - button "2L, e7, double letter, empty" [disabled] [ref=e220]:
                    - generic [ref=e221]: 2L
                  - button "f7, empty" [disabled] [ref=e222]
                  - button "2L, g7, double letter, empty" [disabled] [ref=e223]:
                    - generic [ref=e224]: 2L
                  - button "h7, empty" [disabled] [ref=e225]
                  - button "2L, i7, double letter, empty" [disabled] [ref=e226]:
                    - generic [ref=e227]: 2L
                  - button "j7, empty" [disabled] [ref=e228]
                  - button "2L, k7, double letter, empty" [disabled] [ref=e229]:
                    - generic [ref=e230]: 2L
                  - button "l7, empty" [disabled] [ref=e231]
                  - button "m7, empty" [disabled] [ref=e232]
                  - button "2W, n7, double word, empty" [disabled] [ref=e233]:
                    - generic [ref=e234]: 2W
                  - button "o7, empty" [disabled] [ref=e235]
                  - generic [ref=e236]: "8"
                  - button "2L, a8, double letter, empty" [disabled] [ref=e237]:
                    - generic [ref=e238]: 2L
                  - button "b8, empty" [disabled] [ref=e239]
                  - button "c8, empty" [disabled] [ref=e240]
                  - button "d8, empty" [disabled] [ref=e241]
                  - button "e8, empty" [disabled] [ref=e242]
                  - button "3L, f8, triple letter, empty" [disabled] [ref=e243]:
                    - generic [ref=e244]: 3L
                  - button "C 3, g8, committed" [disabled] [ref=e245]:
                    - generic [ref=e246]: C
                    - generic [ref=e247]: "3"
                  - button "A 1, h8, committed" [disabled] [ref=e248]:
                    - generic [ref=e249]: A
                    - generic [ref=e250]: "1"
                  - button "T 1, i8, committed" [disabled] [ref=e251]:
                    - generic [ref=e252]: T
                    - generic [ref=e253]: "1"
                  - button "3L, j8, triple letter, empty" [disabled] [ref=e254]:
                    - generic [ref=e255]: 3L
                  - button "k8, empty" [disabled] [ref=e256]
                  - button "l8, empty" [disabled] [ref=e257]
                  - button "m8, empty" [disabled] [ref=e258]
                  - button "n8, empty" [disabled] [ref=e259]
                  - button "2L, o8, double letter, empty" [disabled] [ref=e260]:
                    - generic [ref=e261]: 2L
                  - generic [ref=e262]: "9"
                  - button "a9, empty" [disabled] [ref=e263]
                  - button "2W, b9, double word, empty" [disabled] [ref=e264]:
                    - generic [ref=e265]: 2W
                  - button "c9, empty" [disabled] [ref=e266]
                  - button "d9, empty" [disabled] [ref=e267]
                  - button "2L, e9, double letter, empty" [disabled] [ref=e268]:
                    - generic [ref=e269]: 2L
                  - button "f9, empty" [disabled] [ref=e270]
                  - button "2L, g9, double letter, empty" [disabled] [ref=e271]:
                    - generic [ref=e272]: 2L
                  - button "h9, empty" [disabled] [ref=e273]
                  - button "O 1, i9, committed" [disabled] [ref=e274]:
                    - generic [ref=e275]: O
                    - generic [ref=e276]: "1"
                  - button "j9, empty" [disabled] [ref=e277]
                  - button "2L, k9, double letter, empty" [disabled] [ref=e278]:
                    - generic [ref=e279]: 2L
                  - button "l9, empty" [disabled] [ref=e280]
                  - button "m9, empty" [disabled] [ref=e281]
                  - button "2W, n9, double word, empty" [disabled] [ref=e282]:
                    - generic [ref=e283]: 2W
                  - button "o9, empty" [disabled] [ref=e284]
                  - generic [ref=e285]: "10"
                  - button "a10, empty" [disabled] [ref=e286]
                  - button "b10, empty" [disabled] [ref=e287]
                  - button "c10, empty" [disabled] [ref=e288]
                  - button "d10, empty" [disabled] [ref=e289]
                  - button "e10, empty" [disabled] [ref=e290]
                  - button "f10, empty" [disabled] [ref=e291]
                  - button "g10, empty" [disabled] [ref=e292]
                  - button "3L, h10, triple letter, empty" [disabled] [ref=e293]:
                    - generic [ref=e294]: 3L
                  - button "E 1, i10, committed" [disabled] [ref=e295]:
                    - generic [ref=e296]: E
                    - generic [ref=e297]: "1"
                  - button "j10, empty" [disabled] [ref=e298]
                  - button "k10, empty" [disabled] [ref=e299]
                  - button "l10, empty" [disabled] [ref=e300]
                  - button "m10, empty" [disabled] [ref=e301]
                  - button "n10, empty" [disabled] [ref=e302]
                  - button "o10, empty" [disabled] [ref=e303]
                  - generic [ref=e304]: "11"
                  - button "3W, a11, triple word, empty" [disabled] [ref=e305]:
                    - generic [ref=e306]: 3W
                  - button "b11, empty" [disabled] [ref=e307]
                  - button "3L, c11, triple letter, empty" [disabled] [ref=e308]:
                    - generic [ref=e309]: 3L
                  - button "d11, empty" [disabled] [ref=e310]
                  - button "e11, empty" [disabled] [ref=e311]
                  - button "f11, empty" [disabled] [ref=e312]
                  - button "2L, g11, double letter, empty" [disabled] [ref=e313]:
                    - generic [ref=e314]: 2L
                  - button "h11, empty" [disabled] [ref=e315]
                  - button "2L, i11, double letter, empty" [disabled] [ref=e316]:
                    - generic [ref=e317]: 2L
                  - button "j11, empty" [disabled] [ref=e318]
                  - button "k11, empty" [disabled] [ref=e319]
                  - button "l11, empty" [disabled] [ref=e320]
                  - button "3L, m11, triple letter, empty" [disabled] [ref=e321]:
                    - generic [ref=e322]: 3L
                  - button "n11, empty" [disabled] [ref=e323]
                  - button "3W, o11, triple word, empty" [disabled] [ref=e324]:
                    - generic [ref=e325]: 3W
                  - generic [ref=e326]: "12"
                  - button "a12, empty" [disabled] [ref=e327]
                  - button "2L, b12, double letter, empty" [disabled] [ref=e328]:
                    - generic [ref=e329]: 2L
                  - button "c12, empty" [disabled] [ref=e330]
                  - button "2W, d12, double word, empty" [disabled] [ref=e331]:
                    - generic [ref=e332]: 2W
                  - button "e12, empty" [disabled] [ref=e333]
                  - button "f12, empty" [disabled] [ref=e334]
                  - button "g12, empty" [disabled] [ref=e335]
                  - button "h12, empty" [disabled] [ref=e336]
                  - button "i12, empty" [disabled] [ref=e337]
                  - button "j12, empty" [disabled] [ref=e338]
                  - button "k12, empty" [disabled] [ref=e339]
                  - button "2W, l12, double word, empty" [disabled] [ref=e340]:
                    - generic [ref=e341]: 2W
                  - button "m12, empty" [disabled] [ref=e342]
                  - button "2L, n12, double letter, empty" [disabled] [ref=e343]:
                    - generic [ref=e344]: 2L
                  - button "o12, empty" [disabled] [ref=e345]
                  - generic [ref=e346]: "13"
                  - button "a13, empty" [disabled] [ref=e347]
                  - button "b13, empty" [disabled] [ref=e348]
                  - button "c13, empty" [disabled] [ref=e349]
                  - button "d13, empty" [disabled] [ref=e350]
                  - button "3L, e13, triple letter, empty" [disabled] [ref=e351]:
                    - generic [ref=e352]: 3L
                  - button "f13, empty" [disabled] [ref=e353]
                  - button "g13, empty" [disabled] [ref=e354]
                  - button "h13, empty" [disabled] [ref=e355]
                  - button "i13, empty" [disabled] [ref=e356]
                  - button "j13, empty" [disabled] [ref=e357]
                  - button "3L, k13, triple letter, empty" [disabled] [ref=e358]:
                    - generic [ref=e359]: 3L
                  - button "l13, empty" [disabled] [ref=e360]
                  - button "m13, empty" [disabled] [ref=e361]
                  - button "n13, empty" [disabled] [ref=e362]
                  - button "o13, empty" [disabled] [ref=e363]
                  - generic [ref=e364]: "14"
                  - button "a14, empty" [disabled] [ref=e365]
                  - button "b14, empty" [disabled] [ref=e366]
                  - button "c14, empty" [disabled] [ref=e367]
                  - button "2L, d14, double letter, empty" [disabled] [ref=e368]:
                    - generic [ref=e369]: 2L
                  - button "e14, empty" [disabled] [ref=e370]
                  - button "f14, empty" [disabled] [ref=e371]
                  - button "2W, g14, double word, empty" [disabled] [ref=e372]:
                    - generic [ref=e373]: 2W
                  - button "h14, empty" [disabled] [ref=e374]
                  - button "2W, i14, double word, empty" [disabled] [ref=e375]:
                    - generic [ref=e376]: 2W
                  - button "j14, empty" [disabled] [ref=e377]
                  - button "k14, empty" [disabled] [ref=e378]
                  - button "2L, l14, double letter, empty" [disabled] [ref=e379]:
                    - generic [ref=e380]: 2L
                  - button "m14, empty" [disabled] [ref=e381]
                  - button "n14, empty" [disabled] [ref=e382]
                  - button "o14, empty" [disabled] [ref=e383]
                  - generic [ref=e384]: "15"
                  - button "2L, a15, double letter, empty" [disabled] [ref=e385]:
                    - generic [ref=e386]: 2L
                  - button "b15, empty" [disabled] [ref=e387]
                  - button "c15, empty" [disabled] [ref=e388]
                  - button "d15, empty" [disabled] [ref=e389]
                  - button "3W, e15, triple word, empty" [disabled] [ref=e390]:
                    - generic [ref=e391]: 3W
                  - button "f15, empty" [disabled] [ref=e392]
                  - button "g15, empty" [disabled] [ref=e393]
                  - button "2L, h15, double letter, empty" [disabled] [ref=e394]:
                    - generic [ref=e395]: 2L
                  - button "i15, empty" [disabled] [ref=e396]
                  - button "j15, empty" [disabled] [ref=e397]
                  - button "3W, k15, triple word, empty" [disabled] [ref=e398]:
                    - generic [ref=e399]: 3W
                  - button "l15, empty" [disabled] [ref=e400]
                  - button "m15, empty" [disabled] [ref=e401]
                  - button "n15, empty" [disabled] [ref=e402]
                  - button "2L, o15, double letter, empty" [disabled] [ref=e403]:
                    - generic [ref=e404]: 2L
              - generic [ref=e405]:
                - generic [ref=e406]:
                  - img "Whole board overview; outline shows the enlarged area" [ref=e407]
                  - group "View a board region" [ref=e634]:
                    - button "View a1 to e5" [ref=e635] [cursor=pointer]
                    - button "View f1 to j5" [ref=e636] [cursor=pointer]
                    - button "View k1 to o5" [ref=e637] [cursor=pointer]
                    - button "View a6 to e10" [ref=e638] [cursor=pointer]
                    - button "View f6 to j10" [ref=e639] [cursor=pointer]
                    - button "View k6 to o10" [ref=e640] [cursor=pointer]
                    - button "View a11 to e15" [ref=e641] [cursor=pointer]
                    - button "View f11 to j15" [ref=e642] [cursor=pointer]
                    - button "View k11 to o15" [ref=e643] [cursor=pointer]
                - generic [ref=e644]:
                  - generic [ref=e645]:
                    - button "Fit board" [ref=e646] [cursor=pointer]:
                      - paragraph [ref=e649]: Fit board
                    - button "Enlarge board" [pressed] [ref=e650] [cursor=pointer]:
                      - paragraph [ref=e653]: Enlarge board
                  - paragraph [ref=e654]: A 1, h8, committed
                  - 'button "Board map: locate a square" [ref=e655] [cursor=pointer]': Map
          - status [ref=e657]:
            - generic [ref=e658]:
              - generic [ref=e659]: "Amber: avery. Teal: jordan_plays."
              - text: A player used their last tile with the bag empty. Everyone else's tiles count against them and go to that player.
          - generic [ref=e662]:
            - generic [ref=e666]:
              - generic [ref=e667]:
                - img "Amber" [ref=e668]
                - generic "avery" [ref=e671]
              - generic [ref=e674]: 0 tiles
            - generic [ref=e675]:
              - generic [ref=e676]: Score
              - generic [ref=e677]: "187"
        - generic [ref=e678]:
          - list "Standings" [ref=e680]:
            - listitem [ref=e681]:
              - generic [ref=e682]:
                - generic [ref=e683]: 1st
                - generic [ref=e686]: avery
                - generic [ref=e687]:
                  - generic [ref=e688]: Score
                  - text: "187"
            - listitem [ref=e689]:
              - generic [ref=e690]:
                - generic [ref=e691]: 2nd
                - generic [ref=e694]: jordan_plays
                - generic [ref=e695]:
                  - generic [ref=e696]: Score
                  - text: "154"
          - button "History and stats" [ref=e699] [cursor=pointer]:
            - generic [ref=e701]:
              - paragraph [ref=e702]: History and stats
              - img [ref=e705]
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