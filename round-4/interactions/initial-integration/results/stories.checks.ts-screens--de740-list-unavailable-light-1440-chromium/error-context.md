# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--word-list-unavailable light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  143825 pixels (ratio 0.12 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/word-list-unavailable-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/word-list-unavailable-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 143825 pixels (ratio 0.12 of all image pixels) are different.
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
  - 143825 pixels (ratio 0.12 of all image pixels) are different.

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
          - status [ref=e45]: The word list could not load. Your draft is kept. Reload it to preview words, or play for the game to check them.
          - button "Load the word list again" [ref=e46] [cursor=pointer]:
            - paragraph [ref=e49]: Load the word list again
          - group "Your rack" [ref=e50]:
            - button "C, 3 points" [ref=e51] [cursor=pointer]:
              - generic [ref=e52]: C
              - generic [ref=e53]: "3"
            - button "A, 1 points" [ref=e54] [cursor=pointer]:
              - generic [ref=e55]: A
              - generic [ref=e56]: "1"
            - button "T, 1 points" [ref=e57] [cursor=pointer]:
              - generic [ref=e58]: T
              - generic [ref=e59]: "1"
            - button "Blank, 0 points" [ref=e60] [cursor=pointer]:
              - generic [ref=e61]: "0"
            - button "E, 1 points" [ref=e62] [cursor=pointer]:
              - generic [ref=e63]: E
              - generic [ref=e64]: "1"
            - button "S, 1 points" [ref=e65] [cursor=pointer]:
              - generic [ref=e66]: S
              - generic [ref=e67]: "1"
            - button "Q, 10 points" [ref=e68] [cursor=pointer]:
              - generic [ref=e69]: Q
              - generic [ref=e70]: "10"
          - generic [ref=e71]:
            - group "Word actions" [ref=e72]:
              - button "Play word" [disabled] [ref=e73]:
                - paragraph [ref=e76]: Play word
              - button "Recall tiles" [disabled] [ref=e77]:
                - paragraph [ref=e80]: Recall tiles
              - button "Undo" [disabled] [ref=e81]:
                - paragraph [ref=e84]: Undo
              - button "Redo" [disabled] [ref=e85]:
                - paragraph [ref=e88]: Redo
              - button "Shuffle rack" [ref=e89] [cursor=pointer]:
                - paragraph [ref=e92]: Shuffle rack
              - button "Pass" [ref=e93] [cursor=pointer]:
                - paragraph [ref=e96]: Pass
              - button "Exchange tiles" [ref=e97] [cursor=pointer]:
                - paragraph [ref=e100]: Exchange tiles
            - status [ref=e103]: Choose a tile, then a square.
          - generic [ref=e104]:
            - generic [ref=e105]:
              - button "Fit board" [pressed] [ref=e106] [cursor=pointer]:
                - paragraph [ref=e109]: Fit board
              - button "Enlarge board" [ref=e110] [cursor=pointer]:
                - paragraph [ref=e113]: Enlarge board
            - region "Scrollable word board" [ref=e115]:
              - group "Word board, fifteen columns and fifteen rows" [ref=e116]:
                - generic [ref=e118]: a
                - generic [ref=e119]: b
                - generic [ref=e120]: c
                - generic [ref=e121]: d
                - generic [ref=e122]: e
                - generic [ref=e123]: f
                - generic [ref=e124]: g
                - generic [ref=e125]: h
                - generic [ref=e126]: i
                - generic [ref=e127]: j
                - generic [ref=e128]: k
                - generic [ref=e129]: l
                - generic [ref=e130]: m
                - generic [ref=e131]: "n"
                - generic [ref=e132]: o
                - generic [ref=e133]: "1"
                - button "2L, a1, double letter, empty" [ref=e134] [cursor=pointer]:
                  - generic [ref=e135]: 2L
                - button "b1, empty" [ref=e136] [cursor=pointer]
                - button "c1, empty" [ref=e137] [cursor=pointer]
                - button "d1, empty" [ref=e138] [cursor=pointer]
                - button "3W, e1, triple word, empty" [ref=e139] [cursor=pointer]:
                  - generic [ref=e140]: 3W
                - button "f1, empty" [ref=e141] [cursor=pointer]
                - button "g1, empty" [ref=e142] [cursor=pointer]
                - button "2L, h1, double letter, empty" [ref=e143] [cursor=pointer]:
                  - generic [ref=e144]: 2L
                - button "i1, empty" [ref=e145] [cursor=pointer]
                - button "j1, empty" [ref=e146] [cursor=pointer]
                - button "3W, k1, triple word, empty" [ref=e147] [cursor=pointer]:
                  - generic [ref=e148]: 3W
                - button "l1, empty" [ref=e149] [cursor=pointer]
                - button "m1, empty" [ref=e150] [cursor=pointer]
                - button "n1, empty" [ref=e151] [cursor=pointer]
                - button "2L, o1, double letter, empty" [ref=e152] [cursor=pointer]:
                  - generic [ref=e153]: 2L
                - generic [ref=e154]: "2"
                - button "a2, empty" [ref=e155] [cursor=pointer]
                - button "b2, empty" [ref=e156] [cursor=pointer]
                - button "c2, empty" [ref=e157] [cursor=pointer]
                - button "2L, d2, double letter, empty" [ref=e158] [cursor=pointer]:
                  - generic [ref=e159]: 2L
                - button "e2, empty" [ref=e160] [cursor=pointer]
                - button "f2, empty" [ref=e161] [cursor=pointer]
                - button "2W, g2, double word, empty" [ref=e162] [cursor=pointer]:
                  - generic [ref=e163]: 2W
                - button "h2, empty" [ref=e164] [cursor=pointer]
                - button "2W, i2, double word, empty" [ref=e165] [cursor=pointer]:
                  - generic [ref=e166]: 2W
                - button "j2, empty" [ref=e167] [cursor=pointer]
                - button "k2, empty" [ref=e168] [cursor=pointer]
                - button "2L, l2, double letter, empty" [ref=e169] [cursor=pointer]:
                  - generic [ref=e170]: 2L
                - button "m2, empty" [ref=e171] [cursor=pointer]
                - button "n2, empty" [ref=e172] [cursor=pointer]
                - button "o2, empty" [ref=e173] [cursor=pointer]
                - generic [ref=e174]: "3"
                - button "a3, empty" [ref=e175] [cursor=pointer]
                - button "b3, empty" [ref=e176] [cursor=pointer]
                - button "c3, empty" [ref=e177] [cursor=pointer]
                - button "d3, empty" [ref=e178] [cursor=pointer]
                - button "3L, e3, triple letter, empty" [ref=e179] [cursor=pointer]:
                  - generic [ref=e180]: 3L
                - button "f3, empty" [ref=e181] [cursor=pointer]
                - button "g3, empty" [ref=e182] [cursor=pointer]
                - button "h3, empty" [ref=e183] [cursor=pointer]
                - button "i3, empty" [ref=e184] [cursor=pointer]
                - button "j3, empty" [ref=e185] [cursor=pointer]
                - button "3L, k3, triple letter, empty" [ref=e186] [cursor=pointer]:
                  - generic [ref=e187]: 3L
                - button "l3, empty" [ref=e188] [cursor=pointer]
                - button "m3, empty" [ref=e189] [cursor=pointer]
                - button "n3, empty" [ref=e190] [cursor=pointer]
                - button "o3, empty" [ref=e191] [cursor=pointer]
                - generic [ref=e192]: "4"
                - button "a4, empty" [ref=e193] [cursor=pointer]
                - button "2L, b4, double letter, empty" [ref=e194] [cursor=pointer]:
                  - generic [ref=e195]: 2L
                - button "c4, empty" [ref=e196] [cursor=pointer]
                - button "2W, d4, double word, empty" [ref=e197] [cursor=pointer]:
                  - generic [ref=e198]: 2W
                - button "e4, empty" [ref=e199] [cursor=pointer]
                - button "f4, empty" [ref=e200] [cursor=pointer]
                - button "g4, empty" [ref=e201] [cursor=pointer]
                - button "h4, empty" [ref=e202] [cursor=pointer]
                - button "i4, empty" [ref=e203] [cursor=pointer]
                - button "j4, empty" [ref=e204] [cursor=pointer]
                - button "k4, empty" [ref=e205] [cursor=pointer]
                - button "2W, l4, double word, empty" [ref=e206] [cursor=pointer]:
                  - generic [ref=e207]: 2W
                - button "m4, empty" [ref=e208] [cursor=pointer]
                - button "2L, n4, double letter, empty" [ref=e209] [cursor=pointer]:
                  - generic [ref=e210]: 2L
                - button "o4, empty" [ref=e211] [cursor=pointer]
                - generic [ref=e212]: "5"
                - button "3W, a5, triple word, empty" [ref=e213] [cursor=pointer]:
                  - generic [ref=e214]: 3W
                - button "b5, empty" [ref=e215] [cursor=pointer]
                - button "3L, c5, triple letter, empty" [ref=e216] [cursor=pointer]:
                  - generic [ref=e217]: 3L
                - button "d5, empty" [ref=e218] [cursor=pointer]
                - button "e5, empty" [ref=e219] [cursor=pointer]
                - button "f5, empty" [ref=e220] [cursor=pointer]
                - button "2L, g5, double letter, empty" [ref=e221] [cursor=pointer]:
                  - generic [ref=e222]: 2L
                - button "h5, empty" [ref=e223] [cursor=pointer]
                - button "2L, i5, double letter, empty" [ref=e224] [cursor=pointer]:
                  - generic [ref=e225]: 2L
                - button "j5, empty" [ref=e226] [cursor=pointer]
                - button "k5, empty" [ref=e227] [cursor=pointer]
                - button "l5, empty" [ref=e228] [cursor=pointer]
                - button "3L, m5, triple letter, empty" [ref=e229] [cursor=pointer]:
                  - generic [ref=e230]: 3L
                - button "n5, empty" [ref=e231] [cursor=pointer]
                - button "3W, o5, triple word, empty" [ref=e232] [cursor=pointer]:
                  - generic [ref=e233]: 3W
                - generic [ref=e234]: "6"
                - button "a6, empty" [ref=e235] [cursor=pointer]
                - button "b6, empty" [ref=e236] [cursor=pointer]
                - button "c6, empty" [ref=e237] [cursor=pointer]
                - button "d6, empty" [ref=e238] [cursor=pointer]
                - button "e6, empty" [ref=e239] [cursor=pointer]
                - button "f6, empty" [ref=e240] [cursor=pointer]
                - button "g6, empty" [ref=e241] [cursor=pointer]
                - button "3L, h6, triple letter, empty" [ref=e242] [cursor=pointer]:
                  - generic [ref=e243]: 3L
                - button "i6, empty" [ref=e244] [cursor=pointer]
                - button "j6, empty" [ref=e245] [cursor=pointer]
                - button "k6, empty" [ref=e246] [cursor=pointer]
                - button "l6, empty" [ref=e247] [cursor=pointer]
                - button "m6, empty" [ref=e248] [cursor=pointer]
                - button "n6, empty" [ref=e249] [cursor=pointer]
                - button "o6, empty" [ref=e250] [cursor=pointer]
                - generic [ref=e251]: "7"
                - button "a7, empty" [ref=e252] [cursor=pointer]
                - button "2W, b7, double word, empty" [ref=e253] [cursor=pointer]:
                  - generic [ref=e254]: 2W
                - button "c7, empty" [ref=e255] [cursor=pointer]
                - button "d7, empty" [ref=e256] [cursor=pointer]
                - button "2L, e7, double letter, empty" [ref=e257] [cursor=pointer]:
                  - generic [ref=e258]: 2L
                - button "f7, empty" [ref=e259] [cursor=pointer]
                - button "2L, g7, double letter, empty" [ref=e260] [cursor=pointer]:
                  - generic [ref=e261]: 2L
                - button "h7, empty" [ref=e262] [cursor=pointer]
                - button "2L, i7, double letter, empty" [ref=e263] [cursor=pointer]:
                  - generic [ref=e264]: 2L
                - button "j7, empty" [ref=e265] [cursor=pointer]
                - button "2L, k7, double letter, empty" [ref=e266] [cursor=pointer]:
                  - generic [ref=e267]: 2L
                - button "l7, empty" [ref=e268] [cursor=pointer]
                - button "m7, empty" [ref=e269] [cursor=pointer]
                - button "2W, n7, double word, empty" [ref=e270] [cursor=pointer]:
                  - generic [ref=e271]: 2W
                - button "o7, empty" [ref=e272] [cursor=pointer]
                - generic [ref=e273]: "8"
                - button "2L, a8, double letter, empty" [ref=e274] [cursor=pointer]:
                  - generic [ref=e275]: 2L
                - button "b8, empty" [ref=e276] [cursor=pointer]
                - button "c8, empty" [ref=e277] [cursor=pointer]
                - button "d8, empty" [ref=e278] [cursor=pointer]
                - button "e8, empty" [ref=e279] [cursor=pointer]
                - button "3L, f8, triple letter, empty" [ref=e280] [cursor=pointer]:
                  - generic [ref=e281]: 3L
                - button "g8, empty" [ref=e282] [cursor=pointer]
                - button "★, h8, start, double word, empty" [ref=e283] [cursor=pointer]:
                  - generic [ref=e284]: ★
                - button "i8, empty" [ref=e285] [cursor=pointer]
                - button "3L, j8, triple letter, empty" [ref=e286] [cursor=pointer]:
                  - generic [ref=e287]: 3L
                - button "k8, empty" [ref=e288] [cursor=pointer]
                - button "l8, empty" [ref=e289] [cursor=pointer]
                - button "m8, empty" [ref=e290] [cursor=pointer]
                - button "n8, empty" [ref=e291] [cursor=pointer]
                - button "2L, o8, double letter, empty" [ref=e292] [cursor=pointer]:
                  - generic [ref=e293]: 2L
                - generic [ref=e294]: "9"
                - button "a9, empty" [ref=e295] [cursor=pointer]
                - button "2W, b9, double word, empty" [ref=e296] [cursor=pointer]:
                  - generic [ref=e297]: 2W
                - button "c9, empty" [ref=e298] [cursor=pointer]
                - button "d9, empty" [ref=e299] [cursor=pointer]
                - button "2L, e9, double letter, empty" [ref=e300] [cursor=pointer]:
                  - generic [ref=e301]: 2L
                - button "f9, empty" [ref=e302] [cursor=pointer]
                - button "2L, g9, double letter, empty" [ref=e303] [cursor=pointer]:
                  - generic [ref=e304]: 2L
                - button "h9, empty" [ref=e305] [cursor=pointer]
                - button "2L, i9, double letter, empty" [ref=e306] [cursor=pointer]:
                  - generic [ref=e307]: 2L
                - button "j9, empty" [ref=e308] [cursor=pointer]
                - button "2L, k9, double letter, empty" [ref=e309] [cursor=pointer]:
                  - generic [ref=e310]: 2L
                - button "l9, empty" [ref=e311] [cursor=pointer]
                - button "m9, empty" [ref=e312] [cursor=pointer]
                - button "2W, n9, double word, empty" [ref=e313] [cursor=pointer]:
                  - generic [ref=e314]: 2W
                - button "o9, empty" [ref=e315] [cursor=pointer]
                - generic [ref=e316]: "10"
                - button "a10, empty" [ref=e317] [cursor=pointer]
                - button "b10, empty" [ref=e318] [cursor=pointer]
                - button "c10, empty" [ref=e319] [cursor=pointer]
                - button "d10, empty" [ref=e320] [cursor=pointer]
                - button "e10, empty" [ref=e321] [cursor=pointer]
                - button "f10, empty" [ref=e322] [cursor=pointer]
                - button "g10, empty" [ref=e323] [cursor=pointer]
                - button "3L, h10, triple letter, empty" [ref=e324] [cursor=pointer]:
                  - generic [ref=e325]: 3L
                - button "i10, empty" [ref=e326] [cursor=pointer]
                - button "j10, empty" [ref=e327] [cursor=pointer]
                - button "k10, empty" [ref=e328] [cursor=pointer]
                - button "l10, empty" [ref=e329] [cursor=pointer]
                - button "m10, empty" [ref=e330] [cursor=pointer]
                - button "n10, empty" [ref=e331] [cursor=pointer]
                - button "o10, empty" [ref=e332] [cursor=pointer]
                - generic [ref=e333]: "11"
                - button "3W, a11, triple word, empty" [ref=e334] [cursor=pointer]:
                  - generic [ref=e335]: 3W
                - button "b11, empty" [ref=e336] [cursor=pointer]
                - button "3L, c11, triple letter, empty" [ref=e337] [cursor=pointer]:
                  - generic [ref=e338]: 3L
                - button "d11, empty" [ref=e339] [cursor=pointer]
                - button "e11, empty" [ref=e340] [cursor=pointer]
                - button "f11, empty" [ref=e341] [cursor=pointer]
                - button "2L, g11, double letter, empty" [ref=e342] [cursor=pointer]:
                  - generic [ref=e343]: 2L
                - button "h11, empty" [ref=e344] [cursor=pointer]
                - button "2L, i11, double letter, empty" [ref=e345] [cursor=pointer]:
                  - generic [ref=e346]: 2L
                - button "j11, empty" [ref=e347] [cursor=pointer]
                - button "k11, empty" [ref=e348] [cursor=pointer]
                - button "l11, empty" [ref=e349] [cursor=pointer]
                - button "3L, m11, triple letter, empty" [ref=e350] [cursor=pointer]:
                  - generic [ref=e351]: 3L
                - button "n11, empty" [ref=e352] [cursor=pointer]
                - button "3W, o11, triple word, empty" [ref=e353] [cursor=pointer]:
                  - generic [ref=e354]: 3W
                - generic [ref=e355]: "12"
                - button "a12, empty" [ref=e356] [cursor=pointer]
                - button "2L, b12, double letter, empty" [ref=e357] [cursor=pointer]:
                  - generic [ref=e358]: 2L
                - button "c12, empty" [ref=e359] [cursor=pointer]
                - button "2W, d12, double word, empty" [ref=e360] [cursor=pointer]:
                  - generic [ref=e361]: 2W
                - button "e12, empty" [ref=e362] [cursor=pointer]
                - button "f12, empty" [ref=e363] [cursor=pointer]
                - button "g12, empty" [ref=e364] [cursor=pointer]
                - button "h12, empty" [ref=e365] [cursor=pointer]
                - button "i12, empty" [ref=e366] [cursor=pointer]
                - button "j12, empty" [ref=e367] [cursor=pointer]
                - button "k12, empty" [ref=e368] [cursor=pointer]
                - button "2W, l12, double word, empty" [ref=e369] [cursor=pointer]:
                  - generic [ref=e370]: 2W
                - button "m12, empty" [ref=e371] [cursor=pointer]
                - button "2L, n12, double letter, empty" [ref=e372] [cursor=pointer]:
                  - generic [ref=e373]: 2L
                - button "o12, empty" [ref=e374] [cursor=pointer]
                - generic [ref=e375]: "13"
                - button "a13, empty" [ref=e376] [cursor=pointer]
                - button "b13, empty" [ref=e377] [cursor=pointer]
                - button "c13, empty" [ref=e378] [cursor=pointer]
                - button "d13, empty" [ref=e379] [cursor=pointer]
                - button "3L, e13, triple letter, empty" [ref=e380] [cursor=pointer]:
                  - generic [ref=e381]: 3L
                - button "f13, empty" [ref=e382] [cursor=pointer]
                - button "g13, empty" [ref=e383] [cursor=pointer]
                - button "h13, empty" [ref=e384] [cursor=pointer]
                - button "i13, empty" [ref=e385] [cursor=pointer]
                - button "j13, empty" [ref=e386] [cursor=pointer]
                - button "3L, k13, triple letter, empty" [ref=e387] [cursor=pointer]:
                  - generic [ref=e388]: 3L
                - button "l13, empty" [ref=e389] [cursor=pointer]
                - button "m13, empty" [ref=e390] [cursor=pointer]
                - button "n13, empty" [ref=e391] [cursor=pointer]
                - button "o13, empty" [ref=e392] [cursor=pointer]
                - generic [ref=e393]: "14"
                - button "a14, empty" [ref=e394] [cursor=pointer]
                - button "b14, empty" [ref=e395] [cursor=pointer]
                - button "c14, empty" [ref=e396] [cursor=pointer]
                - button "2L, d14, double letter, empty" [ref=e397] [cursor=pointer]:
                  - generic [ref=e398]: 2L
                - button "e14, empty" [ref=e399] [cursor=pointer]
                - button "f14, empty" [ref=e400] [cursor=pointer]
                - button "2W, g14, double word, empty" [ref=e401] [cursor=pointer]:
                  - generic [ref=e402]: 2W
                - button "h14, empty" [ref=e403] [cursor=pointer]
                - button "2W, i14, double word, empty" [ref=e404] [cursor=pointer]:
                  - generic [ref=e405]: 2W
                - button "j14, empty" [ref=e406] [cursor=pointer]
                - button "k14, empty" [ref=e407] [cursor=pointer]
                - button "2L, l14, double letter, empty" [ref=e408] [cursor=pointer]:
                  - generic [ref=e409]: 2L
                - button "m14, empty" [ref=e410] [cursor=pointer]
                - button "n14, empty" [ref=e411] [cursor=pointer]
                - button "o14, empty" [ref=e412] [cursor=pointer]
                - generic [ref=e413]: "15"
                - button "2L, a15, double letter, empty" [ref=e414] [cursor=pointer]:
                  - generic [ref=e415]: 2L
                - button "b15, empty" [ref=e416] [cursor=pointer]
                - button "c15, empty" [ref=e417] [cursor=pointer]
                - button "d15, empty" [ref=e418] [cursor=pointer]
                - button "3W, e15, triple word, empty" [ref=e419] [cursor=pointer]:
                  - generic [ref=e420]: 3W
                - button "f15, empty" [ref=e421] [cursor=pointer]
                - button "g15, empty" [ref=e422] [cursor=pointer]
                - button "2L, h15, double letter, empty" [ref=e423] [cursor=pointer]:
                  - generic [ref=e424]: 2L
                - button "i15, empty" [ref=e425] [cursor=pointer]
                - button "j15, empty" [ref=e426] [cursor=pointer]
                - button "3W, k15, triple word, empty" [ref=e427] [cursor=pointer]:
                  - generic [ref=e428]: 3W
                - button "l15, empty" [ref=e429] [cursor=pointer]
                - button "m15, empty" [ref=e430] [cursor=pointer]
                - button "n15, empty" [ref=e431] [cursor=pointer]
                - button "2L, o15, double letter, empty" [ref=e432] [cursor=pointer]:
                  - generic [ref=e433]: 2L
        - status [ref=e435]:
          - generic [ref=e436]:
            - generic [ref=e437]: "Amber: avery. Teal: jordan_plays."
            - text: Amber — to play · 86 tiles in the bag
        - generic [ref=e440]:
          - generic [ref=e444]:
            - generic [ref=e445]:
              - img "Amber" [ref=e446]
              - generic [ref=e447]: avery
              - generic [ref=e448]: Your move
            - generic [ref=e451]: 7 tiles
          - generic [ref=e452]:
            - generic [ref=e453]: Score
            - generic [ref=e454]: "0"
      - region "Game record" [ref=e457]:
        - generic [ref=e458]:
          - heading "Game record" [level=2] [ref=e460]
          - paragraph [ref=e461]: Amber — to play · 86 tiles in the bag
        - generic [ref=e463]:
          - group "Game actions" [ref=e464]:
            - button "Offer draw" [ref=e465] [cursor=pointer]:
              - paragraph [ref=e468]: Offer draw
            - button "Resign game" [ref=e469] [cursor=pointer]:
              - paragraph [ref=e472]:
                - text: Resign
                - generic [ref=e473]: game
          - button "History and stats" [ref=e474] [cursor=pointer]:
            - paragraph [ref=e477]: History and stats
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