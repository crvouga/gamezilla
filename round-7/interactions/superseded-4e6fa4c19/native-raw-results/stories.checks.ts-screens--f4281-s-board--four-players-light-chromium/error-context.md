# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--four-players light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  115332 pixels (ratio 0.36 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/four-players-light.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/four-players-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 115332 pixels (ratio 0.36 of all image pixels) are different.
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
  - 115332 pixels (ratio 0.36 of all image pixels) are different.

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
            - generic [ref=e89]:
              - region "Scrollable word board" [ref=e90]:
                - group "Word board, fifteen columns and fifteen rows" [ref=e91]:
                  - generic [ref=e93]: a
                  - generic [ref=e94]: b
                  - generic [ref=e95]: c
                  - generic [ref=e96]: d
                  - generic [ref=e97]: e
                  - generic [ref=e98]: f
                  - generic [ref=e99]: g
                  - generic [ref=e100]: h
                  - generic [ref=e101]: i
                  - generic [ref=e102]: j
                  - generic [ref=e103]: k
                  - generic [ref=e104]: l
                  - generic [ref=e105]: m
                  - generic [ref=e106]: "n"
                  - generic [ref=e107]: o
                  - generic [ref=e108]: "1"
                  - button "2L, a1, double letter, empty" [disabled] [ref=e109]:
                    - generic [ref=e110]: 2L
                  - button "b1, empty" [disabled] [ref=e111]
                  - button "c1, empty" [disabled] [ref=e112]
                  - button "d1, empty" [disabled] [ref=e113]
                  - button "3W, e1, triple word, empty" [disabled] [ref=e114]:
                    - generic [ref=e115]: 3W
                  - button "f1, empty" [disabled] [ref=e116]
                  - button "g1, empty" [disabled] [ref=e117]
                  - button "2L, h1, double letter, empty" [disabled] [ref=e118]:
                    - generic [ref=e119]: 2L
                  - button "i1, empty" [disabled] [ref=e120]
                  - button "j1, empty" [disabled] [ref=e121]
                  - button "3W, k1, triple word, empty" [disabled] [ref=e122]:
                    - generic [ref=e123]: 3W
                  - button "l1, empty" [disabled] [ref=e124]
                  - button "m1, empty" [disabled] [ref=e125]
                  - button "n1, empty" [disabled] [ref=e126]
                  - button "2L, o1, double letter, empty" [disabled] [ref=e127]:
                    - generic [ref=e128]: 2L
                  - generic [ref=e129]: "2"
                  - button "a2, empty" [disabled] [ref=e130]
                  - button "b2, empty" [disabled] [ref=e131]
                  - button "c2, empty" [disabled] [ref=e132]
                  - button "2L, d2, double letter, empty" [disabled] [ref=e133]:
                    - generic [ref=e134]: 2L
                  - button "e2, empty" [disabled] [ref=e135]
                  - button "f2, empty" [disabled] [ref=e136]
                  - button "2W, g2, double word, empty" [disabled] [ref=e137]:
                    - generic [ref=e138]: 2W
                  - button "h2, empty" [disabled] [ref=e139]
                  - button "2W, i2, double word, empty" [disabled] [ref=e140]:
                    - generic [ref=e141]: 2W
                  - button "j2, empty" [disabled] [ref=e142]
                  - button "k2, empty" [disabled] [ref=e143]
                  - button "2L, l2, double letter, empty" [disabled] [ref=e144]:
                    - generic [ref=e145]: 2L
                  - button "m2, empty" [disabled] [ref=e146]
                  - button "n2, empty" [disabled] [ref=e147]
                  - button "o2, empty" [disabled] [ref=e148]
                  - generic [ref=e149]: "3"
                  - button "a3, empty" [disabled] [ref=e150]
                  - button "b3, empty" [disabled] [ref=e151]
                  - button "c3, empty" [disabled] [ref=e152]
                  - button "d3, empty" [disabled] [ref=e153]
                  - button "3L, e3, triple letter, empty" [disabled] [ref=e154]:
                    - generic [ref=e155]: 3L
                  - button "f3, empty" [disabled] [ref=e156]
                  - button "g3, empty" [disabled] [ref=e157]
                  - button "h3, empty" [disabled] [ref=e158]
                  - button "i3, empty" [disabled] [ref=e159]
                  - button "j3, empty" [disabled] [ref=e160]
                  - button "3L, k3, triple letter, empty" [disabled] [ref=e161]:
                    - generic [ref=e162]: 3L
                  - button "l3, empty" [disabled] [ref=e163]
                  - button "m3, empty" [disabled] [ref=e164]
                  - button "n3, empty" [disabled] [ref=e165]
                  - button "o3, empty" [disabled] [ref=e166]
                  - generic [ref=e167]: "4"
                  - button "a4, empty" [disabled] [ref=e168]
                  - button "2L, b4, double letter, empty" [disabled] [ref=e169]:
                    - generic [ref=e170]: 2L
                  - button "c4, empty" [disabled] [ref=e171]
                  - button "2W, d4, double word, empty" [disabled] [ref=e172]:
                    - generic [ref=e173]: 2W
                  - button "e4, empty" [disabled] [ref=e174]
                  - button "f4, empty" [disabled] [ref=e175]
                  - button "g4, empty" [disabled] [ref=e176]
                  - button "h4, empty" [disabled] [ref=e177]
                  - button "i4, empty" [disabled] [ref=e178]
                  - button "j4, empty" [disabled] [ref=e179]
                  - button "k4, empty" [disabled] [ref=e180]
                  - button "2W, l4, double word, empty" [disabled] [ref=e181]:
                    - generic [ref=e182]: 2W
                  - button "m4, empty" [disabled] [ref=e183]
                  - button "2L, n4, double letter, empty" [disabled] [ref=e184]:
                    - generic [ref=e185]: 2L
                  - button "o4, empty" [disabled] [ref=e186]
                  - generic [ref=e187]: "5"
                  - button "3W, a5, triple word, empty" [disabled] [ref=e188]:
                    - generic [ref=e189]: 3W
                  - button "b5, empty" [disabled] [ref=e190]
                  - button "3L, c5, triple letter, empty" [disabled] [ref=e191]:
                    - generic [ref=e192]: 3L
                  - button "d5, empty" [disabled] [ref=e193]
                  - button "e5, empty" [disabled] [ref=e194]
                  - button "f5, empty" [disabled] [ref=e195]
                  - button "2L, g5, double letter, empty" [disabled] [ref=e196]:
                    - generic [ref=e197]: 2L
                  - button "h5, empty" [disabled] [ref=e198]
                  - button "2L, i5, double letter, empty" [disabled] [ref=e199]:
                    - generic [ref=e200]: 2L
                  - button "j5, empty" [disabled] [ref=e201]
                  - button "k5, empty" [disabled] [ref=e202]
                  - button "l5, empty" [disabled] [ref=e203]
                  - button "3L, m5, triple letter, empty" [disabled] [ref=e204]:
                    - generic [ref=e205]: 3L
                  - button "n5, empty" [disabled] [ref=e206]
                  - button "3W, o5, triple word, empty" [disabled] [ref=e207]:
                    - generic [ref=e208]: 3W
                  - generic [ref=e209]: "6"
                  - button "a6, empty" [disabled] [ref=e210]
                  - button "b6, empty" [disabled] [ref=e211]
                  - button "c6, empty" [disabled] [ref=e212]
                  - button "d6, empty" [disabled] [ref=e213]
                  - button "e6, empty" [disabled] [ref=e214]
                  - button "f6, empty" [disabled] [ref=e215]
                  - button "g6, empty" [disabled] [ref=e216]
                  - button "3L, h6, triple letter, empty" [disabled] [ref=e217]:
                    - generic [ref=e218]: 3L
                  - button "i6, empty" [disabled] [ref=e219]
                  - button "j6, empty" [disabled] [ref=e220]
                  - button "k6, empty" [disabled] [ref=e221]
                  - button "l6, empty" [disabled] [ref=e222]
                  - button "m6, empty" [disabled] [ref=e223]
                  - button "n6, empty" [disabled] [ref=e224]
                  - button "o6, empty" [disabled] [ref=e225]
                  - generic [ref=e226]: "7"
                  - button "a7, empty" [disabled] [ref=e227]
                  - button "2W, b7, double word, empty" [disabled] [ref=e228]:
                    - generic [ref=e229]: 2W
                  - button "c7, empty" [disabled] [ref=e230]
                  - button "d7, empty" [disabled] [ref=e231]
                  - button "2L, e7, double letter, empty" [disabled] [ref=e232]:
                    - generic [ref=e233]: 2L
                  - button "f7, empty" [disabled] [ref=e234]
                  - button "2L, g7, double letter, empty" [disabled] [ref=e235]:
                    - generic [ref=e236]: 2L
                  - button "h7, empty" [disabled] [ref=e237]
                  - button "2L, i7, double letter, empty" [disabled] [ref=e238]:
                    - generic [ref=e239]: 2L
                  - button "j7, empty" [disabled] [ref=e240]
                  - button "2L, k7, double letter, empty" [disabled] [ref=e241]:
                    - generic [ref=e242]: 2L
                  - button "l7, empty" [disabled] [ref=e243]
                  - button "m7, empty" [disabled] [ref=e244]
                  - button "2W, n7, double word, empty" [disabled] [ref=e245]:
                    - generic [ref=e246]: 2W
                  - button "o7, empty" [disabled] [ref=e247]
                  - generic [ref=e248]: "8"
                  - button "2L, a8, double letter, empty" [disabled] [ref=e249]:
                    - generic [ref=e250]: 2L
                  - button "b8, empty" [disabled] [ref=e251]
                  - button "c8, empty" [disabled] [ref=e252]
                  - button "d8, empty" [disabled] [ref=e253]
                  - button "e8, empty" [disabled] [ref=e254]
                  - button "3L, f8, triple letter, empty" [disabled] [ref=e255]:
                    - generic [ref=e256]: 3L
                  - button "C 3, g8, committed" [disabled] [ref=e257]:
                    - generic [ref=e258]: C
                    - generic [ref=e259]: "3"
                  - button "A 1, h8, committed" [disabled] [ref=e260]:
                    - generic [ref=e261]: A
                    - generic [ref=e262]: "1"
                  - button "T 1, i8, committed" [disabled] [ref=e263]:
                    - generic [ref=e264]: T
                    - generic [ref=e265]: "1"
                  - button "3L, j8, triple letter, empty" [disabled] [ref=e266]:
                    - generic [ref=e267]: 3L
                  - button "k8, empty" [disabled] [ref=e268]
                  - button "l8, empty" [disabled] [ref=e269]
                  - button "m8, empty" [disabled] [ref=e270]
                  - button "n8, empty" [disabled] [ref=e271]
                  - button "2L, o8, double letter, empty" [disabled] [ref=e272]:
                    - generic [ref=e273]: 2L
                  - generic [ref=e274]: "9"
                  - button "a9, empty" [disabled] [ref=e275]
                  - button "2W, b9, double word, empty" [disabled] [ref=e276]:
                    - generic [ref=e277]: 2W
                  - button "c9, empty" [disabled] [ref=e278]
                  - button "d9, empty" [disabled] [ref=e279]
                  - button "2L, e9, double letter, empty" [disabled] [ref=e280]:
                    - generic [ref=e281]: 2L
                  - button "f9, empty" [disabled] [ref=e282]
                  - button "2L, g9, double letter, empty" [disabled] [ref=e283]:
                    - generic [ref=e284]: 2L
                  - button "h9, empty" [disabled] [ref=e285]
                  - button "O 1, i9, committed" [disabled] [ref=e286]:
                    - generic [ref=e287]: O
                    - generic [ref=e288]: "1"
                  - button "j9, empty" [disabled] [ref=e289]
                  - button "2L, k9, double letter, empty" [disabled] [ref=e290]:
                    - generic [ref=e291]: 2L
                  - button "l9, empty" [disabled] [ref=e292]
                  - button "m9, empty" [disabled] [ref=e293]
                  - button "2W, n9, double word, empty" [disabled] [ref=e294]:
                    - generic [ref=e295]: 2W
                  - button "o9, empty" [disabled] [ref=e296]
                  - generic [ref=e297]: "10"
                  - button "a10, empty" [disabled] [ref=e298]
                  - button "b10, empty" [disabled] [ref=e299]
                  - button "c10, empty" [disabled] [ref=e300]
                  - button "d10, empty" [disabled] [ref=e301]
                  - button "e10, empty" [disabled] [ref=e302]
                  - button "f10, empty" [disabled] [ref=e303]
                  - button "g10, empty" [disabled] [ref=e304]
                  - button "3L, h10, triple letter, empty" [disabled] [ref=e305]:
                    - generic [ref=e306]: 3L
                  - button "E 1, i10, committed" [disabled] [ref=e307]:
                    - generic [ref=e308]: E
                    - generic [ref=e309]: "1"
                  - button "j10, empty" [disabled] [ref=e310]
                  - button "k10, empty" [disabled] [ref=e311]
                  - button "l10, empty" [disabled] [ref=e312]
                  - button "m10, empty" [disabled] [ref=e313]
                  - button "n10, empty" [disabled] [ref=e314]
                  - button "o10, empty" [disabled] [ref=e315]
                  - generic [ref=e316]: "11"
                  - button "3W, a11, triple word, empty" [disabled] [ref=e317]:
                    - generic [ref=e318]: 3W
                  - button "b11, empty" [disabled] [ref=e319]
                  - button "3L, c11, triple letter, empty" [disabled] [ref=e320]:
                    - generic [ref=e321]: 3L
                  - button "d11, empty" [disabled] [ref=e322]
                  - button "e11, empty" [disabled] [ref=e323]
                  - button "f11, empty" [disabled] [ref=e324]
                  - button "2L, g11, double letter, empty" [disabled] [ref=e325]:
                    - generic [ref=e326]: 2L
                  - button "h11, empty" [disabled] [ref=e327]
                  - button "2L, i11, double letter, empty" [disabled] [ref=e328]:
                    - generic [ref=e329]: 2L
                  - button "j11, empty" [disabled] [ref=e330]
                  - button "k11, empty" [disabled] [ref=e331]
                  - button "l11, empty" [disabled] [ref=e332]
                  - button "3L, m11, triple letter, empty" [disabled] [ref=e333]:
                    - generic [ref=e334]: 3L
                  - button "n11, empty" [disabled] [ref=e335]
                  - button "3W, o11, triple word, empty" [disabled] [ref=e336]:
                    - generic [ref=e337]: 3W
                  - generic [ref=e338]: "12"
                  - button "a12, empty" [disabled] [ref=e339]
                  - button "2L, b12, double letter, empty" [disabled] [ref=e340]:
                    - generic [ref=e341]: 2L
                  - button "c12, empty" [disabled] [ref=e342]
                  - button "2W, d12, double word, empty" [disabled] [ref=e343]:
                    - generic [ref=e344]: 2W
                  - button "e12, empty" [disabled] [ref=e345]
                  - button "f12, empty" [disabled] [ref=e346]
                  - button "g12, empty" [disabled] [ref=e347]
                  - button "h12, empty" [disabled] [ref=e348]
                  - button "i12, empty" [disabled] [ref=e349]
                  - button "j12, empty" [disabled] [ref=e350]
                  - button "k12, empty" [disabled] [ref=e351]
                  - button "2W, l12, double word, empty" [disabled] [ref=e352]:
                    - generic [ref=e353]: 2W
                  - button "m12, empty" [disabled] [ref=e354]
                  - button "2L, n12, double letter, empty" [disabled] [ref=e355]:
                    - generic [ref=e356]: 2L
                  - button "o12, empty" [disabled] [ref=e357]
                  - generic [ref=e358]: "13"
                  - button "a13, empty" [disabled] [ref=e359]
                  - button "b13, empty" [disabled] [ref=e360]
                  - button "c13, empty" [disabled] [ref=e361]
                  - button "d13, empty" [disabled] [ref=e362]
                  - button "3L, e13, triple letter, empty" [disabled] [ref=e363]:
                    - generic [ref=e364]: 3L
                  - button "f13, empty" [disabled] [ref=e365]
                  - button "g13, empty" [disabled] [ref=e366]
                  - button "h13, empty" [disabled] [ref=e367]
                  - button "i13, empty" [disabled] [ref=e368]
                  - button "j13, empty" [disabled] [ref=e369]
                  - button "3L, k13, triple letter, empty" [disabled] [ref=e370]:
                    - generic [ref=e371]: 3L
                  - button "l13, empty" [disabled] [ref=e372]
                  - button "m13, empty" [disabled] [ref=e373]
                  - button "n13, empty" [disabled] [ref=e374]
                  - button "o13, empty" [disabled] [ref=e375]
                  - generic [ref=e376]: "14"
                  - button "a14, empty" [disabled] [ref=e377]
                  - button "b14, empty" [disabled] [ref=e378]
                  - button "c14, empty" [disabled] [ref=e379]
                  - button "2L, d14, double letter, empty" [disabled] [ref=e380]:
                    - generic [ref=e381]: 2L
                  - button "e14, empty" [disabled] [ref=e382]
                  - button "f14, empty" [disabled] [ref=e383]
                  - button "2W, g14, double word, empty" [disabled] [ref=e384]:
                    - generic [ref=e385]: 2W
                  - button "h14, empty" [disabled] [ref=e386]
                  - button "2W, i14, double word, empty" [disabled] [ref=e387]:
                    - generic [ref=e388]: 2W
                  - button "j14, empty" [disabled] [ref=e389]
                  - button "k14, empty" [disabled] [ref=e390]
                  - button "2L, l14, double letter, empty" [disabled] [ref=e391]:
                    - generic [ref=e392]: 2L
                  - button "m14, empty" [disabled] [ref=e393]
                  - button "n14, empty" [disabled] [ref=e394]
                  - button "o14, empty" [disabled] [ref=e395]
                  - generic [ref=e396]: "15"
                  - button "2L, a15, double letter, empty" [disabled] [ref=e397]:
                    - generic [ref=e398]: 2L
                  - button "b15, empty" [disabled] [ref=e399]
                  - button "c15, empty" [disabled] [ref=e400]
                  - button "d15, empty" [disabled] [ref=e401]
                  - button "3W, e15, triple word, empty" [disabled] [ref=e402]:
                    - generic [ref=e403]: 3W
                  - button "f15, empty" [disabled] [ref=e404]
                  - button "g15, empty" [disabled] [ref=e405]
                  - button "2L, h15, double letter, empty" [disabled] [ref=e406]:
                    - generic [ref=e407]: 2L
                  - button "i15, empty" [disabled] [ref=e408]
                  - button "j15, empty" [disabled] [ref=e409]
                  - button "3W, k15, triple word, empty" [disabled] [ref=e410]:
                    - generic [ref=e411]: 3W
                  - button "l15, empty" [disabled] [ref=e412]
                  - button "m15, empty" [disabled] [ref=e413]
                  - button "n15, empty" [disabled] [ref=e414]
                  - button "2L, o15, double letter, empty" [disabled] [ref=e415]:
                    - generic [ref=e416]: 2L
              - generic [ref=e417]:
                - generic [ref=e418]:
                  - img "Whole board overview; outline shows the enlarged area" [ref=e419]
                  - group "View a board region" [ref=e646]:
                    - button "View a1 to e5" [ref=e647] [cursor=pointer]
                    - button "View f1 to j5" [ref=e648] [cursor=pointer]
                    - button "View k1 to o5" [ref=e649] [cursor=pointer]
                    - button "View a6 to e10" [ref=e650] [cursor=pointer]
                    - button "View f6 to j10" [ref=e651] [cursor=pointer]
                    - button "View k6 to o10" [ref=e652] [cursor=pointer]
                    - button "View a11 to e15" [ref=e653] [cursor=pointer]
                    - button "View f11 to j15" [ref=e654] [cursor=pointer]
                    - button "View k11 to o15" [ref=e655] [cursor=pointer]
                - generic [ref=e656]:
                  - generic [ref=e657]:
                    - button "Fit board" [ref=e658] [cursor=pointer]:
                      - paragraph [ref=e661]: Fit board
                    - button "Enlarge board" [pressed] [ref=e662] [cursor=pointer]:
                      - paragraph [ref=e665]: Enlarge board
                  - paragraph [ref=e666]: A 1, h8, committed
                  - 'button "Board map: locate a square" [ref=e667] [cursor=pointer]': Map
          - status [ref=e669]:
            - generic [ref=e670]:
              - generic [ref=e671]: "Amber: avery. Teal: jordan_plays. Violet: morgan. Coral: robin_42."
              - text: Violet — to play · 67 tiles in the bag
        - button "History and stats" [ref=e675] [cursor=pointer]:
          - generic [ref=e677]:
            - paragraph [ref=e678]: History and stats
            - img [ref=e681]
      - generic [ref=e683]:
        - img [ref=e686]
        - generic [ref=e689]:
          - paragraph [ref=e690]: You're watching
          - paragraph [ref=e691]: Moves appear as they are played.
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