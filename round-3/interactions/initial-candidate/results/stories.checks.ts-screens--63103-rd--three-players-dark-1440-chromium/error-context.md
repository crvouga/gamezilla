# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--three-players dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  112873 pixels (ratio 0.10 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/three-players-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/three-players-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 112873 pixels (ratio 0.10 of all image pixels) are different.
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
  - 112873 pixels (ratio 0.10 of all image pixels) are different.

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
        - list "Other players" [ref=e28]:
          - listitem [ref=e29]:
            - generic [ref=e33]:
              - generic [ref=e34]: jordan_plays
              - generic [ref=e35]:
                - generic [ref=e37]: Score 3
                - generic [ref=e39]: 7 tiles
          - listitem [ref=e40]:
            - generic [ref=e44]:
              - generic [ref=e45]: morgan
              - generic [ref=e46]:
                - generic [ref=e48]: Score 0
                - generic [ref=e50]: 7 tiles
        - generic [ref=e52]:
          - group "Your rack" [ref=e53]:
            - button "O, 1 points" [ref=e54] [cursor=pointer]:
              - generic [ref=e55]: O
              - generic [ref=e56]: "1"
            - button "E, 1 points" [ref=e57] [cursor=pointer]:
              - generic [ref=e58]: E
              - generic [ref=e59]: "1"
            - button "R, 1 points" [ref=e60] [cursor=pointer]:
              - generic [ref=e61]: R
              - generic [ref=e62]: "1"
            - button "T, 1 points" [ref=e63] [cursor=pointer]:
              - generic [ref=e64]: T
              - generic [ref=e65]: "1"
            - button "I, 1 points" [ref=e66] [cursor=pointer]:
              - generic [ref=e67]: I
              - generic [ref=e68]: "1"
            - button "N, 1 points" [ref=e69] [cursor=pointer]:
              - generic [ref=e70]: "N"
              - generic [ref=e71]: "1"
            - button "Blank, 0 points" [ref=e72] [cursor=pointer]:
              - generic [ref=e73]: "0"
          - generic [ref=e74]:
            - button "Play word" [disabled] [ref=e75]:
              - paragraph [ref=e78]: Play word
            - status [ref=e81]: Choose a tile, then a square.
          - generic [ref=e82]:
            - generic [ref=e83]:
              - button "Fit board" [pressed] [ref=e84] [cursor=pointer]:
                - paragraph [ref=e87]: Fit board
              - button "Enlarge board" [ref=e88] [cursor=pointer]:
                - paragraph [ref=e91]: Enlarge board
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
                - button "C 3, g8, committed" [disabled] [ref=e259]:
                  - generic [ref=e260]: C
                  - generic [ref=e261]: "3"
                - button "A 1, h8, committed" [disabled] [ref=e262]:
                  - generic [ref=e263]: A
                  - generic [ref=e264]: "1"
                - button "T 1, i8, committed" [disabled] [ref=e265]:
                  - generic [ref=e266]: T
                  - generic [ref=e267]: "1"
                - button "3L, j8, triple letter, empty" [ref=e268] [cursor=pointer]:
                  - generic [ref=e269]: 3L
                - button "k8, empty" [ref=e270] [cursor=pointer]
                - button "l8, empty" [ref=e271] [cursor=pointer]
                - button "m8, empty" [ref=e272] [cursor=pointer]
                - button "n8, empty" [ref=e273] [cursor=pointer]
                - button "2L, o8, double letter, empty" [ref=e274] [cursor=pointer]:
                  - generic [ref=e275]: 2L
                - generic [ref=e276]: "9"
                - button "a9, empty" [ref=e277] [cursor=pointer]
                - button "2W, b9, double word, empty" [ref=e278] [cursor=pointer]:
                  - generic [ref=e279]: 2W
                - button "c9, empty" [ref=e280] [cursor=pointer]
                - button "d9, empty" [ref=e281] [cursor=pointer]
                - button "2L, e9, double letter, empty" [ref=e282] [cursor=pointer]:
                  - generic [ref=e283]: 2L
                - button "f9, empty" [ref=e284] [cursor=pointer]
                - button "2L, g9, double letter, empty" [ref=e285] [cursor=pointer]:
                  - generic [ref=e286]: 2L
                - button "h9, empty" [ref=e287] [cursor=pointer]
                - button "O 1, i9, committed" [disabled] [ref=e288]:
                  - generic [ref=e289]: O
                  - generic [ref=e290]: "1"
                - button "j9, empty" [ref=e291] [cursor=pointer]
                - button "2L, k9, double letter, empty" [ref=e292] [cursor=pointer]:
                  - generic [ref=e293]: 2L
                - button "l9, empty" [ref=e294] [cursor=pointer]
                - button "m9, empty" [ref=e295] [cursor=pointer]
                - button "2W, n9, double word, empty" [ref=e296] [cursor=pointer]:
                  - generic [ref=e297]: 2W
                - button "o9, empty" [ref=e298] [cursor=pointer]
                - generic [ref=e299]: "10"
                - button "a10, empty" [ref=e300] [cursor=pointer]
                - button "b10, empty" [ref=e301] [cursor=pointer]
                - button "c10, empty" [ref=e302] [cursor=pointer]
                - button "d10, empty" [ref=e303] [cursor=pointer]
                - button "e10, empty" [ref=e304] [cursor=pointer]
                - button "f10, empty" [ref=e305] [cursor=pointer]
                - button "g10, empty" [ref=e306] [cursor=pointer]
                - button "3L, h10, triple letter, empty" [ref=e307] [cursor=pointer]:
                  - generic [ref=e308]: 3L
                - button "E 1, i10, committed" [disabled] [ref=e309]:
                  - generic [ref=e310]: E
                  - generic [ref=e311]: "1"
                - button "j10, empty" [ref=e312] [cursor=pointer]
                - button "k10, empty" [ref=e313] [cursor=pointer]
                - button "l10, empty" [ref=e314] [cursor=pointer]
                - button "m10, empty" [ref=e315] [cursor=pointer]
                - button "n10, empty" [ref=e316] [cursor=pointer]
                - button "o10, empty" [ref=e317] [cursor=pointer]
                - generic [ref=e318]: "11"
                - button "3W, a11, triple word, empty" [ref=e319] [cursor=pointer]:
                  - generic [ref=e320]: 3W
                - button "b11, empty" [ref=e321] [cursor=pointer]
                - button "3L, c11, triple letter, empty" [ref=e322] [cursor=pointer]:
                  - generic [ref=e323]: 3L
                - button "d11, empty" [ref=e324] [cursor=pointer]
                - button "e11, empty" [ref=e325] [cursor=pointer]
                - button "f11, empty" [ref=e326] [cursor=pointer]
                - button "2L, g11, double letter, empty" [ref=e327] [cursor=pointer]:
                  - generic [ref=e328]: 2L
                - button "h11, empty" [ref=e329] [cursor=pointer]
                - button "2L, i11, double letter, empty" [ref=e330] [cursor=pointer]:
                  - generic [ref=e331]: 2L
                - button "j11, empty" [ref=e332] [cursor=pointer]
                - button "k11, empty" [ref=e333] [cursor=pointer]
                - button "l11, empty" [ref=e334] [cursor=pointer]
                - button "3L, m11, triple letter, empty" [ref=e335] [cursor=pointer]:
                  - generic [ref=e336]: 3L
                - button "n11, empty" [ref=e337] [cursor=pointer]
                - button "3W, o11, triple word, empty" [ref=e338] [cursor=pointer]:
                  - generic [ref=e339]: 3W
                - generic [ref=e340]: "12"
                - button "a12, empty" [ref=e341] [cursor=pointer]
                - button "2L, b12, double letter, empty" [ref=e342] [cursor=pointer]:
                  - generic [ref=e343]: 2L
                - button "c12, empty" [ref=e344] [cursor=pointer]
                - button "2W, d12, double word, empty" [ref=e345] [cursor=pointer]:
                  - generic [ref=e346]: 2W
                - button "e12, empty" [ref=e347] [cursor=pointer]
                - button "f12, empty" [ref=e348] [cursor=pointer]
                - button "g12, empty" [ref=e349] [cursor=pointer]
                - button "h12, empty" [ref=e350] [cursor=pointer]
                - button "i12, empty" [ref=e351] [cursor=pointer]
                - button "j12, empty" [ref=e352] [cursor=pointer]
                - button "k12, empty" [ref=e353] [cursor=pointer]
                - button "2W, l12, double word, empty" [ref=e354] [cursor=pointer]:
                  - generic [ref=e355]: 2W
                - button "m12, empty" [ref=e356] [cursor=pointer]
                - button "2L, n12, double letter, empty" [ref=e357] [cursor=pointer]:
                  - generic [ref=e358]: 2L
                - button "o12, empty" [ref=e359] [cursor=pointer]
                - generic [ref=e360]: "13"
                - button "a13, empty" [ref=e361] [cursor=pointer]
                - button "b13, empty" [ref=e362] [cursor=pointer]
                - button "c13, empty" [ref=e363] [cursor=pointer]
                - button "d13, empty" [ref=e364] [cursor=pointer]
                - button "3L, e13, triple letter, empty" [ref=e365] [cursor=pointer]:
                  - generic [ref=e366]: 3L
                - button "f13, empty" [ref=e367] [cursor=pointer]
                - button "g13, empty" [ref=e368] [cursor=pointer]
                - button "h13, empty" [ref=e369] [cursor=pointer]
                - button "i13, empty" [ref=e370] [cursor=pointer]
                - button "j13, empty" [ref=e371] [cursor=pointer]
                - button "3L, k13, triple letter, empty" [ref=e372] [cursor=pointer]:
                  - generic [ref=e373]: 3L
                - button "l13, empty" [ref=e374] [cursor=pointer]
                - button "m13, empty" [ref=e375] [cursor=pointer]
                - button "n13, empty" [ref=e376] [cursor=pointer]
                - button "o13, empty" [ref=e377] [cursor=pointer]
                - generic [ref=e378]: "14"
                - button "a14, empty" [ref=e379] [cursor=pointer]
                - button "b14, empty" [ref=e380] [cursor=pointer]
                - button "c14, empty" [ref=e381] [cursor=pointer]
                - button "2L, d14, double letter, empty" [ref=e382] [cursor=pointer]:
                  - generic [ref=e383]: 2L
                - button "e14, empty" [ref=e384] [cursor=pointer]
                - button "f14, empty" [ref=e385] [cursor=pointer]
                - button "2W, g14, double word, empty" [ref=e386] [cursor=pointer]:
                  - generic [ref=e387]: 2W
                - button "h14, empty" [ref=e388] [cursor=pointer]
                - button "2W, i14, double word, empty" [ref=e389] [cursor=pointer]:
                  - generic [ref=e390]: 2W
                - button "j14, empty" [ref=e391] [cursor=pointer]
                - button "k14, empty" [ref=e392] [cursor=pointer]
                - button "2L, l14, double letter, empty" [ref=e393] [cursor=pointer]:
                  - generic [ref=e394]: 2L
                - button "m14, empty" [ref=e395] [cursor=pointer]
                - button "n14, empty" [ref=e396] [cursor=pointer]
                - button "o14, empty" [ref=e397] [cursor=pointer]
                - generic [ref=e398]: "15"
                - button "2L, a15, double letter, empty" [ref=e399] [cursor=pointer]:
                  - generic [ref=e400]: 2L
                - button "b15, empty" [ref=e401] [cursor=pointer]
                - button "c15, empty" [ref=e402] [cursor=pointer]
                - button "d15, empty" [ref=e403] [cursor=pointer]
                - button "3W, e15, triple word, empty" [ref=e404] [cursor=pointer]:
                  - generic [ref=e405]: 3W
                - button "f15, empty" [ref=e406] [cursor=pointer]
                - button "g15, empty" [ref=e407] [cursor=pointer]
                - button "2L, h15, double letter, empty" [ref=e408] [cursor=pointer]:
                  - generic [ref=e409]: 2L
                - button "i15, empty" [ref=e410] [cursor=pointer]
                - button "j15, empty" [ref=e411] [cursor=pointer]
                - button "3W, k15, triple word, empty" [ref=e412] [cursor=pointer]:
                  - generic [ref=e413]: 3W
                - button "l15, empty" [ref=e414] [cursor=pointer]
                - button "m15, empty" [ref=e415] [cursor=pointer]
                - button "n15, empty" [ref=e416] [cursor=pointer]
                - button "2L, o15, double letter, empty" [ref=e417] [cursor=pointer]:
                  - generic [ref=e418]: 2L
        - status [ref=e420]:
          - generic [ref=e421]:
            - generic [ref=e422]: "Amber: avery. Teal: jordan_plays. Violet: morgan."
            - text: Amber — to play · 74 tiles in the bag
        - generic [ref=e425]:
          - generic [ref=e429]:
            - generic [ref=e430]:
              - img "Amber" [ref=e431]
              - generic [ref=e432]: avery
              - generic [ref=e433]: Your move
            - generic [ref=e436]: 7 tiles
          - generic [ref=e437]:
            - generic [ref=e438]: Score
            - generic [ref=e439]: "10"
      - region "Game record" [ref=e442]:
        - generic [ref=e443]:
          - heading "Game record" [level=2] [ref=e445]
          - paragraph [ref=e446]: Amber — to play · 74 tiles in the bag
        - generic [ref=e448]:
          - group "Game actions" [ref=e449]:
            - button "Recall tiles" [disabled] [ref=e450]:
              - paragraph [ref=e453]: Recall tiles
            - button "Undo" [disabled] [ref=e454]:
              - paragraph [ref=e457]: Undo
            - button "Redo" [disabled] [ref=e458]:
              - paragraph [ref=e461]: Redo
            - button "Shuffle rack" [ref=e462] [cursor=pointer]:
              - paragraph [ref=e465]: Shuffle rack
            - button "Pass" [ref=e466] [cursor=pointer]:
              - paragraph [ref=e469]: Pass
            - button "Exchange tiles" [ref=e470] [cursor=pointer]:
              - paragraph [ref=e473]: Exchange tiles
            - button "Offer draw" [ref=e474] [cursor=pointer]:
              - paragraph [ref=e477]: Offer draw
            - button "Resign game" [ref=e478] [cursor=pointer]:
              - paragraph [ref=e481]:
                - text: Resign
                - generic [ref=e482]: game
          - button "History and stats" [ref=e483] [cursor=pointer]:
            - paragraph [ref=e486]: History and stats
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