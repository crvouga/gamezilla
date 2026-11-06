# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--accepted-exchange dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  134494 pixels (ratio 0.12 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/accepted-exchange-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/accepted-exchange-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 134494 pixels (ratio 0.12 of all image pixels) are different.
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
  - 134494 pixels (ratio 0.12 of all image pixels) are different.

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
              - generic [ref=e37]: To move
            - generic [ref=e40]: 7 tiles
          - generic [ref=e41]:
            - generic [ref=e42]: Score
            - generic [ref=e43]: "0"
        - generic [ref=e45]:
          - group "Your rack" [ref=e46]:
            - button "A, 1 points" [ref=e47] [cursor=pointer]:
              - generic [ref=e48]: A
              - generic [ref=e49]: "1"
            - button "T, 1 points" [ref=e50] [cursor=pointer]:
              - generic [ref=e51]: T
              - generic [ref=e52]: "1"
            - button "Blank, 0 points" [ref=e53] [cursor=pointer]:
              - generic [ref=e54]: "0"
            - button "E, 1 points" [ref=e55] [cursor=pointer]:
              - generic [ref=e56]: E
              - generic [ref=e57]: "1"
            - button "S, 1 points" [ref=e58] [cursor=pointer]:
              - generic [ref=e59]: S
              - generic [ref=e60]: "1"
            - button "Q, 10 points" [ref=e61] [cursor=pointer]:
              - generic [ref=e62]: Q
              - generic [ref=e63]: "10"
            - button "A, 1 points" [ref=e64] [cursor=pointer]:
              - generic [ref=e65]: A
              - generic [ref=e66]: "1"
          - generic [ref=e67]:
            - button "Play word" [disabled] [ref=e68]:
              - paragraph [ref=e71]: Play word
            - generic [ref=e72]:
              - paragraph [ref=e73]: You can plan a word while you wait. Play it when your turn begins.
              - status [ref=e75]: Choose a tile, then a square.
          - generic [ref=e76]:
            - generic [ref=e77]:
              - button "Fit board" [pressed] [ref=e78] [cursor=pointer]:
                - paragraph [ref=e81]: Fit board
              - button "Enlarge board" [ref=e82] [cursor=pointer]:
                - paragraph [ref=e85]: Enlarge board
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
                - button "g8, empty" [ref=e253] [cursor=pointer]
                - button "★, h8, start, double word, empty" [ref=e254] [cursor=pointer]:
                  - generic [ref=e255]: ★
                - button "i8, empty" [ref=e256] [cursor=pointer]
                - button "3L, j8, triple letter, empty" [ref=e257] [cursor=pointer]:
                  - generic [ref=e258]: 3L
                - button "k8, empty" [ref=e259] [cursor=pointer]
                - button "l8, empty" [ref=e260] [cursor=pointer]
                - button "m8, empty" [ref=e261] [cursor=pointer]
                - button "n8, empty" [ref=e262] [cursor=pointer]
                - button "2L, o8, double letter, empty" [ref=e263] [cursor=pointer]:
                  - generic [ref=e264]: 2L
                - generic [ref=e265]: "9"
                - button "a9, empty" [ref=e266] [cursor=pointer]
                - button "2W, b9, double word, empty" [ref=e267] [cursor=pointer]:
                  - generic [ref=e268]: 2W
                - button "c9, empty" [ref=e269] [cursor=pointer]
                - button "d9, empty" [ref=e270] [cursor=pointer]
                - button "2L, e9, double letter, empty" [ref=e271] [cursor=pointer]:
                  - generic [ref=e272]: 2L
                - button "f9, empty" [ref=e273] [cursor=pointer]
                - button "2L, g9, double letter, empty" [ref=e274] [cursor=pointer]:
                  - generic [ref=e275]: 2L
                - button "h9, empty" [ref=e276] [cursor=pointer]
                - button "2L, i9, double letter, empty" [ref=e277] [cursor=pointer]:
                  - generic [ref=e278]: 2L
                - button "j9, empty" [ref=e279] [cursor=pointer]
                - button "2L, k9, double letter, empty" [ref=e280] [cursor=pointer]:
                  - generic [ref=e281]: 2L
                - button "l9, empty" [ref=e282] [cursor=pointer]
                - button "m9, empty" [ref=e283] [cursor=pointer]
                - button "2W, n9, double word, empty" [ref=e284] [cursor=pointer]:
                  - generic [ref=e285]: 2W
                - button "o9, empty" [ref=e286] [cursor=pointer]
                - generic [ref=e287]: "10"
                - button "a10, empty" [ref=e288] [cursor=pointer]
                - button "b10, empty" [ref=e289] [cursor=pointer]
                - button "c10, empty" [ref=e290] [cursor=pointer]
                - button "d10, empty" [ref=e291] [cursor=pointer]
                - button "e10, empty" [ref=e292] [cursor=pointer]
                - button "f10, empty" [ref=e293] [cursor=pointer]
                - button "g10, empty" [ref=e294] [cursor=pointer]
                - button "3L, h10, triple letter, empty" [ref=e295] [cursor=pointer]:
                  - generic [ref=e296]: 3L
                - button "i10, empty" [ref=e297] [cursor=pointer]
                - button "j10, empty" [ref=e298] [cursor=pointer]
                - button "k10, empty" [ref=e299] [cursor=pointer]
                - button "l10, empty" [ref=e300] [cursor=pointer]
                - button "m10, empty" [ref=e301] [cursor=pointer]
                - button "n10, empty" [ref=e302] [cursor=pointer]
                - button "o10, empty" [ref=e303] [cursor=pointer]
                - generic [ref=e304]: "11"
                - button "3W, a11, triple word, empty" [ref=e305] [cursor=pointer]:
                  - generic [ref=e306]: 3W
                - button "b11, empty" [ref=e307] [cursor=pointer]
                - button "3L, c11, triple letter, empty" [ref=e308] [cursor=pointer]:
                  - generic [ref=e309]: 3L
                - button "d11, empty" [ref=e310] [cursor=pointer]
                - button "e11, empty" [ref=e311] [cursor=pointer]
                - button "f11, empty" [ref=e312] [cursor=pointer]
                - button "2L, g11, double letter, empty" [ref=e313] [cursor=pointer]:
                  - generic [ref=e314]: 2L
                - button "h11, empty" [ref=e315] [cursor=pointer]
                - button "2L, i11, double letter, empty" [ref=e316] [cursor=pointer]:
                  - generic [ref=e317]: 2L
                - button "j11, empty" [ref=e318] [cursor=pointer]
                - button "k11, empty" [ref=e319] [cursor=pointer]
                - button "l11, empty" [ref=e320] [cursor=pointer]
                - button "3L, m11, triple letter, empty" [ref=e321] [cursor=pointer]:
                  - generic [ref=e322]: 3L
                - button "n11, empty" [ref=e323] [cursor=pointer]
                - button "3W, o11, triple word, empty" [ref=e324] [cursor=pointer]:
                  - generic [ref=e325]: 3W
                - generic [ref=e326]: "12"
                - button "a12, empty" [ref=e327] [cursor=pointer]
                - button "2L, b12, double letter, empty" [ref=e328] [cursor=pointer]:
                  - generic [ref=e329]: 2L
                - button "c12, empty" [ref=e330] [cursor=pointer]
                - button "2W, d12, double word, empty" [ref=e331] [cursor=pointer]:
                  - generic [ref=e332]: 2W
                - button "e12, empty" [ref=e333] [cursor=pointer]
                - button "f12, empty" [ref=e334] [cursor=pointer]
                - button "g12, empty" [ref=e335] [cursor=pointer]
                - button "h12, empty" [ref=e336] [cursor=pointer]
                - button "i12, empty" [ref=e337] [cursor=pointer]
                - button "j12, empty" [ref=e338] [cursor=pointer]
                - button "k12, empty" [ref=e339] [cursor=pointer]
                - button "2W, l12, double word, empty" [ref=e340] [cursor=pointer]:
                  - generic [ref=e341]: 2W
                - button "m12, empty" [ref=e342] [cursor=pointer]
                - button "2L, n12, double letter, empty" [ref=e343] [cursor=pointer]:
                  - generic [ref=e344]: 2L
                - button "o12, empty" [ref=e345] [cursor=pointer]
                - generic [ref=e346]: "13"
                - button "a13, empty" [ref=e347] [cursor=pointer]
                - button "b13, empty" [ref=e348] [cursor=pointer]
                - button "c13, empty" [ref=e349] [cursor=pointer]
                - button "d13, empty" [ref=e350] [cursor=pointer]
                - button "3L, e13, triple letter, empty" [ref=e351] [cursor=pointer]:
                  - generic [ref=e352]: 3L
                - button "f13, empty" [ref=e353] [cursor=pointer]
                - button "g13, empty" [ref=e354] [cursor=pointer]
                - button "h13, empty" [ref=e355] [cursor=pointer]
                - button "i13, empty" [ref=e356] [cursor=pointer]
                - button "j13, empty" [ref=e357] [cursor=pointer]
                - button "3L, k13, triple letter, empty" [ref=e358] [cursor=pointer]:
                  - generic [ref=e359]: 3L
                - button "l13, empty" [ref=e360] [cursor=pointer]
                - button "m13, empty" [ref=e361] [cursor=pointer]
                - button "n13, empty" [ref=e362] [cursor=pointer]
                - button "o13, empty" [ref=e363] [cursor=pointer]
                - generic [ref=e364]: "14"
                - button "a14, empty" [ref=e365] [cursor=pointer]
                - button "b14, empty" [ref=e366] [cursor=pointer]
                - button "c14, empty" [ref=e367] [cursor=pointer]
                - button "2L, d14, double letter, empty" [ref=e368] [cursor=pointer]:
                  - generic [ref=e369]: 2L
                - button "e14, empty" [ref=e370] [cursor=pointer]
                - button "f14, empty" [ref=e371] [cursor=pointer]
                - button "2W, g14, double word, empty" [ref=e372] [cursor=pointer]:
                  - generic [ref=e373]: 2W
                - button "h14, empty" [ref=e374] [cursor=pointer]
                - button "2W, i14, double word, empty" [ref=e375] [cursor=pointer]:
                  - generic [ref=e376]: 2W
                - button "j14, empty" [ref=e377] [cursor=pointer]
                - button "k14, empty" [ref=e378] [cursor=pointer]
                - button "2L, l14, double letter, empty" [ref=e379] [cursor=pointer]:
                  - generic [ref=e380]: 2L
                - button "m14, empty" [ref=e381] [cursor=pointer]
                - button "n14, empty" [ref=e382] [cursor=pointer]
                - button "o14, empty" [ref=e383] [cursor=pointer]
                - generic [ref=e384]: "15"
                - button "2L, a15, double letter, empty" [ref=e385] [cursor=pointer]:
                  - generic [ref=e386]: 2L
                - button "b15, empty" [ref=e387] [cursor=pointer]
                - button "c15, empty" [ref=e388] [cursor=pointer]
                - button "d15, empty" [ref=e389] [cursor=pointer]
                - button "3W, e15, triple word, empty" [ref=e390] [cursor=pointer]:
                  - generic [ref=e391]: 3W
                - button "f15, empty" [ref=e392] [cursor=pointer]
                - button "g15, empty" [ref=e393] [cursor=pointer]
                - button "2L, h15, double letter, empty" [ref=e394] [cursor=pointer]:
                  - generic [ref=e395]: 2L
                - button "i15, empty" [ref=e396] [cursor=pointer]
                - button "j15, empty" [ref=e397] [cursor=pointer]
                - button "3W, k15, triple word, empty" [ref=e398] [cursor=pointer]:
                  - generic [ref=e399]: 3W
                - button "l15, empty" [ref=e400] [cursor=pointer]
                - button "m15, empty" [ref=e401] [cursor=pointer]
                - button "n15, empty" [ref=e402] [cursor=pointer]
                - button "2L, o15, double letter, empty" [ref=e403] [cursor=pointer]:
                  - generic [ref=e404]: 2L
        - status [ref=e406]:
          - generic [ref=e407]:
            - generic [ref=e408]: "Amber: avery. Teal: jordan_plays."
            - text: Teal — to play · 86 tiles in the bag · 1 of 6 scoreless turns
        - generic [ref=e411]:
          - generic [ref=e415]:
            - generic [ref=e416]:
              - img "Amber" [ref=e417]
              - generic [ref=e418]: avery
            - generic [ref=e421]: 7 tiles
          - generic [ref=e422]:
            - generic [ref=e423]: Score
            - generic [ref=e424]: "0"
      - region "Game record" [ref=e427]:
        - generic [ref=e428]:
          - heading "Game record" [level=2] [ref=e430]
          - paragraph [ref=e431]: Teal — to play · 86 tiles in the bag · 1 of 6 scoreless turns
        - generic [ref=e433]:
          - group "Game actions" [ref=e434]:
            - button "Recall tiles" [disabled] [ref=e435]:
              - paragraph [ref=e438]: Recall tiles
            - button "Undo" [disabled] [ref=e439]:
              - paragraph [ref=e442]: Undo
            - button "Redo" [disabled] [ref=e443]:
              - paragraph [ref=e446]: Redo
            - button "Shuffle rack" [ref=e447] [cursor=pointer]:
              - paragraph [ref=e450]: Shuffle rack
            - button "Pass" [disabled] [ref=e451]:
              - paragraph [ref=e454]: Pass
            - button "Exchange tiles" [disabled] [ref=e455]:
              - paragraph [ref=e458]: Exchange tiles
            - button "Offer draw" [ref=e459] [cursor=pointer]:
              - paragraph [ref=e462]: Offer draw
            - button "Resign game" [ref=e463] [cursor=pointer]:
              - paragraph [ref=e466]:
                - text: Resign
                - generic [ref=e467]: game
          - button "History and stats" [ref=e468] [cursor=pointer]:
            - paragraph [ref=e471]: History and stats
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