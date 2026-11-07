# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--recover-and-submit dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/recover-and-submit-dark-1440.png.
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
              - generic [ref=e39]: To move
            - generic [ref=e42]: 7 tiles
          - generic [ref=e43]:
            - generic [ref=e44]: Score
            - generic [ref=e45]: "0"
        - generic [ref=e47]:
          - group "Your rack" [ref=e48]:
            - button "Blank, 0 points" [ref=e49] [cursor=pointer]:
              - generic [ref=e50]: "0"
            - button "E, 1 points" [ref=e51] [cursor=pointer]:
              - generic [ref=e52]: E
              - generic [ref=e53]: "1"
            - button "S, 1 points" [ref=e54] [cursor=pointer]:
              - generic [ref=e55]: S
              - generic [ref=e56]: "1"
            - button "Q, 10 points" [ref=e57] [cursor=pointer]:
              - generic [ref=e58]: Q
              - generic [ref=e59]: "10"
            - button "A, 1 points" [ref=e60] [cursor=pointer]:
              - generic [ref=e61]: A
              - generic [ref=e62]: "1"
            - button "B, 3 points" [ref=e63] [cursor=pointer]:
              - generic [ref=e64]: B
              - generic [ref=e65]: "3"
            - button "B, 3 points" [ref=e66] [cursor=pointer]:
              - generic [ref=e67]: B
              - generic [ref=e68]: "3"
          - generic [ref=e69]:
            - group "Word actions" [ref=e71]:
              - button "Play word" [disabled] [ref=e72]:
                - paragraph [ref=e75]: Play word
              - button "Pass, exchange & tools" [ref=e76] [cursor=pointer]:
                - paragraph [ref=e79]: Pass, exchange & tools
            - generic [ref=e80]:
              - paragraph [ref=e81]: You can plan a word while you wait. Play it when your turn begins.
              - status [ref=e83]: Choose a tile, then a square.
          - generic [ref=e85]:
            - region "Scrollable word board" [ref=e86]:
              - group "Word board, fifteen columns and fifteen rows" [ref=e87]:
                - generic [ref=e89]: a
                - generic [ref=e90]: b
                - generic [ref=e91]: c
                - generic [ref=e92]: d
                - generic [ref=e93]: e
                - generic [ref=e94]: f
                - generic [ref=e95]: g
                - generic [ref=e96]: h
                - generic [ref=e97]: i
                - generic [ref=e98]: j
                - generic [ref=e99]: k
                - generic [ref=e100]: l
                - generic [ref=e101]: m
                - generic [ref=e102]: "n"
                - generic [ref=e103]: o
                - generic [ref=e104]: "1"
                - button "2L, a1, double letter, empty" [ref=e105] [cursor=pointer]:
                  - generic [ref=e106]: 2L
                - button "b1, empty" [ref=e107] [cursor=pointer]
                - button "c1, empty" [ref=e108] [cursor=pointer]
                - button "d1, empty" [ref=e109] [cursor=pointer]
                - button "3W, e1, triple word, empty" [ref=e110] [cursor=pointer]:
                  - generic [ref=e111]: 3W
                - button "f1, empty" [ref=e112] [cursor=pointer]
                - button "g1, empty" [ref=e113] [cursor=pointer]
                - button "2L, h1, double letter, empty" [ref=e114] [cursor=pointer]:
                  - generic [ref=e115]: 2L
                - button "i1, empty" [ref=e116] [cursor=pointer]
                - button "j1, empty" [ref=e117] [cursor=pointer]
                - button "3W, k1, triple word, empty" [ref=e118] [cursor=pointer]:
                  - generic [ref=e119]: 3W
                - button "l1, empty" [ref=e120] [cursor=pointer]
                - button "m1, empty" [ref=e121] [cursor=pointer]
                - button "n1, empty" [ref=e122] [cursor=pointer]
                - button "2L, o1, double letter, empty" [ref=e123] [cursor=pointer]:
                  - generic [ref=e124]: 2L
                - generic [ref=e125]: "2"
                - button "a2, empty" [ref=e126] [cursor=pointer]
                - button "b2, empty" [ref=e127] [cursor=pointer]
                - button "c2, empty" [ref=e128] [cursor=pointer]
                - button "2L, d2, double letter, empty" [ref=e129] [cursor=pointer]:
                  - generic [ref=e130]: 2L
                - button "e2, empty" [ref=e131] [cursor=pointer]
                - button "f2, empty" [ref=e132] [cursor=pointer]
                - button "2W, g2, double word, empty" [ref=e133] [cursor=pointer]:
                  - generic [ref=e134]: 2W
                - button "h2, empty" [ref=e135] [cursor=pointer]
                - button "2W, i2, double word, empty" [ref=e136] [cursor=pointer]:
                  - generic [ref=e137]: 2W
                - button "j2, empty" [ref=e138] [cursor=pointer]
                - button "k2, empty" [ref=e139] [cursor=pointer]
                - button "2L, l2, double letter, empty" [ref=e140] [cursor=pointer]:
                  - generic [ref=e141]: 2L
                - button "m2, empty" [ref=e142] [cursor=pointer]
                - button "n2, empty" [ref=e143] [cursor=pointer]
                - button "o2, empty" [ref=e144] [cursor=pointer]
                - generic [ref=e145]: "3"
                - button "a3, empty" [ref=e146] [cursor=pointer]
                - button "b3, empty" [ref=e147] [cursor=pointer]
                - button "c3, empty" [ref=e148] [cursor=pointer]
                - button "d3, empty" [ref=e149] [cursor=pointer]
                - button "3L, e3, triple letter, empty" [ref=e150] [cursor=pointer]:
                  - generic [ref=e151]: 3L
                - button "f3, empty" [ref=e152] [cursor=pointer]
                - button "g3, empty" [ref=e153] [cursor=pointer]
                - button "h3, empty" [ref=e154] [cursor=pointer]
                - button "i3, empty" [ref=e155] [cursor=pointer]
                - button "j3, empty" [ref=e156] [cursor=pointer]
                - button "3L, k3, triple letter, empty" [ref=e157] [cursor=pointer]:
                  - generic [ref=e158]: 3L
                - button "l3, empty" [ref=e159] [cursor=pointer]
                - button "m3, empty" [ref=e160] [cursor=pointer]
                - button "n3, empty" [ref=e161] [cursor=pointer]
                - button "o3, empty" [ref=e162] [cursor=pointer]
                - generic [ref=e163]: "4"
                - button "a4, empty" [ref=e164] [cursor=pointer]
                - button "2L, b4, double letter, empty" [ref=e165] [cursor=pointer]:
                  - generic [ref=e166]: 2L
                - button "c4, empty" [ref=e167] [cursor=pointer]
                - button "2W, d4, double word, empty" [ref=e168] [cursor=pointer]:
                  - generic [ref=e169]: 2W
                - button "e4, empty" [ref=e170] [cursor=pointer]
                - button "f4, empty" [ref=e171] [cursor=pointer]
                - button "g4, empty" [ref=e172] [cursor=pointer]
                - button "h4, empty" [ref=e173] [cursor=pointer]
                - button "i4, empty" [ref=e174] [cursor=pointer]
                - button "j4, empty" [ref=e175] [cursor=pointer]
                - button "k4, empty" [ref=e176] [cursor=pointer]
                - button "2W, l4, double word, empty" [ref=e177] [cursor=pointer]:
                  - generic [ref=e178]: 2W
                - button "m4, empty" [ref=e179] [cursor=pointer]
                - button "2L, n4, double letter, empty" [ref=e180] [cursor=pointer]:
                  - generic [ref=e181]: 2L
                - button "o4, empty" [ref=e182] [cursor=pointer]
                - generic [ref=e183]: "5"
                - button "3W, a5, triple word, empty" [ref=e184] [cursor=pointer]:
                  - generic [ref=e185]: 3W
                - button "b5, empty" [ref=e186] [cursor=pointer]
                - button "3L, c5, triple letter, empty" [ref=e187] [cursor=pointer]:
                  - generic [ref=e188]: 3L
                - button "d5, empty" [ref=e189] [cursor=pointer]
                - button "e5, empty" [ref=e190] [cursor=pointer]
                - button "f5, empty" [ref=e191] [cursor=pointer]
                - button "2L, g5, double letter, empty" [ref=e192] [cursor=pointer]:
                  - generic [ref=e193]: 2L
                - button "h5, empty" [ref=e194] [cursor=pointer]
                - button "2L, i5, double letter, empty" [ref=e195] [cursor=pointer]:
                  - generic [ref=e196]: 2L
                - button "j5, empty" [ref=e197] [cursor=pointer]
                - button "k5, empty" [ref=e198] [cursor=pointer]
                - button "l5, empty" [ref=e199] [cursor=pointer]
                - button "3L, m5, triple letter, empty" [ref=e200] [cursor=pointer]:
                  - generic [ref=e201]: 3L
                - button "n5, empty" [ref=e202] [cursor=pointer]
                - button "3W, o5, triple word, empty" [ref=e203] [cursor=pointer]:
                  - generic [ref=e204]: 3W
                - generic [ref=e205]: "6"
                - button "a6, empty" [ref=e206] [cursor=pointer]
                - button "b6, empty" [ref=e207] [cursor=pointer]
                - button "c6, empty" [ref=e208] [cursor=pointer]
                - button "d6, empty" [ref=e209] [cursor=pointer]
                - button "e6, empty" [ref=e210] [cursor=pointer]
                - button "f6, empty" [ref=e211] [cursor=pointer]
                - button "g6, empty" [ref=e212] [cursor=pointer]
                - button "3L, h6, triple letter, empty" [ref=e213] [cursor=pointer]:
                  - generic [ref=e214]: 3L
                - button "i6, empty" [ref=e215] [cursor=pointer]
                - button "j6, empty" [ref=e216] [cursor=pointer]
                - button "k6, empty" [ref=e217] [cursor=pointer]
                - button "l6, empty" [ref=e218] [cursor=pointer]
                - button "m6, empty" [ref=e219] [cursor=pointer]
                - button "n6, empty" [ref=e220] [cursor=pointer]
                - button "o6, empty" [ref=e221] [cursor=pointer]
                - generic [ref=e222]: "7"
                - button "a7, empty" [ref=e223] [cursor=pointer]
                - button "2W, b7, double word, empty" [ref=e224] [cursor=pointer]:
                  - generic [ref=e225]: 2W
                - button "c7, empty" [ref=e226] [cursor=pointer]
                - button "d7, empty" [ref=e227] [cursor=pointer]
                - button "2L, e7, double letter, empty" [ref=e228] [cursor=pointer]:
                  - generic [ref=e229]: 2L
                - button "f7, empty" [ref=e230] [cursor=pointer]
                - button "2L, g7, double letter, empty" [ref=e231] [cursor=pointer]:
                  - generic [ref=e232]: 2L
                - button "h7, empty" [ref=e233] [cursor=pointer]
                - button "2L, i7, double letter, empty" [ref=e234] [cursor=pointer]:
                  - generic [ref=e235]: 2L
                - button "j7, empty" [ref=e236] [cursor=pointer]
                - button "2L, k7, double letter, empty" [ref=e237] [cursor=pointer]:
                  - generic [ref=e238]: 2L
                - button "l7, empty" [ref=e239] [cursor=pointer]
                - button "m7, empty" [ref=e240] [cursor=pointer]
                - button "2W, n7, double word, empty" [ref=e241] [cursor=pointer]:
                  - generic [ref=e242]: 2W
                - button "o7, empty" [ref=e243] [cursor=pointer]
                - generic [ref=e244]: "8"
                - button "2L, a8, double letter, empty" [ref=e245] [cursor=pointer]:
                  - generic [ref=e246]: 2L
                - button "b8, empty" [ref=e247] [cursor=pointer]
                - button "c8, empty" [ref=e248] [cursor=pointer]
                - button "d8, empty" [ref=e249] [cursor=pointer]
                - button "e8, empty" [ref=e250] [cursor=pointer]
                - button "3L, f8, triple letter, empty" [ref=e251] [cursor=pointer]:
                  - generic [ref=e252]: 3L
                - button "C 3, g8, committed" [disabled] [ref=e253]:
                  - generic [ref=e254]: C
                  - generic [ref=e255]: "3"
                - button "A 1, h8, committed" [disabled] [ref=e256]:
                  - generic [ref=e257]: A
                  - generic [ref=e258]: "1"
                - button "T 1, i8, committed" [disabled] [ref=e259]:
                  - generic [ref=e260]: T
                  - generic [ref=e261]: "1"
                - button "3L, j8, triple letter, empty" [ref=e262] [cursor=pointer]:
                  - generic [ref=e263]: 3L
                - button "k8, empty" [ref=e264] [cursor=pointer]
                - button "l8, empty" [ref=e265] [cursor=pointer]
                - button "m8, empty" [ref=e266] [cursor=pointer]
                - button "n8, empty" [ref=e267] [cursor=pointer]
                - button "2L, o8, double letter, empty" [ref=e268] [cursor=pointer]:
                  - generic [ref=e269]: 2L
                - generic [ref=e270]: "9"
                - button "a9, empty" [ref=e271] [cursor=pointer]
                - button "2W, b9, double word, empty" [ref=e272] [cursor=pointer]:
                  - generic [ref=e273]: 2W
                - button "c9, empty" [ref=e274] [cursor=pointer]
                - button "d9, empty" [ref=e275] [cursor=pointer]
                - button "2L, e9, double letter, empty" [ref=e276] [cursor=pointer]:
                  - generic [ref=e277]: 2L
                - button "f9, empty" [ref=e278] [cursor=pointer]
                - button "2L, g9, double letter, empty" [ref=e279] [cursor=pointer]:
                  - generic [ref=e280]: 2L
                - button "h9, empty" [ref=e281] [cursor=pointer]
                - button "2L, i9, double letter, empty" [ref=e282] [cursor=pointer]:
                  - generic [ref=e283]: 2L
                - button "j9, empty" [ref=e284] [cursor=pointer]
                - button "2L, k9, double letter, empty" [ref=e285] [cursor=pointer]:
                  - generic [ref=e286]: 2L
                - button "l9, empty" [ref=e287] [cursor=pointer]
                - button "m9, empty" [ref=e288] [cursor=pointer]
                - button "2W, n9, double word, empty" [ref=e289] [cursor=pointer]:
                  - generic [ref=e290]: 2W
                - button "o9, empty" [ref=e291] [cursor=pointer]
                - generic [ref=e292]: "10"
                - button "a10, empty" [ref=e293] [cursor=pointer]
                - button "b10, empty" [ref=e294] [cursor=pointer]
                - button "c10, empty" [ref=e295] [cursor=pointer]
                - button "d10, empty" [ref=e296] [cursor=pointer]
                - button "e10, empty" [ref=e297] [cursor=pointer]
                - button "f10, empty" [ref=e298] [cursor=pointer]
                - button "g10, empty" [ref=e299] [cursor=pointer]
                - button "3L, h10, triple letter, empty" [ref=e300] [cursor=pointer]:
                  - generic [ref=e301]: 3L
                - button "i10, empty" [ref=e302] [cursor=pointer]
                - button "j10, empty" [ref=e303] [cursor=pointer]
                - button "k10, empty" [ref=e304] [cursor=pointer]
                - button "l10, empty" [ref=e305] [cursor=pointer]
                - button "m10, empty" [ref=e306] [cursor=pointer]
                - button "n10, empty" [ref=e307] [cursor=pointer]
                - button "o10, empty" [ref=e308] [cursor=pointer]
                - generic [ref=e309]: "11"
                - button "3W, a11, triple word, empty" [ref=e310] [cursor=pointer]:
                  - generic [ref=e311]: 3W
                - button "b11, empty" [ref=e312] [cursor=pointer]
                - button "3L, c11, triple letter, empty" [ref=e313] [cursor=pointer]:
                  - generic [ref=e314]: 3L
                - button "d11, empty" [ref=e315] [cursor=pointer]
                - button "e11, empty" [ref=e316] [cursor=pointer]
                - button "f11, empty" [ref=e317] [cursor=pointer]
                - button "2L, g11, double letter, empty" [ref=e318] [cursor=pointer]:
                  - generic [ref=e319]: 2L
                - button "h11, empty" [ref=e320] [cursor=pointer]
                - button "2L, i11, double letter, empty" [ref=e321] [cursor=pointer]:
                  - generic [ref=e322]: 2L
                - button "j11, empty" [ref=e323] [cursor=pointer]
                - button "k11, empty" [ref=e324] [cursor=pointer]
                - button "l11, empty" [ref=e325] [cursor=pointer]
                - button "3L, m11, triple letter, empty" [ref=e326] [cursor=pointer]:
                  - generic [ref=e327]: 3L
                - button "n11, empty" [ref=e328] [cursor=pointer]
                - button "3W, o11, triple word, empty" [ref=e329] [cursor=pointer]:
                  - generic [ref=e330]: 3W
                - generic [ref=e331]: "12"
                - button "a12, empty" [ref=e332] [cursor=pointer]
                - button "2L, b12, double letter, empty" [ref=e333] [cursor=pointer]:
                  - generic [ref=e334]: 2L
                - button "c12, empty" [ref=e335] [cursor=pointer]
                - button "2W, d12, double word, empty" [ref=e336] [cursor=pointer]:
                  - generic [ref=e337]: 2W
                - button "e12, empty" [ref=e338] [cursor=pointer]
                - button "f12, empty" [ref=e339] [cursor=pointer]
                - button "g12, empty" [ref=e340] [cursor=pointer]
                - button "h12, empty" [ref=e341] [cursor=pointer]
                - button "i12, empty" [ref=e342] [cursor=pointer]
                - button "j12, empty" [ref=e343] [cursor=pointer]
                - button "k12, empty" [ref=e344] [cursor=pointer]
                - button "2W, l12, double word, empty" [ref=e345] [cursor=pointer]:
                  - generic [ref=e346]: 2W
                - button "m12, empty" [ref=e347] [cursor=pointer]
                - button "2L, n12, double letter, empty" [ref=e348] [cursor=pointer]:
                  - generic [ref=e349]: 2L
                - button "o12, empty" [ref=e350] [cursor=pointer]
                - generic [ref=e351]: "13"
                - button "a13, empty" [ref=e352] [cursor=pointer]
                - button "b13, empty" [ref=e353] [cursor=pointer]
                - button "c13, empty" [ref=e354] [cursor=pointer]
                - button "d13, empty" [ref=e355] [cursor=pointer]
                - button "3L, e13, triple letter, empty" [ref=e356] [cursor=pointer]:
                  - generic [ref=e357]: 3L
                - button "f13, empty" [ref=e358] [cursor=pointer]
                - button "g13, empty" [ref=e359] [cursor=pointer]
                - button "h13, empty" [ref=e360] [cursor=pointer]
                - button "i13, empty" [ref=e361] [cursor=pointer]
                - button "j13, empty" [ref=e362] [cursor=pointer]
                - button "3L, k13, triple letter, empty" [ref=e363] [cursor=pointer]:
                  - generic [ref=e364]: 3L
                - button "l13, empty" [ref=e365] [cursor=pointer]
                - button "m13, empty" [ref=e366] [cursor=pointer]
                - button "n13, empty" [ref=e367] [cursor=pointer]
                - button "o13, empty" [ref=e368] [cursor=pointer]
                - generic [ref=e369]: "14"
                - button "a14, empty" [ref=e370] [cursor=pointer]
                - button "b14, empty" [ref=e371] [cursor=pointer]
                - button "c14, empty" [ref=e372] [cursor=pointer]
                - button "2L, d14, double letter, empty" [ref=e373] [cursor=pointer]:
                  - generic [ref=e374]: 2L
                - button "e14, empty" [ref=e375] [cursor=pointer]
                - button "f14, empty" [ref=e376] [cursor=pointer]
                - button "2W, g14, double word, empty" [ref=e377] [cursor=pointer]:
                  - generic [ref=e378]: 2W
                - button "h14, empty" [ref=e379] [cursor=pointer]
                - button "2W, i14, double word, empty" [ref=e380] [cursor=pointer]:
                  - generic [ref=e381]: 2W
                - button "j14, empty" [ref=e382] [cursor=pointer]
                - button "k14, empty" [ref=e383] [cursor=pointer]
                - button "2L, l14, double letter, empty" [ref=e384] [cursor=pointer]:
                  - generic [ref=e385]: 2L
                - button "m14, empty" [ref=e386] [cursor=pointer]
                - button "n14, empty" [ref=e387] [cursor=pointer]
                - button "o14, empty" [ref=e388] [cursor=pointer]
                - generic [ref=e389]: "15"
                - button "2L, a15, double letter, empty" [ref=e390] [cursor=pointer]:
                  - generic [ref=e391]: 2L
                - button "b15, empty" [ref=e392] [cursor=pointer]
                - button "c15, empty" [ref=e393] [cursor=pointer]
                - button "d15, empty" [ref=e394] [cursor=pointer]
                - button "3W, e15, triple word, empty" [ref=e395] [cursor=pointer]:
                  - generic [ref=e396]: 3W
                - button "f15, empty" [ref=e397] [cursor=pointer]
                - button "g15, empty" [ref=e398] [cursor=pointer]
                - button "2L, h15, double letter, empty" [ref=e399] [cursor=pointer]:
                  - generic [ref=e400]: 2L
                - button "i15, empty" [ref=e401] [cursor=pointer]
                - button "j15, empty" [ref=e402] [cursor=pointer]
                - button "3W, k15, triple word, empty" [ref=e403] [cursor=pointer]:
                  - generic [ref=e404]: 3W
                - button "l15, empty" [ref=e405] [cursor=pointer]
                - button "m15, empty" [ref=e406] [cursor=pointer]
                - button "n15, empty" [ref=e407] [cursor=pointer]
                - button "2L, o15, double letter, empty" [ref=e408] [cursor=pointer]:
                  - generic [ref=e409]: 2L
            - generic [ref=e410]:
              - generic [ref=e411]:
                - img "Whole board overview; outline shows the enlarged area" [ref=e412]
                - group "View a board region" [ref=e639]:
                  - button "View a1 to e5" [ref=e640] [cursor=pointer]
                  - button "View f1 to j5" [ref=e641] [cursor=pointer]
                  - button "View k1 to o5" [ref=e642] [cursor=pointer]
                  - button "View a6 to e10" [ref=e643] [cursor=pointer]
                  - button "View f6 to j10" [ref=e644] [cursor=pointer]
                  - button "View k6 to o10" [ref=e645] [cursor=pointer]
                  - button "View a11 to e15" [ref=e646] [cursor=pointer]
                  - button "View f11 to j15" [ref=e647] [cursor=pointer]
                  - button "View k11 to o15" [ref=e648] [cursor=pointer]
              - generic [ref=e649]:
                - generic [ref=e650]:
                  - button "Fit board" [ref=e651] [cursor=pointer]:
                    - paragraph [ref=e654]: Fit board
                  - button "Enlarge board" [pressed] [ref=e655] [cursor=pointer]:
                    - paragraph [ref=e658]: Enlarge board
                - paragraph [ref=e659]: T 1, i8, committed
                - 'button "Board map: locate a square" [ref=e660] [cursor=pointer]': Map
        - status [ref=e662]:
          - generic [ref=e663]:
            - generic [ref=e664]: "Amber: avery. Teal: jordan_plays."
            - text: Teal — to play · 83 tiles in the bag
        - generic [ref=e667]:
          - generic [ref=e671]:
            - generic [ref=e672]:
              - img "Amber" [ref=e673]
              - generic "avery" [ref=e676]
            - generic [ref=e679]: 7 tiles
          - generic [ref=e680]:
            - generic [ref=e681]: Score
            - generic [ref=e682]: "10"
      - region "Game record" [ref=e685]:
        - generic [ref=e686]:
          - heading "Game record" [level=2] [ref=e688]
          - paragraph [ref=e689]: Teal — to play · 83 tiles in the bag
        - generic [ref=e691]:
          - group "Game actions" [ref=e692]:
            - button "Offer draw" [ref=e693] [cursor=pointer]:
              - paragraph [ref=e696]: Offer draw
            - button "Resign game" [ref=e697] [cursor=pointer]:
              - paragraph [ref=e700]:
                - text: Resign
                - generic [ref=e701]: game
          - button "History and stats" [ref=e702] [cursor=pointer]:
            - paragraph [ref=e705]: History and stats
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/recover-and-submit-dark-1440.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```