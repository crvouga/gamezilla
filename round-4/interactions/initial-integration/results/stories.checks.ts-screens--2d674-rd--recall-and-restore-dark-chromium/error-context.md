# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--recall-and-restore dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  64851 pixels (ratio 0.20 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/recall-and-restore-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/recall-and-restore-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 64851 pixels (ratio 0.20 of all image pixels) are different.
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
  - 64851 pixels (ratio 0.20 of all image pixels) are different.

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
                - generic [ref=e48]: jordan_plays
              - generic [ref=e51]: 7 tiles
            - generic [ref=e52]:
              - generic [ref=e53]: Score
              - generic [ref=e54]: "0"
          - generic [ref=e56]:
            - group "Your rack" [ref=e57]:
              - button "C, 3 points" [ref=e58] [cursor=pointer]:
                - generic [ref=e59]: C
                - generic [ref=e60]: "3"
              - button "A, 1 points" [ref=e61] [cursor=pointer]:
                - generic [ref=e62]: A
                - generic [ref=e63]: "1"
              - button "T, 1 points" [ref=e64] [cursor=pointer]:
                - generic [ref=e65]: T
                - generic [ref=e66]: "1"
              - button "Blank, 0 points" [ref=e67] [cursor=pointer]:
                - generic [ref=e68]: "0"
              - button "E, 1 points" [ref=e69] [cursor=pointer]:
                - generic [ref=e70]: E
                - generic [ref=e71]: "1"
              - button "S, 1 points" [ref=e72] [cursor=pointer]:
                - generic [ref=e73]: S
                - generic [ref=e74]: "1"
              - button "Q, 10 points" [ref=e75] [cursor=pointer]:
                - generic [ref=e76]: Q
                - generic [ref=e77]: "10"
            - generic [ref=e78]:
              - group "Word actions" [ref=e79]:
                - button "Play word" [disabled] [ref=e80]:
                  - paragraph [ref=e83]: Play word
                - button "Recall tiles" [disabled] [ref=e84]:
                  - paragraph [ref=e87]: Recall tiles
                - button "Undo" [ref=e88] [cursor=pointer]:
                  - paragraph [ref=e91]: Undo
                - button "Redo" [disabled] [ref=e92]:
                  - paragraph [ref=e95]: Redo
                - button "Shuffle rack" [ref=e96] [cursor=pointer]:
                  - paragraph [ref=e99]: Shuffle rack
                - button "Pass" [ref=e100] [cursor=pointer]:
                  - paragraph [ref=e103]: Pass
                - button "Exchange tiles" [ref=e104] [cursor=pointer]:
                  - paragraph [ref=e107]: Exchange tiles
              - status [ref=e110]: Choose a tile, then a square.
            - generic [ref=e111]:
              - generic [ref=e112]:
                - button "Fit board" [pressed] [ref=e113] [cursor=pointer]:
                  - paragraph [ref=e116]: Fit board
                - button "Enlarge board" [ref=e117] [cursor=pointer]:
                  - paragraph [ref=e120]: Enlarge board
              - region "Scrollable word board" [ref=e122]:
                - group "Word board, fifteen columns and fifteen rows" [ref=e123]:
                  - generic [ref=e125]: a
                  - generic [ref=e126]: b
                  - generic [ref=e127]: c
                  - generic [ref=e128]: d
                  - generic [ref=e129]: e
                  - generic [ref=e130]: f
                  - generic [ref=e131]: g
                  - generic [ref=e132]: h
                  - generic [ref=e133]: i
                  - generic [ref=e134]: j
                  - generic [ref=e135]: k
                  - generic [ref=e136]: l
                  - generic [ref=e137]: m
                  - generic [ref=e138]: "n"
                  - generic [ref=e139]: o
                  - generic [ref=e140]: "1"
                  - button "2L, a1, double letter, empty" [ref=e141] [cursor=pointer]:
                    - generic [ref=e142]: 2L
                  - button "b1, empty" [ref=e143] [cursor=pointer]
                  - button "c1, empty" [ref=e144] [cursor=pointer]
                  - button "d1, empty" [ref=e145] [cursor=pointer]
                  - button "3W, e1, triple word, empty" [ref=e146] [cursor=pointer]:
                    - generic [ref=e147]: 3W
                  - button "f1, empty" [ref=e148] [cursor=pointer]
                  - button "g1, empty" [ref=e149] [cursor=pointer]
                  - button "2L, h1, double letter, empty" [ref=e150] [cursor=pointer]:
                    - generic [ref=e151]: 2L
                  - button "i1, empty" [ref=e152] [cursor=pointer]
                  - button "j1, empty" [ref=e153] [cursor=pointer]
                  - button "3W, k1, triple word, empty" [ref=e154] [cursor=pointer]:
                    - generic [ref=e155]: 3W
                  - button "l1, empty" [ref=e156] [cursor=pointer]
                  - button "m1, empty" [ref=e157] [cursor=pointer]
                  - button "n1, empty" [ref=e158] [cursor=pointer]
                  - button "2L, o1, double letter, empty" [ref=e159] [cursor=pointer]:
                    - generic [ref=e160]: 2L
                  - generic [ref=e161]: "2"
                  - button "a2, empty" [ref=e162] [cursor=pointer]
                  - button "b2, empty" [ref=e163] [cursor=pointer]
                  - button "c2, empty" [ref=e164] [cursor=pointer]
                  - button "2L, d2, double letter, empty" [ref=e165] [cursor=pointer]:
                    - generic [ref=e166]: 2L
                  - button "e2, empty" [ref=e167] [cursor=pointer]
                  - button "f2, empty" [ref=e168] [cursor=pointer]
                  - button "2W, g2, double word, empty" [ref=e169] [cursor=pointer]:
                    - generic [ref=e170]: 2W
                  - button "h2, empty" [ref=e171] [cursor=pointer]
                  - button "2W, i2, double word, empty" [ref=e172] [cursor=pointer]:
                    - generic [ref=e173]: 2W
                  - button "j2, empty" [ref=e174] [cursor=pointer]
                  - button "k2, empty" [ref=e175] [cursor=pointer]
                  - button "2L, l2, double letter, empty" [ref=e176] [cursor=pointer]:
                    - generic [ref=e177]: 2L
                  - button "m2, empty" [ref=e178] [cursor=pointer]
                  - button "n2, empty" [ref=e179] [cursor=pointer]
                  - button "o2, empty" [ref=e180] [cursor=pointer]
                  - generic [ref=e181]: "3"
                  - button "a3, empty" [ref=e182] [cursor=pointer]
                  - button "b3, empty" [ref=e183] [cursor=pointer]
                  - button "c3, empty" [ref=e184] [cursor=pointer]
                  - button "d3, empty" [ref=e185] [cursor=pointer]
                  - button "3L, e3, triple letter, empty" [ref=e186] [cursor=pointer]:
                    - generic [ref=e187]: 3L
                  - button "f3, empty" [ref=e188] [cursor=pointer]
                  - button "g3, empty" [ref=e189] [cursor=pointer]
                  - button "h3, empty" [ref=e190] [cursor=pointer]
                  - button "i3, empty" [ref=e191] [cursor=pointer]
                  - button "j3, empty" [ref=e192] [cursor=pointer]
                  - button "3L, k3, triple letter, empty" [ref=e193] [cursor=pointer]:
                    - generic [ref=e194]: 3L
                  - button "l3, empty" [ref=e195] [cursor=pointer]
                  - button "m3, empty" [ref=e196] [cursor=pointer]
                  - button "n3, empty" [ref=e197] [cursor=pointer]
                  - button "o3, empty" [ref=e198] [cursor=pointer]
                  - generic [ref=e199]: "4"
                  - button "a4, empty" [ref=e200] [cursor=pointer]
                  - button "2L, b4, double letter, empty" [ref=e201] [cursor=pointer]:
                    - generic [ref=e202]: 2L
                  - button "c4, empty" [ref=e203] [cursor=pointer]
                  - button "2W, d4, double word, empty" [ref=e204] [cursor=pointer]:
                    - generic [ref=e205]: 2W
                  - button "e4, empty" [ref=e206] [cursor=pointer]
                  - button "f4, empty" [ref=e207] [cursor=pointer]
                  - button "g4, empty" [ref=e208] [cursor=pointer]
                  - button "h4, empty" [ref=e209] [cursor=pointer]
                  - button "i4, empty" [ref=e210] [cursor=pointer]
                  - button "j4, empty" [ref=e211] [cursor=pointer]
                  - button "k4, empty" [ref=e212] [cursor=pointer]
                  - button "2W, l4, double word, empty" [ref=e213] [cursor=pointer]:
                    - generic [ref=e214]: 2W
                  - button "m4, empty" [ref=e215] [cursor=pointer]
                  - button "2L, n4, double letter, empty" [ref=e216] [cursor=pointer]:
                    - generic [ref=e217]: 2L
                  - button "o4, empty" [ref=e218] [cursor=pointer]
                  - generic [ref=e219]: "5"
                  - button "3W, a5, triple word, empty" [ref=e220] [cursor=pointer]:
                    - generic [ref=e221]: 3W
                  - button "b5, empty" [ref=e222] [cursor=pointer]
                  - button "3L, c5, triple letter, empty" [ref=e223] [cursor=pointer]:
                    - generic [ref=e224]: 3L
                  - button "d5, empty" [ref=e225] [cursor=pointer]
                  - button "e5, empty" [ref=e226] [cursor=pointer]
                  - button "f5, empty" [ref=e227] [cursor=pointer]
                  - button "2L, g5, double letter, empty" [ref=e228] [cursor=pointer]:
                    - generic [ref=e229]: 2L
                  - button "h5, empty" [ref=e230] [cursor=pointer]
                  - button "2L, i5, double letter, empty" [ref=e231] [cursor=pointer]:
                    - generic [ref=e232]: 2L
                  - button "j5, empty" [ref=e233] [cursor=pointer]
                  - button "k5, empty" [ref=e234] [cursor=pointer]
                  - button "l5, empty" [ref=e235] [cursor=pointer]
                  - button "3L, m5, triple letter, empty" [ref=e236] [cursor=pointer]:
                    - generic [ref=e237]: 3L
                  - button "n5, empty" [ref=e238] [cursor=pointer]
                  - button "3W, o5, triple word, empty" [ref=e239] [cursor=pointer]:
                    - generic [ref=e240]: 3W
                  - generic [ref=e241]: "6"
                  - button "a6, empty" [ref=e242] [cursor=pointer]
                  - button "b6, empty" [ref=e243] [cursor=pointer]
                  - button "c6, empty" [ref=e244] [cursor=pointer]
                  - button "d6, empty" [ref=e245] [cursor=pointer]
                  - button "e6, empty" [ref=e246] [cursor=pointer]
                  - button "f6, empty" [ref=e247] [cursor=pointer]
                  - button "g6, empty" [ref=e248] [cursor=pointer]
                  - button "3L, h6, triple letter, empty" [ref=e249] [cursor=pointer]:
                    - generic [ref=e250]: 3L
                  - button "i6, empty" [ref=e251] [cursor=pointer]
                  - button "j6, empty" [ref=e252] [cursor=pointer]
                  - button "k6, empty" [ref=e253] [cursor=pointer]
                  - button "l6, empty" [ref=e254] [cursor=pointer]
                  - button "m6, empty" [ref=e255] [cursor=pointer]
                  - button "n6, empty" [ref=e256] [cursor=pointer]
                  - button "o6, empty" [ref=e257] [cursor=pointer]
                  - generic [ref=e258]: "7"
                  - button "a7, empty" [ref=e259] [cursor=pointer]
                  - button "2W, b7, double word, empty" [ref=e260] [cursor=pointer]:
                    - generic [ref=e261]: 2W
                  - button "c7, empty" [ref=e262] [cursor=pointer]
                  - button "d7, empty" [ref=e263] [cursor=pointer]
                  - button "2L, e7, double letter, empty" [ref=e264] [cursor=pointer]:
                    - generic [ref=e265]: 2L
                  - button "f7, empty" [ref=e266] [cursor=pointer]
                  - button "2L, g7, double letter, empty" [ref=e267] [cursor=pointer]:
                    - generic [ref=e268]: 2L
                  - button "h7, empty" [ref=e269] [cursor=pointer]
                  - button "2L, i7, double letter, empty" [ref=e270] [cursor=pointer]:
                    - generic [ref=e271]: 2L
                  - button "j7, empty" [ref=e272] [cursor=pointer]
                  - button "2L, k7, double letter, empty" [ref=e273] [cursor=pointer]:
                    - generic [ref=e274]: 2L
                  - button "l7, empty" [ref=e275] [cursor=pointer]
                  - button "m7, empty" [ref=e276] [cursor=pointer]
                  - button "2W, n7, double word, empty" [ref=e277] [cursor=pointer]:
                    - generic [ref=e278]: 2W
                  - button "o7, empty" [ref=e279] [cursor=pointer]
                  - generic [ref=e280]: "8"
                  - button "2L, a8, double letter, empty" [ref=e281] [cursor=pointer]:
                    - generic [ref=e282]: 2L
                  - button "b8, empty" [ref=e283] [cursor=pointer]
                  - button "c8, empty" [ref=e284] [cursor=pointer]
                  - button "d8, empty" [ref=e285] [cursor=pointer]
                  - button "e8, empty" [ref=e286] [cursor=pointer]
                  - button "3L, f8, triple letter, empty" [ref=e287] [cursor=pointer]:
                    - generic [ref=e288]: 3L
                  - button "g8, empty" [ref=e289] [cursor=pointer]
                  - button "★, h8, start, double word, empty" [ref=e290] [cursor=pointer]:
                    - generic [ref=e291]: ★
                  - button "i8, empty" [ref=e292] [cursor=pointer]
                  - button "3L, j8, triple letter, empty" [ref=e293] [cursor=pointer]:
                    - generic [ref=e294]: 3L
                  - button "k8, empty" [ref=e295] [cursor=pointer]
                  - button "l8, empty" [ref=e296] [cursor=pointer]
                  - button "m8, empty" [ref=e297] [cursor=pointer]
                  - button "n8, empty" [ref=e298] [cursor=pointer]
                  - button "2L, o8, double letter, empty" [ref=e299] [cursor=pointer]:
                    - generic [ref=e300]: 2L
                  - generic [ref=e301]: "9"
                  - button "a9, empty" [ref=e302] [cursor=pointer]
                  - button "2W, b9, double word, empty" [ref=e303] [cursor=pointer]:
                    - generic [ref=e304]: 2W
                  - button "c9, empty" [ref=e305] [cursor=pointer]
                  - button "d9, empty" [ref=e306] [cursor=pointer]
                  - button "2L, e9, double letter, empty" [ref=e307] [cursor=pointer]:
                    - generic [ref=e308]: 2L
                  - button "f9, empty" [ref=e309] [cursor=pointer]
                  - button "2L, g9, double letter, empty" [ref=e310] [cursor=pointer]:
                    - generic [ref=e311]: 2L
                  - button "h9, empty" [ref=e312] [cursor=pointer]
                  - button "2L, i9, double letter, empty" [ref=e313] [cursor=pointer]:
                    - generic [ref=e314]: 2L
                  - button "j9, empty" [ref=e315] [cursor=pointer]
                  - button "2L, k9, double letter, empty" [ref=e316] [cursor=pointer]:
                    - generic [ref=e317]: 2L
                  - button "l9, empty" [ref=e318] [cursor=pointer]
                  - button "m9, empty" [ref=e319] [cursor=pointer]
                  - button "2W, n9, double word, empty" [ref=e320] [cursor=pointer]:
                    - generic [ref=e321]: 2W
                  - button "o9, empty" [ref=e322] [cursor=pointer]
                  - generic [ref=e323]: "10"
                  - button "a10, empty" [ref=e324] [cursor=pointer]
                  - button "b10, empty" [ref=e325] [cursor=pointer]
                  - button "c10, empty" [ref=e326] [cursor=pointer]
                  - button "d10, empty" [ref=e327] [cursor=pointer]
                  - button "e10, empty" [ref=e328] [cursor=pointer]
                  - button "f10, empty" [ref=e329] [cursor=pointer]
                  - button "g10, empty" [ref=e330] [cursor=pointer]
                  - button "3L, h10, triple letter, empty" [ref=e331] [cursor=pointer]:
                    - generic [ref=e332]: 3L
                  - button "i10, empty" [ref=e333] [cursor=pointer]
                  - button "j10, empty" [ref=e334] [cursor=pointer]
                  - button "k10, empty" [ref=e335] [cursor=pointer]
                  - button "l10, empty" [ref=e336] [cursor=pointer]
                  - button "m10, empty" [ref=e337] [cursor=pointer]
                  - button "n10, empty" [ref=e338] [cursor=pointer]
                  - button "o10, empty" [ref=e339] [cursor=pointer]
                  - generic [ref=e340]: "11"
                  - button "3W, a11, triple word, empty" [ref=e341] [cursor=pointer]:
                    - generic [ref=e342]: 3W
                  - button "b11, empty" [ref=e343] [cursor=pointer]
                  - button "3L, c11, triple letter, empty" [ref=e344] [cursor=pointer]:
                    - generic [ref=e345]: 3L
                  - button "d11, empty" [ref=e346] [cursor=pointer]
                  - button "e11, empty" [ref=e347] [cursor=pointer]
                  - button "f11, empty" [ref=e348] [cursor=pointer]
                  - button "2L, g11, double letter, empty" [ref=e349] [cursor=pointer]:
                    - generic [ref=e350]: 2L
                  - button "h11, empty" [ref=e351] [cursor=pointer]
                  - button "2L, i11, double letter, empty" [ref=e352] [cursor=pointer]:
                    - generic [ref=e353]: 2L
                  - button "j11, empty" [ref=e354] [cursor=pointer]
                  - button "k11, empty" [ref=e355] [cursor=pointer]
                  - button "l11, empty" [ref=e356] [cursor=pointer]
                  - button "3L, m11, triple letter, empty" [ref=e357] [cursor=pointer]:
                    - generic [ref=e358]: 3L
                  - button "n11, empty" [ref=e359] [cursor=pointer]
                  - button "3W, o11, triple word, empty" [ref=e360] [cursor=pointer]:
                    - generic [ref=e361]: 3W
                  - generic [ref=e362]: "12"
                  - button "a12, empty" [ref=e363] [cursor=pointer]
                  - button "2L, b12, double letter, empty" [ref=e364] [cursor=pointer]:
                    - generic [ref=e365]: 2L
                  - button "c12, empty" [ref=e366] [cursor=pointer]
                  - button "2W, d12, double word, empty" [ref=e367] [cursor=pointer]:
                    - generic [ref=e368]: 2W
                  - button "e12, empty" [ref=e369] [cursor=pointer]
                  - button "f12, empty" [ref=e370] [cursor=pointer]
                  - button "g12, empty" [ref=e371] [cursor=pointer]
                  - button "h12, empty" [ref=e372] [cursor=pointer]
                  - button "i12, empty" [ref=e373] [cursor=pointer]
                  - button "j12, empty" [ref=e374] [cursor=pointer]
                  - button "k12, empty" [ref=e375] [cursor=pointer]
                  - button "2W, l12, double word, empty" [ref=e376] [cursor=pointer]:
                    - generic [ref=e377]: 2W
                  - button "m12, empty" [ref=e378] [cursor=pointer]
                  - button "2L, n12, double letter, empty" [ref=e379] [cursor=pointer]:
                    - generic [ref=e380]: 2L
                  - button "o12, empty" [ref=e381] [cursor=pointer]
                  - generic [ref=e382]: "13"
                  - button "a13, empty" [ref=e383] [cursor=pointer]
                  - button "b13, empty" [ref=e384] [cursor=pointer]
                  - button "c13, empty" [ref=e385] [cursor=pointer]
                  - button "d13, empty" [ref=e386] [cursor=pointer]
                  - button "3L, e13, triple letter, empty" [ref=e387] [cursor=pointer]:
                    - generic [ref=e388]: 3L
                  - button "f13, empty" [ref=e389] [cursor=pointer]
                  - button "g13, empty" [ref=e390] [cursor=pointer]
                  - button "h13, empty" [ref=e391] [cursor=pointer]
                  - button "i13, empty" [ref=e392] [cursor=pointer]
                  - button "j13, empty" [ref=e393] [cursor=pointer]
                  - button "3L, k13, triple letter, empty" [ref=e394] [cursor=pointer]:
                    - generic [ref=e395]: 3L
                  - button "l13, empty" [ref=e396] [cursor=pointer]
                  - button "m13, empty" [ref=e397] [cursor=pointer]
                  - button "n13, empty" [ref=e398] [cursor=pointer]
                  - button "o13, empty" [ref=e399] [cursor=pointer]
                  - generic [ref=e400]: "14"
                  - button "a14, empty" [ref=e401] [cursor=pointer]
                  - button "b14, empty" [ref=e402] [cursor=pointer]
                  - button "c14, empty" [ref=e403] [cursor=pointer]
                  - button "2L, d14, double letter, empty" [ref=e404] [cursor=pointer]:
                    - generic [ref=e405]: 2L
                  - button "e14, empty" [ref=e406] [cursor=pointer]
                  - button "f14, empty" [ref=e407] [cursor=pointer]
                  - button "2W, g14, double word, empty" [ref=e408] [cursor=pointer]:
                    - generic [ref=e409]: 2W
                  - button "h14, empty" [ref=e410] [cursor=pointer]
                  - button "2W, i14, double word, empty" [ref=e411] [cursor=pointer]:
                    - generic [ref=e412]: 2W
                  - button "j14, empty" [ref=e413] [cursor=pointer]
                  - button "k14, empty" [ref=e414] [cursor=pointer]
                  - button "2L, l14, double letter, empty" [ref=e415] [cursor=pointer]:
                    - generic [ref=e416]: 2L
                  - button "m14, empty" [ref=e417] [cursor=pointer]
                  - button "n14, empty" [ref=e418] [cursor=pointer]
                  - button "o14, empty" [ref=e419] [cursor=pointer]
                  - generic [ref=e420]: "15"
                  - button "2L, a15, double letter, empty" [ref=e421] [cursor=pointer]:
                    - generic [ref=e422]: 2L
                  - button "b15, empty" [ref=e423] [cursor=pointer]
                  - button "c15, empty" [ref=e424] [cursor=pointer]
                  - button "d15, empty" [ref=e425] [cursor=pointer]
                  - button "3W, e15, triple word, empty" [ref=e426] [cursor=pointer]:
                    - generic [ref=e427]: 3W
                  - button "f15, empty" [ref=e428] [cursor=pointer]
                  - button "g15, empty" [ref=e429] [cursor=pointer]
                  - button "2L, h15, double letter, empty" [ref=e430] [cursor=pointer]:
                    - generic [ref=e431]: 2L
                  - button "i15, empty" [ref=e432] [cursor=pointer]
                  - button "j15, empty" [ref=e433] [cursor=pointer]
                  - button "3W, k15, triple word, empty" [ref=e434] [cursor=pointer]:
                    - generic [ref=e435]: 3W
                  - button "l15, empty" [ref=e436] [cursor=pointer]
                  - button "m15, empty" [ref=e437] [cursor=pointer]
                  - button "n15, empty" [ref=e438] [cursor=pointer]
                  - button "2L, o15, double letter, empty" [ref=e439] [cursor=pointer]:
                    - generic [ref=e440]: 2L
          - status [ref=e442]:
            - generic [ref=e443]:
              - generic [ref=e444]: "Amber: avery. Teal: jordan_plays."
              - text: Amber — to play · 86 tiles in the bag
          - generic [ref=e447]:
            - generic [ref=e451]:
              - generic [ref=e452]:
                - img "Amber" [ref=e453]
                - generic [ref=e454]: avery
                - generic [ref=e455]: Your move
              - generic [ref=e458]: 7 tiles
            - generic [ref=e459]:
              - generic [ref=e460]: Score
              - generic [ref=e461]: "0"
        - generic [ref=e464]:
          - group "Game actions" [ref=e465]:
            - button "Offer draw" [ref=e466] [cursor=pointer]:
              - paragraph [ref=e469]: Offer draw
            - button "Resign game" [ref=e470] [cursor=pointer]:
              - paragraph [ref=e473]:
                - text: Resign
                - generic [ref=e474]: game
          - button "History and stats" [ref=e475] [cursor=pointer]:
            - generic [ref=e477]:
              - paragraph [ref=e478]: History and stats
              - img [ref=e481]
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