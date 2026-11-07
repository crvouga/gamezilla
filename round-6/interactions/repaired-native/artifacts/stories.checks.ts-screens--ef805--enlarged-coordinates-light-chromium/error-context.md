# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--enlarged-coordinates light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/enlarged-coordinates-light.png.
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
        - paragraph [ref=e24]: Amber — to play · 86 tiles in the bag
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
              - generic [ref=e56]: "0"
          - generic [ref=e58]:
            - group "Your rack" [ref=e59]:
              - button "C, 3 points" [ref=e60] [cursor=pointer]:
                - generic [ref=e61]: C
                - generic [ref=e62]: "3"
              - button "A, 1 points" [ref=e63] [cursor=pointer]:
                - generic [ref=e64]: A
                - generic [ref=e65]: "1"
              - button "T, 1 points" [ref=e66] [cursor=pointer]:
                - generic [ref=e67]: T
                - generic [ref=e68]: "1"
              - button "Blank, 0 points" [ref=e69] [cursor=pointer]:
                - generic [ref=e70]: "0"
              - button "E, 1 points" [ref=e71] [cursor=pointer]:
                - generic [ref=e72]: E
                - generic [ref=e73]: "1"
              - button "S, 1 points" [ref=e74] [cursor=pointer]:
                - generic [ref=e75]: S
                - generic [ref=e76]: "1"
              - button "Q, 10 points" [ref=e77] [cursor=pointer]:
                - generic [ref=e78]: Q
                - generic [ref=e79]: "10"
            - generic [ref=e80]:
              - group "Word actions" [ref=e82]:
                - button "Play word" [disabled] [ref=e83]:
                  - paragraph [ref=e86]: Play word
                - button "Pass, exchange & tools" [ref=e87] [cursor=pointer]:
                  - paragraph [ref=e90]: Pass, exchange & tools
              - status [ref=e93]: Choose a tile, then a square.
            - generic [ref=e94]:
              - generic [ref=e95]:
                - button "Fit board" [ref=e96] [cursor=pointer]:
                  - paragraph [ref=e99]: Fit board
                - button "Enlarge board" [pressed] [ref=e100] [cursor=pointer]:
                  - paragraph [ref=e103]: Enlarge board
              - paragraph [ref=e104]: Scroll or use arrow keys. Map locates squares; Enter places a tile.
              - generic [ref=e105]:
                - region "Scrollable word board" [ref=e106]:
                  - group "Word board, fifteen columns and fifteen rows" [ref=e107]:
                    - generic [ref=e109]: a
                    - generic [ref=e110]: b
                    - generic [ref=e111]: c
                    - generic [ref=e112]: d
                    - generic [ref=e113]: e
                    - generic [ref=e114]: f
                    - generic [ref=e115]: g
                    - generic [ref=e116]: h
                    - generic [ref=e117]: i
                    - generic [ref=e118]: j
                    - generic [ref=e119]: k
                    - generic [ref=e120]: l
                    - generic [ref=e121]: m
                    - generic [ref=e122]: "n"
                    - generic [ref=e123]: o
                    - generic [ref=e124]: "1"
                    - button "2L, a1, double letter, empty" [ref=e125] [cursor=pointer]:
                      - generic [ref=e126]: 2L
                    - button "b1, empty" [ref=e127] [cursor=pointer]
                    - button "c1, empty" [ref=e128] [cursor=pointer]
                    - button "d1, empty" [ref=e129] [cursor=pointer]
                    - button "3W, e1, triple word, empty" [ref=e130] [cursor=pointer]:
                      - generic [ref=e131]: 3W
                    - button "f1, empty" [ref=e132] [cursor=pointer]
                    - button "g1, empty" [ref=e133] [cursor=pointer]
                    - button "2L, h1, double letter, empty" [ref=e134] [cursor=pointer]:
                      - generic [ref=e135]: 2L
                    - button "i1, empty" [ref=e136] [cursor=pointer]
                    - button "j1, empty" [ref=e137] [cursor=pointer]
                    - button "3W, k1, triple word, empty" [ref=e138] [cursor=pointer]:
                      - generic [ref=e139]: 3W
                    - button "l1, empty" [ref=e140] [cursor=pointer]
                    - button "m1, empty" [ref=e141] [cursor=pointer]
                    - button "n1, empty" [ref=e142] [cursor=pointer]
                    - button "2L, o1, double letter, empty" [ref=e143] [cursor=pointer]:
                      - generic [ref=e144]: 2L
                    - generic [ref=e145]: "2"
                    - button "a2, empty" [ref=e146] [cursor=pointer]
                    - button "b2, empty" [ref=e147] [cursor=pointer]
                    - button "c2, empty" [ref=e148] [cursor=pointer]
                    - button "2L, d2, double letter, empty" [ref=e149] [cursor=pointer]:
                      - generic [ref=e150]: 2L
                    - button "e2, empty" [ref=e151] [cursor=pointer]
                    - button "f2, empty" [ref=e152] [cursor=pointer]
                    - button "2W, g2, double word, empty" [ref=e153] [cursor=pointer]:
                      - generic [ref=e154]: 2W
                    - button "h2, empty" [ref=e155] [cursor=pointer]
                    - button "2W, i2, double word, empty" [ref=e156] [cursor=pointer]:
                      - generic [ref=e157]: 2W
                    - button "j2, empty" [ref=e158] [cursor=pointer]
                    - button "k2, empty" [ref=e159] [cursor=pointer]
                    - button "2L, l2, double letter, empty" [ref=e160] [cursor=pointer]:
                      - generic [ref=e161]: 2L
                    - button "m2, empty" [ref=e162] [cursor=pointer]
                    - button "n2, empty" [ref=e163] [cursor=pointer]
                    - button "o2, empty" [ref=e164] [cursor=pointer]
                    - generic [ref=e165]: "3"
                    - button "a3, empty" [ref=e166] [cursor=pointer]
                    - button "b3, empty" [ref=e167] [cursor=pointer]
                    - button "c3, empty" [ref=e168] [cursor=pointer]
                    - button "d3, empty" [ref=e169] [cursor=pointer]
                    - button "3L, e3, triple letter, empty" [ref=e170] [cursor=pointer]:
                      - generic [ref=e171]: 3L
                    - button "f3, empty" [ref=e172] [cursor=pointer]
                    - button "g3, empty" [ref=e173] [cursor=pointer]
                    - button "h3, empty" [ref=e174] [cursor=pointer]
                    - button "i3, empty" [ref=e175] [cursor=pointer]
                    - button "j3, empty" [ref=e176] [cursor=pointer]
                    - button "3L, k3, triple letter, empty" [ref=e177] [cursor=pointer]:
                      - generic [ref=e178]: 3L
                    - button "l3, empty" [ref=e179] [cursor=pointer]
                    - button "m3, empty" [ref=e180] [cursor=pointer]
                    - button "n3, empty" [ref=e181] [cursor=pointer]
                    - button "o3, empty" [ref=e182] [cursor=pointer]
                    - generic [ref=e183]: "4"
                    - button "a4, empty" [ref=e184] [cursor=pointer]
                    - button "2L, b4, double letter, empty" [ref=e185] [cursor=pointer]:
                      - generic [ref=e186]: 2L
                    - button "c4, empty" [ref=e187] [cursor=pointer]
                    - button "2W, d4, double word, empty" [ref=e188] [cursor=pointer]:
                      - generic [ref=e189]: 2W
                    - button "e4, empty" [ref=e190] [cursor=pointer]
                    - button "f4, empty" [ref=e191] [cursor=pointer]
                    - button "g4, empty" [ref=e192] [cursor=pointer]
                    - button "h4, empty" [ref=e193] [cursor=pointer]
                    - button "i4, empty" [ref=e194] [cursor=pointer]
                    - button "j4, empty" [ref=e195] [cursor=pointer]
                    - button "k4, empty" [ref=e196] [cursor=pointer]
                    - button "2W, l4, double word, empty" [ref=e197] [cursor=pointer]:
                      - generic [ref=e198]: 2W
                    - button "m4, empty" [ref=e199] [cursor=pointer]
                    - button "2L, n4, double letter, empty" [ref=e200] [cursor=pointer]:
                      - generic [ref=e201]: 2L
                    - button "o4, empty" [ref=e202] [cursor=pointer]
                    - generic [ref=e203]: "5"
                    - button "3W, a5, triple word, empty" [ref=e204] [cursor=pointer]:
                      - generic [ref=e205]: 3W
                    - button "b5, empty" [ref=e206] [cursor=pointer]
                    - button "3L, c5, triple letter, empty" [ref=e207] [cursor=pointer]:
                      - generic [ref=e208]: 3L
                    - button "d5, empty" [ref=e209] [cursor=pointer]
                    - button "e5, empty" [ref=e210] [cursor=pointer]
                    - button "f5, empty" [ref=e211] [cursor=pointer]
                    - button "2L, g5, double letter, empty" [ref=e212] [cursor=pointer]:
                      - generic [ref=e213]: 2L
                    - button "h5, empty" [ref=e214] [cursor=pointer]
                    - button "2L, i5, double letter, empty" [ref=e215] [cursor=pointer]:
                      - generic [ref=e216]: 2L
                    - button "j5, empty" [ref=e217] [cursor=pointer]
                    - button "k5, empty" [ref=e218] [cursor=pointer]
                    - button "l5, empty" [ref=e219] [cursor=pointer]
                    - button "3L, m5, triple letter, empty" [ref=e220] [cursor=pointer]:
                      - generic [ref=e221]: 3L
                    - button "n5, empty" [ref=e222] [cursor=pointer]
                    - button "3W, o5, triple word, empty" [ref=e223] [cursor=pointer]:
                      - generic [ref=e224]: 3W
                    - generic [ref=e225]: "6"
                    - button "a6, empty" [ref=e226] [cursor=pointer]
                    - button "b6, empty" [ref=e227] [cursor=pointer]
                    - button "c6, empty" [ref=e228] [cursor=pointer]
                    - button "d6, empty" [ref=e229] [cursor=pointer]
                    - button "e6, empty" [ref=e230] [cursor=pointer]
                    - button "f6, empty" [ref=e231] [cursor=pointer]
                    - button "g6, empty" [ref=e232] [cursor=pointer]
                    - button "3L, h6, triple letter, empty" [ref=e233] [cursor=pointer]:
                      - generic [ref=e234]: 3L
                    - button "i6, empty" [ref=e235] [cursor=pointer]
                    - button "j6, empty" [ref=e236] [cursor=pointer]
                    - button "k6, empty" [ref=e237] [cursor=pointer]
                    - button "l6, empty" [ref=e238] [cursor=pointer]
                    - button "m6, empty" [ref=e239] [cursor=pointer]
                    - button "n6, empty" [ref=e240] [cursor=pointer]
                    - button "o6, empty" [ref=e241] [cursor=pointer]
                    - generic [ref=e242]: "7"
                    - button "a7, empty" [ref=e243] [cursor=pointer]
                    - button "2W, b7, double word, empty" [ref=e244] [cursor=pointer]:
                      - generic [ref=e245]: 2W
                    - button "c7, empty" [ref=e246] [cursor=pointer]
                    - button "d7, empty" [ref=e247] [cursor=pointer]
                    - button "2L, e7, double letter, empty" [ref=e248] [cursor=pointer]:
                      - generic [ref=e249]: 2L
                    - button "f7, empty" [ref=e250] [cursor=pointer]
                    - button "2L, g7, double letter, empty" [ref=e251] [cursor=pointer]:
                      - generic [ref=e252]: 2L
                    - button "h7, empty" [ref=e253] [cursor=pointer]
                    - button "2L, i7, double letter, empty" [ref=e254] [cursor=pointer]:
                      - generic [ref=e255]: 2L
                    - button "j7, empty" [ref=e256] [cursor=pointer]
                    - button "2L, k7, double letter, empty" [ref=e257] [cursor=pointer]:
                      - generic [ref=e258]: 2L
                    - button "l7, empty" [ref=e259] [cursor=pointer]
                    - button "m7, empty" [ref=e260] [cursor=pointer]
                    - button "2W, n7, double word, empty" [ref=e261] [cursor=pointer]:
                      - generic [ref=e262]: 2W
                    - button "o7, empty" [ref=e263] [cursor=pointer]
                    - generic [ref=e264]: "8"
                    - button "2L, a8, double letter, empty" [ref=e265] [cursor=pointer]:
                      - generic [ref=e266]: 2L
                    - button "b8, empty" [ref=e267] [cursor=pointer]
                    - button "c8, empty" [ref=e268] [cursor=pointer]
                    - button "d8, empty" [ref=e269] [cursor=pointer]
                    - button "e8, empty" [ref=e270] [cursor=pointer]
                    - button "3L, f8, triple letter, empty" [ref=e271] [cursor=pointer]:
                      - generic [ref=e272]: 3L
                    - button "g8, empty" [ref=e273] [cursor=pointer]
                    - button "★, h8, start, double word, empty" [ref=e274] [cursor=pointer]:
                      - generic [ref=e275]: ★
                    - button "i8, empty" [ref=e276] [cursor=pointer]
                    - button "3L, j8, triple letter, empty" [ref=e277] [cursor=pointer]:
                      - generic [ref=e278]: 3L
                    - button "k8, empty" [ref=e279] [cursor=pointer]
                    - button "l8, empty" [ref=e280] [cursor=pointer]
                    - button "m8, empty" [ref=e281] [cursor=pointer]
                    - button "n8, empty" [ref=e282] [cursor=pointer]
                    - button "2L, o8, double letter, empty" [ref=e283] [cursor=pointer]:
                      - generic [ref=e284]: 2L
                    - generic [ref=e285]: "9"
                    - button "a9, empty" [ref=e286] [cursor=pointer]
                    - button "2W, b9, double word, empty" [ref=e287] [cursor=pointer]:
                      - generic [ref=e288]: 2W
                    - button "c9, empty" [ref=e289] [cursor=pointer]
                    - button "d9, empty" [ref=e290] [cursor=pointer]
                    - button "2L, e9, double letter, empty" [ref=e291] [cursor=pointer]:
                      - generic [ref=e292]: 2L
                    - button "f9, empty" [ref=e293] [cursor=pointer]
                    - button "2L, g9, double letter, empty" [ref=e294] [cursor=pointer]:
                      - generic [ref=e295]: 2L
                    - button "h9, empty" [ref=e296] [cursor=pointer]
                    - button "2L, i9, double letter, empty" [ref=e297] [cursor=pointer]:
                      - generic [ref=e298]: 2L
                    - button "j9, empty" [ref=e299] [cursor=pointer]
                    - button "2L, k9, double letter, empty" [ref=e300] [cursor=pointer]:
                      - generic [ref=e301]: 2L
                    - button "l9, empty" [ref=e302] [cursor=pointer]
                    - button "m9, empty" [ref=e303] [cursor=pointer]
                    - button "2W, n9, double word, empty" [ref=e304] [cursor=pointer]:
                      - generic [ref=e305]: 2W
                    - button "o9, empty" [ref=e306] [cursor=pointer]
                    - generic [ref=e307]: "10"
                    - button "a10, empty" [ref=e308] [cursor=pointer]
                    - button "b10, empty" [ref=e309] [cursor=pointer]
                    - button "c10, empty" [ref=e310] [cursor=pointer]
                    - button "d10, empty" [ref=e311] [cursor=pointer]
                    - button "e10, empty" [ref=e312] [cursor=pointer]
                    - button "f10, empty" [ref=e313] [cursor=pointer]
                    - button "g10, empty" [ref=e314] [cursor=pointer]
                    - button "3L, h10, triple letter, empty" [ref=e315] [cursor=pointer]:
                      - generic [ref=e316]: 3L
                    - button "i10, empty" [ref=e317] [cursor=pointer]
                    - button "j10, empty" [ref=e318] [cursor=pointer]
                    - button "k10, empty" [ref=e319] [cursor=pointer]
                    - button "l10, empty" [ref=e320] [cursor=pointer]
                    - button "m10, empty" [ref=e321] [cursor=pointer]
                    - button "n10, empty" [ref=e322] [cursor=pointer]
                    - button "o10, empty" [ref=e323] [cursor=pointer]
                    - generic [ref=e324]: "11"
                    - button "3W, a11, triple word, empty" [ref=e325] [cursor=pointer]:
                      - generic [ref=e326]: 3W
                    - button "b11, empty" [ref=e327] [cursor=pointer]
                    - button "3L, c11, triple letter, empty" [ref=e328] [cursor=pointer]:
                      - generic [ref=e329]: 3L
                    - button "d11, empty" [ref=e330] [cursor=pointer]
                    - button "e11, empty" [ref=e331] [cursor=pointer]
                    - button "f11, empty" [ref=e332] [cursor=pointer]
                    - button "2L, g11, double letter, empty" [ref=e333] [cursor=pointer]:
                      - generic [ref=e334]: 2L
                    - button "h11, empty" [ref=e335] [cursor=pointer]
                    - button "2L, i11, double letter, empty" [ref=e336] [cursor=pointer]:
                      - generic [ref=e337]: 2L
                    - button "j11, empty" [ref=e338] [cursor=pointer]
                    - button "k11, empty" [ref=e339] [cursor=pointer]
                    - button "l11, empty" [ref=e340] [cursor=pointer]
                    - button "3L, m11, triple letter, empty" [ref=e341] [cursor=pointer]:
                      - generic [ref=e342]: 3L
                    - button "n11, empty" [ref=e343] [cursor=pointer]
                    - button "3W, o11, triple word, empty" [ref=e344] [cursor=pointer]:
                      - generic [ref=e345]: 3W
                    - generic [ref=e346]: "12"
                    - button "a12, empty" [ref=e347] [cursor=pointer]
                    - button "2L, b12, double letter, empty" [ref=e348] [cursor=pointer]:
                      - generic [ref=e349]: 2L
                    - button "c12, empty" [ref=e350] [cursor=pointer]
                    - button "2W, d12, double word, empty" [ref=e351] [cursor=pointer]:
                      - generic [ref=e352]: 2W
                    - button "e12, empty" [ref=e353] [cursor=pointer]
                    - button "f12, empty" [ref=e354] [cursor=pointer]
                    - button "g12, empty" [ref=e355] [cursor=pointer]
                    - button "h12, empty" [ref=e356] [cursor=pointer]
                    - button "i12, empty" [ref=e357] [cursor=pointer]
                    - button "j12, empty" [ref=e358] [cursor=pointer]
                    - button "k12, empty" [ref=e359] [cursor=pointer]
                    - button "2W, l12, double word, empty" [ref=e360] [cursor=pointer]:
                      - generic [ref=e361]: 2W
                    - button "m12, empty" [ref=e362] [cursor=pointer]
                    - button "2L, n12, double letter, empty" [ref=e363] [cursor=pointer]:
                      - generic [ref=e364]: 2L
                    - button "o12, empty" [ref=e365] [cursor=pointer]
                    - generic [ref=e366]: "13"
                    - button "a13, empty" [ref=e367] [cursor=pointer]
                    - button "b13, empty" [ref=e368] [cursor=pointer]
                    - button "c13, empty" [ref=e369] [cursor=pointer]
                    - button "d13, empty" [ref=e370] [cursor=pointer]
                    - button "3L, e13, triple letter, empty" [ref=e371] [cursor=pointer]:
                      - generic [ref=e372]: 3L
                    - button "f13, empty" [ref=e373] [cursor=pointer]
                    - button "g13, empty" [ref=e374] [cursor=pointer]
                    - button "h13, empty" [ref=e375] [cursor=pointer]
                    - button "i13, empty" [ref=e376] [cursor=pointer]
                    - button "j13, empty" [ref=e377] [cursor=pointer]
                    - button "3L, k13, triple letter, empty" [ref=e378] [cursor=pointer]:
                      - generic [ref=e379]: 3L
                    - button "l13, empty" [ref=e380] [cursor=pointer]
                    - button "m13, empty" [ref=e381] [cursor=pointer]
                    - button "n13, empty" [ref=e382] [cursor=pointer]
                    - button "o13, empty" [ref=e383] [cursor=pointer]
                    - generic [ref=e384]: "14"
                    - button "a14, empty" [ref=e385] [cursor=pointer]
                    - button "b14, empty" [ref=e386] [cursor=pointer]
                    - button "c14, empty" [ref=e387] [cursor=pointer]
                    - button "2L, d14, double letter, empty" [ref=e388] [cursor=pointer]:
                      - generic [ref=e389]: 2L
                    - button "e14, empty" [ref=e390] [cursor=pointer]
                    - button "f14, empty" [ref=e391] [cursor=pointer]
                    - button "2W, g14, double word, empty" [ref=e392] [cursor=pointer]:
                      - generic [ref=e393]: 2W
                    - button "h14, empty" [ref=e394] [cursor=pointer]
                    - button "2W, i14, double word, empty" [ref=e395] [cursor=pointer]:
                      - generic [ref=e396]: 2W
                    - button "j14, empty" [ref=e397] [cursor=pointer]
                    - button "k14, empty" [ref=e398] [cursor=pointer]
                    - button "2L, l14, double letter, empty" [ref=e399] [cursor=pointer]:
                      - generic [ref=e400]: 2L
                    - button "m14, empty" [ref=e401] [cursor=pointer]
                    - button "n14, empty" [ref=e402] [cursor=pointer]
                    - button "o14, empty" [ref=e403] [cursor=pointer]
                    - generic [ref=e404]: "15"
                    - button "2L, a15, double letter, empty" [ref=e405] [cursor=pointer]:
                      - generic [ref=e406]: 2L
                    - button "b15, empty" [ref=e407] [cursor=pointer]
                    - button "c15, empty" [ref=e408] [cursor=pointer]
                    - button "d15, empty" [ref=e409] [cursor=pointer]
                    - button "3W, e15, triple word, empty" [ref=e410] [cursor=pointer]:
                      - generic [ref=e411]: 3W
                    - button "f15, empty" [ref=e412] [cursor=pointer]
                    - button "g15, empty" [ref=e413] [cursor=pointer]
                    - button "2L, h15, double letter, empty" [ref=e414] [cursor=pointer]:
                      - generic [ref=e415]: 2L
                    - button "i15, empty" [ref=e416] [cursor=pointer]
                    - button "j15, empty" [ref=e417] [cursor=pointer]
                    - button "3W, k15, triple word, empty" [ref=e418] [cursor=pointer]:
                      - generic [ref=e419]: 3W
                    - button "l15, empty" [ref=e420] [cursor=pointer]
                    - button "m15, empty" [ref=e421] [cursor=pointer]
                    - button "n15, empty" [ref=e422] [cursor=pointer]
                    - button "2L, o15, double letter, empty" [ref=e423] [cursor=pointer]:
                      - generic [ref=e424]: 2L
                - 'button "Board map: locate a square" [active] [ref=e425] [cursor=pointer]':
                  - img "Whole board overview; outline shows the enlarged area" [ref=e426]
                  - generic [ref=e653]: Map
          - status [ref=e655]:
            - generic [ref=e656]:
              - generic [ref=e657]: "Amber: avery. Teal: jordan_plays."
              - text: Amber — to play · 86 tiles in the bag
          - generic [ref=e660]:
            - generic [ref=e664]:
              - generic [ref=e665]:
                - img "Amber" [ref=e666]
                - generic "avery" [ref=e669]
                - generic [ref=e670]: Your move
              - generic [ref=e673]: 7 tiles
            - generic [ref=e674]:
              - generic [ref=e675]: Score
              - generic [ref=e676]: "0"
        - generic [ref=e679]:
          - group "Game actions" [ref=e680]:
            - button "Offer draw" [ref=e681] [cursor=pointer]:
              - paragraph [ref=e684]: Offer draw
            - button "Resign game" [ref=e685] [cursor=pointer]:
              - paragraph [ref=e688]:
                - text: Resign
                - generic [ref=e689]: game
          - button "History and stats" [ref=e690] [cursor=pointer]:
            - generic [ref=e692]:
              - paragraph [ref=e693]: History and stats
              - img [ref=e696]
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/enlarged-coordinates-light.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```