# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--enlarged-coordinates dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/enlarged-coordinates-dark-1440.png.
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
              - generic [ref=e36]: jordan_plays
            - generic [ref=e39]: 7 tiles
          - generic [ref=e40]:
            - generic [ref=e41]: Score
            - generic [ref=e42]: "0"
        - generic [ref=e44]:
          - group "Your rack" [ref=e45]:
            - button "C, 3 points" [ref=e46] [cursor=pointer]:
              - generic [ref=e47]: C
              - generic [ref=e48]: "3"
            - button "A, 1 points" [ref=e49] [cursor=pointer]:
              - generic [ref=e50]: A
              - generic [ref=e51]: "1"
            - button "T, 1 points" [ref=e52] [cursor=pointer]:
              - generic [ref=e53]: T
              - generic [ref=e54]: "1"
            - button "Blank, 0 points" [ref=e55] [cursor=pointer]:
              - generic [ref=e56]: "0"
            - button "E, 1 points" [ref=e57] [cursor=pointer]:
              - generic [ref=e58]: E
              - generic [ref=e59]: "1"
            - button "S, 1 points" [ref=e60] [cursor=pointer]:
              - generic [ref=e61]: S
              - generic [ref=e62]: "1"
            - button "Q, 10 points" [ref=e63] [cursor=pointer]:
              - generic [ref=e64]: Q
              - generic [ref=e65]: "10"
          - generic [ref=e66]:
            - group "Word actions" [ref=e67]:
              - button "Play word" [disabled] [ref=e68]:
                - paragraph [ref=e71]: Play word
              - button "Recall tiles" [disabled] [ref=e72]:
                - paragraph [ref=e75]: Recall tiles
              - button "Undo" [disabled] [ref=e76]:
                - paragraph [ref=e79]: Undo
              - button "Redo" [disabled] [ref=e80]:
                - paragraph [ref=e83]: Redo
              - button "Shuffle rack" [ref=e84] [cursor=pointer]:
                - paragraph [ref=e87]: Shuffle rack
              - button "Pass" [ref=e88] [cursor=pointer]:
                - paragraph [ref=e91]: Pass
              - button "Exchange tiles" [ref=e92] [cursor=pointer]:
                - paragraph [ref=e95]: Exchange tiles
            - status [ref=e98]: Choose a tile, then a square.
          - generic [ref=e99]:
            - generic [ref=e100]:
              - button "Fit board" [ref=e101] [cursor=pointer]:
                - paragraph [ref=e104]: Fit board
              - button "Enlarge board" [pressed] [ref=e105] [cursor=pointer]:
                - paragraph [ref=e108]: Enlarge board
            - paragraph [ref=e109]: Scroll to explore. Arrow keys move between squares; Enter places your selected tile.
            - generic [ref=e110]:
              - region "Scrollable word board" [ref=e111]:
                - group "Word board, fifteen columns and fifteen rows" [ref=e112]:
                  - generic [ref=e114]: a
                  - generic [ref=e115]: b
                  - generic [ref=e116]: c
                  - generic [ref=e117]: d
                  - generic [ref=e118]: e
                  - generic [ref=e119]: f
                  - generic [ref=e120]: g
                  - generic [ref=e121]: h
                  - generic [ref=e122]: i
                  - generic [ref=e123]: j
                  - generic [ref=e124]: k
                  - generic [ref=e125]: l
                  - generic [ref=e126]: m
                  - generic [ref=e127]: "n"
                  - generic [ref=e128]: o
                  - generic [ref=e129]: "1"
                  - button "2L, a1, double letter, empty" [ref=e130] [cursor=pointer]:
                    - generic [ref=e131]: 2L
                  - button "b1, empty" [ref=e132] [cursor=pointer]
                  - button "c1, empty" [ref=e133] [cursor=pointer]
                  - button "d1, empty" [ref=e134] [cursor=pointer]
                  - button "3W, e1, triple word, empty" [ref=e135] [cursor=pointer]:
                    - generic [ref=e136]: 3W
                  - button "f1, empty" [ref=e137] [cursor=pointer]
                  - button "g1, empty" [ref=e138] [cursor=pointer]
                  - button "2L, h1, double letter, empty" [ref=e139] [cursor=pointer]:
                    - generic [ref=e140]: 2L
                  - button "i1, empty" [ref=e141] [cursor=pointer]
                  - button "j1, empty" [ref=e142] [cursor=pointer]
                  - button "3W, k1, triple word, empty" [ref=e143] [cursor=pointer]:
                    - generic [ref=e144]: 3W
                  - button "l1, empty" [ref=e145] [cursor=pointer]
                  - button "m1, empty" [ref=e146] [cursor=pointer]
                  - button "n1, empty" [ref=e147] [cursor=pointer]
                  - button "2L, o1, double letter, empty" [ref=e148] [cursor=pointer]:
                    - generic [ref=e149]: 2L
                  - generic [ref=e150]: "2"
                  - button "a2, empty" [ref=e151] [cursor=pointer]
                  - button "b2, empty" [ref=e152] [cursor=pointer]
                  - button "c2, empty" [ref=e153] [cursor=pointer]
                  - button "2L, d2, double letter, empty" [ref=e154] [cursor=pointer]:
                    - generic [ref=e155]: 2L
                  - button "e2, empty" [ref=e156] [cursor=pointer]
                  - button "f2, empty" [ref=e157] [cursor=pointer]
                  - button "2W, g2, double word, empty" [ref=e158] [cursor=pointer]:
                    - generic [ref=e159]: 2W
                  - button "h2, empty" [ref=e160] [cursor=pointer]
                  - button "2W, i2, double word, empty" [ref=e161] [cursor=pointer]:
                    - generic [ref=e162]: 2W
                  - button "j2, empty" [ref=e163] [cursor=pointer]
                  - button "k2, empty" [ref=e164] [cursor=pointer]
                  - button "2L, l2, double letter, empty" [ref=e165] [cursor=pointer]:
                    - generic [ref=e166]: 2L
                  - button "m2, empty" [ref=e167] [cursor=pointer]
                  - button "n2, empty" [ref=e168] [cursor=pointer]
                  - button "o2, empty" [ref=e169] [cursor=pointer]
                  - generic [ref=e170]: "3"
                  - button "a3, empty" [ref=e171] [cursor=pointer]
                  - button "b3, empty" [ref=e172] [cursor=pointer]
                  - button "c3, empty" [ref=e173] [cursor=pointer]
                  - button "d3, empty" [ref=e174] [cursor=pointer]
                  - button "3L, e3, triple letter, empty" [ref=e175] [cursor=pointer]:
                    - generic [ref=e176]: 3L
                  - button "f3, empty" [ref=e177] [cursor=pointer]
                  - button "g3, empty" [ref=e178] [cursor=pointer]
                  - button "h3, empty" [ref=e179] [cursor=pointer]
                  - button "i3, empty" [ref=e180] [cursor=pointer]
                  - button "j3, empty" [ref=e181] [cursor=pointer]
                  - button "3L, k3, triple letter, empty" [ref=e182] [cursor=pointer]:
                    - generic [ref=e183]: 3L
                  - button "l3, empty" [ref=e184] [cursor=pointer]
                  - button "m3, empty" [ref=e185] [cursor=pointer]
                  - button "n3, empty" [ref=e186] [cursor=pointer]
                  - button "o3, empty" [ref=e187] [cursor=pointer]
                  - generic [ref=e188]: "4"
                  - button "a4, empty" [ref=e189] [cursor=pointer]
                  - button "2L, b4, double letter, empty" [ref=e190] [cursor=pointer]:
                    - generic [ref=e191]: 2L
                  - button "c4, empty" [ref=e192] [cursor=pointer]
                  - button "2W, d4, double word, empty" [ref=e193] [cursor=pointer]:
                    - generic [ref=e194]: 2W
                  - button "e4, empty" [ref=e195] [cursor=pointer]
                  - button "f4, empty" [ref=e196] [cursor=pointer]
                  - button "g4, empty" [ref=e197] [cursor=pointer]
                  - button "h4, empty" [ref=e198] [cursor=pointer]
                  - button "i4, empty" [ref=e199] [cursor=pointer]
                  - button "j4, empty" [ref=e200] [cursor=pointer]
                  - button "k4, empty" [ref=e201] [cursor=pointer]
                  - button "2W, l4, double word, empty" [ref=e202] [cursor=pointer]:
                    - generic [ref=e203]: 2W
                  - button "m4, empty" [ref=e204] [cursor=pointer]
                  - button "2L, n4, double letter, empty" [ref=e205] [cursor=pointer]:
                    - generic [ref=e206]: 2L
                  - button "o4, empty" [ref=e207] [cursor=pointer]
                  - generic [ref=e208]: "5"
                  - button "3W, a5, triple word, empty" [ref=e209] [cursor=pointer]:
                    - generic [ref=e210]: 3W
                  - button "b5, empty" [ref=e211] [cursor=pointer]
                  - button "3L, c5, triple letter, empty" [ref=e212] [cursor=pointer]:
                    - generic [ref=e213]: 3L
                  - button "d5, empty" [ref=e214] [cursor=pointer]
                  - button "e5, empty" [ref=e215] [cursor=pointer]
                  - button "f5, empty" [ref=e216] [cursor=pointer]
                  - button "2L, g5, double letter, empty" [ref=e217] [cursor=pointer]:
                    - generic [ref=e218]: 2L
                  - button "h5, empty" [ref=e219] [cursor=pointer]
                  - button "2L, i5, double letter, empty" [ref=e220] [cursor=pointer]:
                    - generic [ref=e221]: 2L
                  - button "j5, empty" [ref=e222] [cursor=pointer]
                  - button "k5, empty" [ref=e223] [cursor=pointer]
                  - button "l5, empty" [ref=e224] [cursor=pointer]
                  - button "3L, m5, triple letter, empty" [ref=e225] [cursor=pointer]:
                    - generic [ref=e226]: 3L
                  - button "n5, empty" [ref=e227] [cursor=pointer]
                  - button "3W, o5, triple word, empty" [ref=e228] [cursor=pointer]:
                    - generic [ref=e229]: 3W
                  - generic [ref=e230]: "6"
                  - button "a6, empty" [ref=e231] [cursor=pointer]
                  - button "b6, empty" [ref=e232] [cursor=pointer]
                  - button "c6, empty" [ref=e233] [cursor=pointer]
                  - button "d6, empty" [ref=e234] [cursor=pointer]
                  - button "e6, empty" [ref=e235] [cursor=pointer]
                  - button "f6, empty" [ref=e236] [cursor=pointer]
                  - button "g6, empty" [ref=e237] [cursor=pointer]
                  - button "3L, h6, triple letter, empty" [ref=e238] [cursor=pointer]:
                    - generic [ref=e239]: 3L
                  - button "i6, empty" [ref=e240] [cursor=pointer]
                  - button "j6, empty" [ref=e241] [cursor=pointer]
                  - button "k6, empty" [ref=e242] [cursor=pointer]
                  - button "l6, empty" [ref=e243] [cursor=pointer]
                  - button "m6, empty" [ref=e244] [cursor=pointer]
                  - button "n6, empty" [ref=e245] [cursor=pointer]
                  - button "o6, empty" [ref=e246] [cursor=pointer]
                  - generic [ref=e247]: "7"
                  - button "a7, empty" [ref=e248] [cursor=pointer]
                  - button "2W, b7, double word, empty" [ref=e249] [cursor=pointer]:
                    - generic [ref=e250]: 2W
                  - button "c7, empty" [ref=e251] [cursor=pointer]
                  - button "d7, empty" [ref=e252] [cursor=pointer]
                  - button "2L, e7, double letter, empty" [ref=e253] [cursor=pointer]:
                    - generic [ref=e254]: 2L
                  - button "f7, empty" [ref=e255] [cursor=pointer]
                  - button "2L, g7, double letter, empty" [ref=e256] [cursor=pointer]:
                    - generic [ref=e257]: 2L
                  - button "h7, empty" [ref=e258] [cursor=pointer]
                  - button "2L, i7, double letter, empty" [ref=e259] [cursor=pointer]:
                    - generic [ref=e260]: 2L
                  - button "j7, empty" [ref=e261] [cursor=pointer]
                  - button "2L, k7, double letter, empty" [ref=e262] [cursor=pointer]:
                    - generic [ref=e263]: 2L
                  - button "l7, empty" [ref=e264] [cursor=pointer]
                  - button "m7, empty" [ref=e265] [cursor=pointer]
                  - button "2W, n7, double word, empty" [ref=e266] [cursor=pointer]:
                    - generic [ref=e267]: 2W
                  - button "o7, empty" [ref=e268] [cursor=pointer]
                  - generic [ref=e269]: "8"
                  - button "2L, a8, double letter, empty" [ref=e270] [cursor=pointer]:
                    - generic [ref=e271]: 2L
                  - button "b8, empty" [ref=e272] [cursor=pointer]
                  - button "c8, empty" [ref=e273] [cursor=pointer]
                  - button "d8, empty" [ref=e274] [cursor=pointer]
                  - button "e8, empty" [ref=e275] [cursor=pointer]
                  - button "3L, f8, triple letter, empty" [ref=e276] [cursor=pointer]:
                    - generic [ref=e277]: 3L
                  - button "g8, empty" [ref=e278] [cursor=pointer]
                  - button "★, h8, start, double word, empty" [active] [ref=e279] [cursor=pointer]:
                    - generic [ref=e280]: ★
                  - button "i8, empty" [ref=e281] [cursor=pointer]
                  - button "3L, j8, triple letter, empty" [ref=e282] [cursor=pointer]:
                    - generic [ref=e283]: 3L
                  - button "k8, empty" [ref=e284] [cursor=pointer]
                  - button "l8, empty" [ref=e285] [cursor=pointer]
                  - button "m8, empty" [ref=e286] [cursor=pointer]
                  - button "n8, empty" [ref=e287] [cursor=pointer]
                  - button "2L, o8, double letter, empty" [ref=e288] [cursor=pointer]:
                    - generic [ref=e289]: 2L
                  - generic [ref=e290]: "9"
                  - button "a9, empty" [ref=e291] [cursor=pointer]
                  - button "2W, b9, double word, empty" [ref=e292] [cursor=pointer]:
                    - generic [ref=e293]: 2W
                  - button "c9, empty" [ref=e294] [cursor=pointer]
                  - button "d9, empty" [ref=e295] [cursor=pointer]
                  - button "2L, e9, double letter, empty" [ref=e296] [cursor=pointer]:
                    - generic [ref=e297]: 2L
                  - button "f9, empty" [ref=e298] [cursor=pointer]
                  - button "2L, g9, double letter, empty" [ref=e299] [cursor=pointer]:
                    - generic [ref=e300]: 2L
                  - button "h9, empty" [ref=e301] [cursor=pointer]
                  - button "2L, i9, double letter, empty" [ref=e302] [cursor=pointer]:
                    - generic [ref=e303]: 2L
                  - button "j9, empty" [ref=e304] [cursor=pointer]
                  - button "2L, k9, double letter, empty" [ref=e305] [cursor=pointer]:
                    - generic [ref=e306]: 2L
                  - button "l9, empty" [ref=e307] [cursor=pointer]
                  - button "m9, empty" [ref=e308] [cursor=pointer]
                  - button "2W, n9, double word, empty" [ref=e309] [cursor=pointer]:
                    - generic [ref=e310]: 2W
                  - button "o9, empty" [ref=e311] [cursor=pointer]
                  - generic [ref=e312]: "10"
                  - button "a10, empty" [ref=e313] [cursor=pointer]
                  - button "b10, empty" [ref=e314] [cursor=pointer]
                  - button "c10, empty" [ref=e315] [cursor=pointer]
                  - button "d10, empty" [ref=e316] [cursor=pointer]
                  - button "e10, empty" [ref=e317] [cursor=pointer]
                  - button "f10, empty" [ref=e318] [cursor=pointer]
                  - button "g10, empty" [ref=e319] [cursor=pointer]
                  - button "3L, h10, triple letter, empty" [ref=e320] [cursor=pointer]:
                    - generic [ref=e321]: 3L
                  - button "i10, empty" [ref=e322] [cursor=pointer]
                  - button "j10, empty" [ref=e323] [cursor=pointer]
                  - button "k10, empty" [ref=e324] [cursor=pointer]
                  - button "l10, empty" [ref=e325] [cursor=pointer]
                  - button "m10, empty" [ref=e326] [cursor=pointer]
                  - button "n10, empty" [ref=e327] [cursor=pointer]
                  - button "o10, empty" [ref=e328] [cursor=pointer]
                  - generic [ref=e329]: "11"
                  - button "3W, a11, triple word, empty" [ref=e330] [cursor=pointer]:
                    - generic [ref=e331]: 3W
                  - button "b11, empty" [ref=e332] [cursor=pointer]
                  - button "3L, c11, triple letter, empty" [ref=e333] [cursor=pointer]:
                    - generic [ref=e334]: 3L
                  - button "d11, empty" [ref=e335] [cursor=pointer]
                  - button "e11, empty" [ref=e336] [cursor=pointer]
                  - button "f11, empty" [ref=e337] [cursor=pointer]
                  - button "2L, g11, double letter, empty" [ref=e338] [cursor=pointer]:
                    - generic [ref=e339]: 2L
                  - button "h11, empty" [ref=e340] [cursor=pointer]
                  - button "2L, i11, double letter, empty" [ref=e341] [cursor=pointer]:
                    - generic [ref=e342]: 2L
                  - button "j11, empty" [ref=e343] [cursor=pointer]
                  - button "k11, empty" [ref=e344] [cursor=pointer]
                  - button "l11, empty" [ref=e345] [cursor=pointer]
                  - button "3L, m11, triple letter, empty" [ref=e346] [cursor=pointer]:
                    - generic [ref=e347]: 3L
                  - button "n11, empty" [ref=e348] [cursor=pointer]
                  - button "3W, o11, triple word, empty" [ref=e349] [cursor=pointer]:
                    - generic [ref=e350]: 3W
                  - generic [ref=e351]: "12"
                  - button "a12, empty" [ref=e352] [cursor=pointer]
                  - button "2L, b12, double letter, empty" [ref=e353] [cursor=pointer]:
                    - generic [ref=e354]: 2L
                  - button "c12, empty" [ref=e355] [cursor=pointer]
                  - button "2W, d12, double word, empty" [ref=e356] [cursor=pointer]:
                    - generic [ref=e357]: 2W
                  - button "e12, empty" [ref=e358] [cursor=pointer]
                  - button "f12, empty" [ref=e359] [cursor=pointer]
                  - button "g12, empty" [ref=e360] [cursor=pointer]
                  - button "h12, empty" [ref=e361] [cursor=pointer]
                  - button "i12, empty" [ref=e362] [cursor=pointer]
                  - button "j12, empty" [ref=e363] [cursor=pointer]
                  - button "k12, empty" [ref=e364] [cursor=pointer]
                  - button "2W, l12, double word, empty" [ref=e365] [cursor=pointer]:
                    - generic [ref=e366]: 2W
                  - button "m12, empty" [ref=e367] [cursor=pointer]
                  - button "2L, n12, double letter, empty" [ref=e368] [cursor=pointer]:
                    - generic [ref=e369]: 2L
                  - button "o12, empty" [ref=e370] [cursor=pointer]
                  - generic [ref=e371]: "13"
                  - button "a13, empty" [ref=e372] [cursor=pointer]
                  - button "b13, empty" [ref=e373] [cursor=pointer]
                  - button "c13, empty" [ref=e374] [cursor=pointer]
                  - button "d13, empty" [ref=e375] [cursor=pointer]
                  - button "3L, e13, triple letter, empty" [ref=e376] [cursor=pointer]:
                    - generic [ref=e377]: 3L
                  - button "f13, empty" [ref=e378] [cursor=pointer]
                  - button "g13, empty" [ref=e379] [cursor=pointer]
                  - button "h13, empty" [ref=e380] [cursor=pointer]
                  - button "i13, empty" [ref=e381] [cursor=pointer]
                  - button "j13, empty" [ref=e382] [cursor=pointer]
                  - button "3L, k13, triple letter, empty" [ref=e383] [cursor=pointer]:
                    - generic [ref=e384]: 3L
                  - button "l13, empty" [ref=e385] [cursor=pointer]
                  - button "m13, empty" [ref=e386] [cursor=pointer]
                  - button "n13, empty" [ref=e387] [cursor=pointer]
                  - button "o13, empty" [ref=e388] [cursor=pointer]
                  - generic [ref=e389]: "14"
                  - button "a14, empty" [ref=e390] [cursor=pointer]
                  - button "b14, empty" [ref=e391] [cursor=pointer]
                  - button "c14, empty" [ref=e392] [cursor=pointer]
                  - button "2L, d14, double letter, empty" [ref=e393] [cursor=pointer]:
                    - generic [ref=e394]: 2L
                  - button "e14, empty" [ref=e395] [cursor=pointer]
                  - button "f14, empty" [ref=e396] [cursor=pointer]
                  - button "2W, g14, double word, empty" [ref=e397] [cursor=pointer]:
                    - generic [ref=e398]: 2W
                  - button "h14, empty" [ref=e399] [cursor=pointer]
                  - button "2W, i14, double word, empty" [ref=e400] [cursor=pointer]:
                    - generic [ref=e401]: 2W
                  - button "j14, empty" [ref=e402] [cursor=pointer]
                  - button "k14, empty" [ref=e403] [cursor=pointer]
                  - button "2L, l14, double letter, empty" [ref=e404] [cursor=pointer]:
                    - generic [ref=e405]: 2L
                  - button "m14, empty" [ref=e406] [cursor=pointer]
                  - button "n14, empty" [ref=e407] [cursor=pointer]
                  - button "o14, empty" [ref=e408] [cursor=pointer]
                  - generic [ref=e409]: "15"
                  - button "2L, a15, double letter, empty" [ref=e410] [cursor=pointer]:
                    - generic [ref=e411]: 2L
                  - button "b15, empty" [ref=e412] [cursor=pointer]
                  - button "c15, empty" [ref=e413] [cursor=pointer]
                  - button "d15, empty" [ref=e414] [cursor=pointer]
                  - button "3W, e15, triple word, empty" [ref=e415] [cursor=pointer]:
                    - generic [ref=e416]: 3W
                  - button "f15, empty" [ref=e417] [cursor=pointer]
                  - button "g15, empty" [ref=e418] [cursor=pointer]
                  - button "2L, h15, double letter, empty" [ref=e419] [cursor=pointer]:
                    - generic [ref=e420]: 2L
                  - button "i15, empty" [ref=e421] [cursor=pointer]
                  - button "j15, empty" [ref=e422] [cursor=pointer]
                  - button "3W, k15, triple word, empty" [ref=e423] [cursor=pointer]:
                    - generic [ref=e424]: 3W
                  - button "l15, empty" [ref=e425] [cursor=pointer]
                  - button "m15, empty" [ref=e426] [cursor=pointer]
                  - button "n15, empty" [ref=e427] [cursor=pointer]
                  - button "2L, o15, double letter, empty" [ref=e428] [cursor=pointer]:
                    - generic [ref=e429]: 2L
              - img "Whole board overview; outline shows the enlarged area" [ref=e430]
        - status [ref=e658]:
          - generic [ref=e659]:
            - generic [ref=e660]: "Amber: avery. Teal: jordan_plays."
            - text: Amber — to play · 86 tiles in the bag
        - generic [ref=e663]:
          - generic [ref=e667]:
            - generic [ref=e668]:
              - img "Amber" [ref=e669]
              - generic [ref=e670]: avery
              - generic [ref=e671]: Your move
            - generic [ref=e674]: 7 tiles
          - generic [ref=e675]:
            - generic [ref=e676]: Score
            - generic [ref=e677]: "0"
      - region "Game record" [ref=e680]:
        - generic [ref=e681]:
          - heading "Game record" [level=2] [ref=e683]
          - paragraph [ref=e684]: Amber — to play · 86 tiles in the bag
        - generic [ref=e686]:
          - group "Game actions" [ref=e687]:
            - button "Offer draw" [ref=e688] [cursor=pointer]:
              - paragraph [ref=e691]: Offer draw
            - button "Resign game" [ref=e692] [cursor=pointer]:
              - paragraph [ref=e695]:
                - text: Resign
                - generic [ref=e696]: game
          - button "History and stats" [ref=e697] [cursor=pointer]:
            - paragraph [ref=e700]: History and stats
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/enlarged-coordinates-dark-1440.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```