# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--assign-a-blank light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  270404 pixels (ratio 0.23 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/assign-a-blank-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/assign-a-blank-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 270404 pixels (ratio 0.23 of all image pixels) are different.
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
  - 270404 pixels (ratio 0.23 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e15]:
    - generic [ref=e16]:
      - heading "Word Tiles" [level=1] [ref=e19]
      - generic [ref=e21]:
        - generic [ref=e22]: Unrated
        - generic [ref=e23]: ·Untimed
    - generic [ref=e25]:
      - generic [ref=e27]:
        - generic [ref=e29]:
          - generic [ref=e33]:
            - generic [ref=e34]:
              - img "Teal" [ref=e35]
              - generic "jordan_plays" [ref=e38]
            - generic [ref=e41]: 7 tiles
          - generic [ref=e42]:
            - generic [ref=e43]: Score
            - generic [ref=e44]: "0"
        - generic [ref=e46]:
          - group "Your rack" [ref=e47]:
            - button "C, 3 points" [ref=e48] [cursor=pointer]:
              - generic [ref=e49]: C
              - generic [ref=e50]: "3"
            - button "A, 1 points" [ref=e51] [cursor=pointer]:
              - generic [ref=e52]: A
              - generic [ref=e53]: "1"
            - button "T, 1 points" [ref=e54] [cursor=pointer]:
              - generic [ref=e55]: T
              - generic [ref=e56]: "1"
            - button "Blank, 0 points, on the board" [disabled] [ref=e57]
            - button "E, 1 points" [ref=e58] [cursor=pointer]:
              - generic [ref=e59]: E
              - generic [ref=e60]: "1"
            - button "S, 1 points" [ref=e61] [cursor=pointer]:
              - generic [ref=e62]: S
              - generic [ref=e63]: "1"
            - button "Q, 10 points" [ref=e64] [cursor=pointer]:
              - generic [ref=e65]: Q
              - generic [ref=e66]: "10"
          - generic [ref=e67]:
            - group "Word actions" [ref=e69]:
              - button "Play word" [disabled] [ref=e70]:
                - paragraph [ref=e73]: Play word
              - button "More actions" [ref=e74] [cursor=pointer]:
                - paragraph [ref=e77]: More actions
            - status [ref=e80]: Words have at least two letters.
          - generic [ref=e81]:
            - generic [ref=e82]:
              - button "Fit board" [pressed] [ref=e83] [cursor=pointer]:
                - paragraph [ref=e86]: Fit board
              - button "Enlarge board" [ref=e87] [cursor=pointer]:
                - paragraph [ref=e90]: Enlarge board
            - region "Scrollable word board" [ref=e92]:
              - group "Word board, fifteen columns and fifteen rows" [ref=e93]:
                - generic [ref=e95]: a
                - generic [ref=e96]: b
                - generic [ref=e97]: c
                - generic [ref=e98]: d
                - generic [ref=e99]: e
                - generic [ref=e100]: f
                - generic [ref=e101]: g
                - generic [ref=e102]: h
                - generic [ref=e103]: i
                - generic [ref=e104]: j
                - generic [ref=e105]: k
                - generic [ref=e106]: l
                - generic [ref=e107]: m
                - generic [ref=e108]: "n"
                - generic [ref=e109]: o
                - generic [ref=e110]: "1"
                - button "2L, a1, double letter, empty" [ref=e111] [cursor=pointer]:
                  - generic [ref=e112]: 2L
                - button "b1, empty" [ref=e113] [cursor=pointer]
                - button "c1, empty" [ref=e114] [cursor=pointer]
                - button "d1, empty" [ref=e115] [cursor=pointer]
                - button "3W, e1, triple word, empty" [ref=e116] [cursor=pointer]:
                  - generic [ref=e117]: 3W
                - button "f1, empty" [ref=e118] [cursor=pointer]
                - button "g1, empty" [ref=e119] [cursor=pointer]
                - button "2L, h1, double letter, empty" [ref=e120] [cursor=pointer]:
                  - generic [ref=e121]: 2L
                - button "i1, empty" [ref=e122] [cursor=pointer]
                - button "j1, empty" [ref=e123] [cursor=pointer]
                - button "3W, k1, triple word, empty" [ref=e124] [cursor=pointer]:
                  - generic [ref=e125]: 3W
                - button "l1, empty" [ref=e126] [cursor=pointer]
                - button "m1, empty" [ref=e127] [cursor=pointer]
                - button "n1, empty" [ref=e128] [cursor=pointer]
                - button "2L, o1, double letter, empty" [ref=e129] [cursor=pointer]:
                  - generic [ref=e130]: 2L
                - generic [ref=e131]: "2"
                - button "a2, empty" [ref=e132] [cursor=pointer]
                - button "b2, empty" [ref=e133] [cursor=pointer]
                - button "c2, empty" [ref=e134] [cursor=pointer]
                - button "2L, d2, double letter, empty" [ref=e135] [cursor=pointer]:
                  - generic [ref=e136]: 2L
                - button "e2, empty" [ref=e137] [cursor=pointer]
                - button "f2, empty" [ref=e138] [cursor=pointer]
                - button "2W, g2, double word, empty" [ref=e139] [cursor=pointer]:
                  - generic [ref=e140]: 2W
                - button "h2, empty" [ref=e141] [cursor=pointer]
                - button "2W, i2, double word, empty" [ref=e142] [cursor=pointer]:
                  - generic [ref=e143]: 2W
                - button "j2, empty" [ref=e144] [cursor=pointer]
                - button "k2, empty" [ref=e145] [cursor=pointer]
                - button "2L, l2, double letter, empty" [ref=e146] [cursor=pointer]:
                  - generic [ref=e147]: 2L
                - button "m2, empty" [ref=e148] [cursor=pointer]
                - button "n2, empty" [ref=e149] [cursor=pointer]
                - button "o2, empty" [ref=e150] [cursor=pointer]
                - generic [ref=e151]: "3"
                - button "a3, empty" [ref=e152] [cursor=pointer]
                - button "b3, empty" [ref=e153] [cursor=pointer]
                - button "c3, empty" [ref=e154] [cursor=pointer]
                - button "d3, empty" [ref=e155] [cursor=pointer]
                - button "3L, e3, triple letter, empty" [ref=e156] [cursor=pointer]:
                  - generic [ref=e157]: 3L
                - button "f3, empty" [ref=e158] [cursor=pointer]
                - button "g3, empty" [ref=e159] [cursor=pointer]
                - button "h3, empty" [ref=e160] [cursor=pointer]
                - button "i3, empty" [ref=e161] [cursor=pointer]
                - button "j3, empty" [ref=e162] [cursor=pointer]
                - button "3L, k3, triple letter, empty" [ref=e163] [cursor=pointer]:
                  - generic [ref=e164]: 3L
                - button "l3, empty" [ref=e165] [cursor=pointer]
                - button "m3, empty" [ref=e166] [cursor=pointer]
                - button "n3, empty" [ref=e167] [cursor=pointer]
                - button "o3, empty" [ref=e168] [cursor=pointer]
                - generic [ref=e169]: "4"
                - button "a4, empty" [ref=e170] [cursor=pointer]
                - button "2L, b4, double letter, empty" [ref=e171] [cursor=pointer]:
                  - generic [ref=e172]: 2L
                - button "c4, empty" [ref=e173] [cursor=pointer]
                - button "2W, d4, double word, empty" [ref=e174] [cursor=pointer]:
                  - generic [ref=e175]: 2W
                - button "e4, empty" [ref=e176] [cursor=pointer]
                - button "f4, empty" [ref=e177] [cursor=pointer]
                - button "g4, empty" [ref=e178] [cursor=pointer]
                - button "h4, empty" [ref=e179] [cursor=pointer]
                - button "i4, empty" [ref=e180] [cursor=pointer]
                - button "j4, empty" [ref=e181] [cursor=pointer]
                - button "k4, empty" [ref=e182] [cursor=pointer]
                - button "2W, l4, double word, empty" [ref=e183] [cursor=pointer]:
                  - generic [ref=e184]: 2W
                - button "m4, empty" [ref=e185] [cursor=pointer]
                - button "2L, n4, double letter, empty" [ref=e186] [cursor=pointer]:
                  - generic [ref=e187]: 2L
                - button "o4, empty" [ref=e188] [cursor=pointer]
                - generic [ref=e189]: "5"
                - button "3W, a5, triple word, empty" [ref=e190] [cursor=pointer]:
                  - generic [ref=e191]: 3W
                - button "b5, empty" [ref=e192] [cursor=pointer]
                - button "3L, c5, triple letter, empty" [ref=e193] [cursor=pointer]:
                  - generic [ref=e194]: 3L
                - button "d5, empty" [ref=e195] [cursor=pointer]
                - button "e5, empty" [ref=e196] [cursor=pointer]
                - button "f5, empty" [ref=e197] [cursor=pointer]
                - button "2L, g5, double letter, empty" [ref=e198] [cursor=pointer]:
                  - generic [ref=e199]: 2L
                - button "h5, empty" [ref=e200] [cursor=pointer]
                - button "2L, i5, double letter, empty" [ref=e201] [cursor=pointer]:
                  - generic [ref=e202]: 2L
                - button "j5, empty" [ref=e203] [cursor=pointer]
                - button "k5, empty" [ref=e204] [cursor=pointer]
                - button "l5, empty" [ref=e205] [cursor=pointer]
                - button "3L, m5, triple letter, empty" [ref=e206] [cursor=pointer]:
                  - generic [ref=e207]: 3L
                - button "n5, empty" [ref=e208] [cursor=pointer]
                - button "3W, o5, triple word, empty" [ref=e209] [cursor=pointer]:
                  - generic [ref=e210]: 3W
                - generic [ref=e211]: "6"
                - button "a6, empty" [ref=e212] [cursor=pointer]
                - button "b6, empty" [ref=e213] [cursor=pointer]
                - button "c6, empty" [ref=e214] [cursor=pointer]
                - button "d6, empty" [ref=e215] [cursor=pointer]
                - button "e6, empty" [ref=e216] [cursor=pointer]
                - button "f6, empty" [ref=e217] [cursor=pointer]
                - button "g6, empty" [ref=e218] [cursor=pointer]
                - button "3L, h6, triple letter, empty" [ref=e219] [cursor=pointer]:
                  - generic [ref=e220]: 3L
                - button "i6, empty" [ref=e221] [cursor=pointer]
                - button "j6, empty" [ref=e222] [cursor=pointer]
                - button "k6, empty" [ref=e223] [cursor=pointer]
                - button "l6, empty" [ref=e224] [cursor=pointer]
                - button "m6, empty" [ref=e225] [cursor=pointer]
                - button "n6, empty" [ref=e226] [cursor=pointer]
                - button "o6, empty" [ref=e227] [cursor=pointer]
                - generic [ref=e228]: "7"
                - button "a7, empty" [ref=e229] [cursor=pointer]
                - button "2W, b7, double word, empty" [ref=e230] [cursor=pointer]:
                  - generic [ref=e231]: 2W
                - button "c7, empty" [ref=e232] [cursor=pointer]
                - button "d7, empty" [ref=e233] [cursor=pointer]
                - button "2L, e7, double letter, empty" [ref=e234] [cursor=pointer]:
                  - generic [ref=e235]: 2L
                - button "f7, empty" [ref=e236] [cursor=pointer]
                - button "2L, g7, double letter, empty" [ref=e237] [cursor=pointer]:
                  - generic [ref=e238]: 2L
                - button "h7, empty" [ref=e239] [cursor=pointer]
                - button "2L, i7, double letter, empty" [ref=e240] [cursor=pointer]:
                  - generic [ref=e241]: 2L
                - button "j7, empty" [ref=e242] [cursor=pointer]
                - button "2L, k7, double letter, empty" [ref=e243] [cursor=pointer]:
                  - generic [ref=e244]: 2L
                - button "l7, empty" [ref=e245] [cursor=pointer]
                - button "m7, empty" [ref=e246] [cursor=pointer]
                - button "2W, n7, double word, empty" [ref=e247] [cursor=pointer]:
                  - generic [ref=e248]: 2W
                - button "o7, empty" [ref=e249] [cursor=pointer]
                - generic [ref=e250]: "8"
                - button "2L, a8, double letter, empty" [ref=e251] [cursor=pointer]:
                  - generic [ref=e252]: 2L
                - button "b8, empty" [ref=e253] [cursor=pointer]
                - button "c8, empty" [ref=e254] [cursor=pointer]
                - button "d8, empty" [ref=e255] [cursor=pointer]
                - button "e8, empty" [ref=e256] [cursor=pointer]
                - button "3L, f8, triple letter, empty" [ref=e257] [cursor=pointer]:
                  - generic [ref=e258]: 3L
                - button "g8, empty" [ref=e259] [cursor=pointer]
                - button "E 0, h8, your tentative blank as E" [ref=e260] [cursor=pointer]:
                  - generic [ref=e261]: E
                  - generic [ref=e262]: "0"
                - button "i8, empty" [ref=e263] [cursor=pointer]
                - button "3L, j8, triple letter, empty" [ref=e264] [cursor=pointer]:
                  - generic [ref=e265]: 3L
                - button "k8, empty" [ref=e266] [cursor=pointer]
                - button "l8, empty" [ref=e267] [cursor=pointer]
                - button "m8, empty" [ref=e268] [cursor=pointer]
                - button "n8, empty" [ref=e269] [cursor=pointer]
                - button "2L, o8, double letter, empty" [ref=e270] [cursor=pointer]:
                  - generic [ref=e271]: 2L
                - generic [ref=e272]: "9"
                - button "a9, empty" [ref=e273] [cursor=pointer]
                - button "2W, b9, double word, empty" [ref=e274] [cursor=pointer]:
                  - generic [ref=e275]: 2W
                - button "c9, empty" [ref=e276] [cursor=pointer]
                - button "d9, empty" [ref=e277] [cursor=pointer]
                - button "2L, e9, double letter, empty" [ref=e278] [cursor=pointer]:
                  - generic [ref=e279]: 2L
                - button "f9, empty" [ref=e280] [cursor=pointer]
                - button "2L, g9, double letter, empty" [ref=e281] [cursor=pointer]:
                  - generic [ref=e282]: 2L
                - button "h9, empty" [ref=e283] [cursor=pointer]
                - button "2L, i9, double letter, empty" [ref=e284] [cursor=pointer]:
                  - generic [ref=e285]: 2L
                - button "j9, empty" [ref=e286] [cursor=pointer]
                - button "2L, k9, double letter, empty" [ref=e287] [cursor=pointer]:
                  - generic [ref=e288]: 2L
                - button "l9, empty" [ref=e289] [cursor=pointer]
                - button "m9, empty" [ref=e290] [cursor=pointer]
                - button "2W, n9, double word, empty" [ref=e291] [cursor=pointer]:
                  - generic [ref=e292]: 2W
                - button "o9, empty" [ref=e293] [cursor=pointer]
                - generic [ref=e294]: "10"
                - button "a10, empty" [ref=e295] [cursor=pointer]
                - button "b10, empty" [ref=e296] [cursor=pointer]
                - button "c10, empty" [ref=e297] [cursor=pointer]
                - button "d10, empty" [ref=e298] [cursor=pointer]
                - button "e10, empty" [ref=e299] [cursor=pointer]
                - button "f10, empty" [ref=e300] [cursor=pointer]
                - button "g10, empty" [ref=e301] [cursor=pointer]
                - button "3L, h10, triple letter, empty" [ref=e302] [cursor=pointer]:
                  - generic [ref=e303]: 3L
                - button "i10, empty" [ref=e304] [cursor=pointer]
                - button "j10, empty" [ref=e305] [cursor=pointer]
                - button "k10, empty" [ref=e306] [cursor=pointer]
                - button "l10, empty" [ref=e307] [cursor=pointer]
                - button "m10, empty" [ref=e308] [cursor=pointer]
                - button "n10, empty" [ref=e309] [cursor=pointer]
                - button "o10, empty" [ref=e310] [cursor=pointer]
                - generic [ref=e311]: "11"
                - button "3W, a11, triple word, empty" [ref=e312] [cursor=pointer]:
                  - generic [ref=e313]: 3W
                - button "b11, empty" [ref=e314] [cursor=pointer]
                - button "3L, c11, triple letter, empty" [ref=e315] [cursor=pointer]:
                  - generic [ref=e316]: 3L
                - button "d11, empty" [ref=e317] [cursor=pointer]
                - button "e11, empty" [ref=e318] [cursor=pointer]
                - button "f11, empty" [ref=e319] [cursor=pointer]
                - button "2L, g11, double letter, empty" [ref=e320] [cursor=pointer]:
                  - generic [ref=e321]: 2L
                - button "h11, empty" [ref=e322] [cursor=pointer]
                - button "2L, i11, double letter, empty" [ref=e323] [cursor=pointer]:
                  - generic [ref=e324]: 2L
                - button "j11, empty" [ref=e325] [cursor=pointer]
                - button "k11, empty" [ref=e326] [cursor=pointer]
                - button "l11, empty" [ref=e327] [cursor=pointer]
                - button "3L, m11, triple letter, empty" [ref=e328] [cursor=pointer]:
                  - generic [ref=e329]: 3L
                - button "n11, empty" [ref=e330] [cursor=pointer]
                - button "3W, o11, triple word, empty" [ref=e331] [cursor=pointer]:
                  - generic [ref=e332]: 3W
                - generic [ref=e333]: "12"
                - button "a12, empty" [ref=e334] [cursor=pointer]
                - button "2L, b12, double letter, empty" [ref=e335] [cursor=pointer]:
                  - generic [ref=e336]: 2L
                - button "c12, empty" [ref=e337] [cursor=pointer]
                - button "2W, d12, double word, empty" [ref=e338] [cursor=pointer]:
                  - generic [ref=e339]: 2W
                - button "e12, empty" [ref=e340] [cursor=pointer]
                - button "f12, empty" [ref=e341] [cursor=pointer]
                - button "g12, empty" [ref=e342] [cursor=pointer]
                - button "h12, empty" [ref=e343] [cursor=pointer]
                - button "i12, empty" [ref=e344] [cursor=pointer]
                - button "j12, empty" [ref=e345] [cursor=pointer]
                - button "k12, empty" [ref=e346] [cursor=pointer]
                - button "2W, l12, double word, empty" [ref=e347] [cursor=pointer]:
                  - generic [ref=e348]: 2W
                - button "m12, empty" [ref=e349] [cursor=pointer]
                - button "2L, n12, double letter, empty" [ref=e350] [cursor=pointer]:
                  - generic [ref=e351]: 2L
                - button "o12, empty" [ref=e352] [cursor=pointer]
                - generic [ref=e353]: "13"
                - button "a13, empty" [ref=e354] [cursor=pointer]
                - button "b13, empty" [ref=e355] [cursor=pointer]
                - button "c13, empty" [ref=e356] [cursor=pointer]
                - button "d13, empty" [ref=e357] [cursor=pointer]
                - button "3L, e13, triple letter, empty" [ref=e358] [cursor=pointer]:
                  - generic [ref=e359]: 3L
                - button "f13, empty" [ref=e360] [cursor=pointer]
                - button "g13, empty" [ref=e361] [cursor=pointer]
                - button "h13, empty" [ref=e362] [cursor=pointer]
                - button "i13, empty" [ref=e363] [cursor=pointer]
                - button "j13, empty" [ref=e364] [cursor=pointer]
                - button "3L, k13, triple letter, empty" [ref=e365] [cursor=pointer]:
                  - generic [ref=e366]: 3L
                - button "l13, empty" [ref=e367] [cursor=pointer]
                - button "m13, empty" [ref=e368] [cursor=pointer]
                - button "n13, empty" [ref=e369] [cursor=pointer]
                - button "o13, empty" [ref=e370] [cursor=pointer]
                - generic [ref=e371]: "14"
                - button "a14, empty" [ref=e372] [cursor=pointer]
                - button "b14, empty" [ref=e373] [cursor=pointer]
                - button "c14, empty" [ref=e374] [cursor=pointer]
                - button "2L, d14, double letter, empty" [ref=e375] [cursor=pointer]:
                  - generic [ref=e376]: 2L
                - button "e14, empty" [ref=e377] [cursor=pointer]
                - button "f14, empty" [ref=e378] [cursor=pointer]
                - button "2W, g14, double word, empty" [ref=e379] [cursor=pointer]:
                  - generic [ref=e380]: 2W
                - button "h14, empty" [ref=e381] [cursor=pointer]
                - button "2W, i14, double word, empty" [ref=e382] [cursor=pointer]:
                  - generic [ref=e383]: 2W
                - button "j14, empty" [ref=e384] [cursor=pointer]
                - button "k14, empty" [ref=e385] [cursor=pointer]
                - button "2L, l14, double letter, empty" [ref=e386] [cursor=pointer]:
                  - generic [ref=e387]: 2L
                - button "m14, empty" [ref=e388] [cursor=pointer]
                - button "n14, empty" [ref=e389] [cursor=pointer]
                - button "o14, empty" [ref=e390] [cursor=pointer]
                - generic [ref=e391]: "15"
                - button "2L, a15, double letter, empty" [ref=e392] [cursor=pointer]:
                  - generic [ref=e393]: 2L
                - button "b15, empty" [ref=e394] [cursor=pointer]
                - button "c15, empty" [ref=e395] [cursor=pointer]
                - button "d15, empty" [ref=e396] [cursor=pointer]
                - button "3W, e15, triple word, empty" [ref=e397] [cursor=pointer]:
                  - generic [ref=e398]: 3W
                - button "f15, empty" [ref=e399] [cursor=pointer]
                - button "g15, empty" [ref=e400] [cursor=pointer]
                - button "2L, h15, double letter, empty" [ref=e401] [cursor=pointer]:
                  - generic [ref=e402]: 2L
                - button "i15, empty" [ref=e403] [cursor=pointer]
                - button "j15, empty" [ref=e404] [cursor=pointer]
                - button "3W, k15, triple word, empty" [ref=e405] [cursor=pointer]:
                  - generic [ref=e406]: 3W
                - button "l15, empty" [ref=e407] [cursor=pointer]
                - button "m15, empty" [ref=e408] [cursor=pointer]
                - button "n15, empty" [ref=e409] [cursor=pointer]
                - button "2L, o15, double letter, empty" [ref=e410] [cursor=pointer]:
                  - generic [ref=e411]: 2L
        - status [ref=e413]:
          - generic [ref=e414]:
            - generic [ref=e415]: "Amber: avery. Teal: jordan_plays."
            - text: Amber — to play · 86 tiles in the bag
        - generic [ref=e418]:
          - generic [ref=e422]:
            - generic [ref=e423]:
              - img "Amber" [ref=e424]
              - generic "avery" [ref=e427]
              - generic [ref=e428]: Your move
            - generic [ref=e431]: 7 tiles
          - generic [ref=e432]:
            - generic [ref=e433]: Score
            - generic [ref=e434]: "0"
      - region "Game record" [ref=e437]:
        - generic [ref=e438]:
          - heading "Game record" [level=2] [ref=e440]
          - paragraph [ref=e441]: Amber — to play · 86 tiles in the bag
        - generic [ref=e443]:
          - group "Game actions" [ref=e444]:
            - button "Offer draw" [ref=e445] [cursor=pointer]:
              - paragraph [ref=e448]: Offer draw
            - button "Resign game" [ref=e449] [cursor=pointer]:
              - paragraph [ref=e452]:
                - text: Resign
                - generic [ref=e453]: game
          - button "History and stats" [ref=e454] [cursor=pointer]:
            - paragraph [ref=e457]: History and stats
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